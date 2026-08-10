import { useEffect, useRef, useState } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { enqueueOp } from './offlineQueue';

type TableRow<T> = { key: string; data: T };

/**
 * Drop-in replacement for `useState<T[]>(initialValue)` backed by a real,
 * dedicated Supabase table (one row per item) instead of one giant row for
 * the whole list — see backend/supabase/schema.sql for the table list and
 * the `key` mapping per table. Keeps every open tab/device in sync in real
 * time, and only writes the rows that actually changed (not the whole
 * list) when you call the setter.
 *
 * `getKey` tells the hook which field is this entity's natural identifier
 * (e.g. `p => p.sku` for products, `c => c.id` for customers) — that value
 * becomes the row's primary key in Postgres, so it needs to be unique.
 *
 * Usage is identical to useState, just with an extra getKey argument:
 *   const [products, setProducts] = useSupabaseTable('products', initialProducts, p => p.sku);
 */
export function useSupabaseTable<T>(
  table: string,
  initialValue: T[],
  getKey: (item: T) => string
): [T[], (value: T[] | ((prev: T[]) => T[])) => void, boolean] {
  const [items, setItemsState] = useState<T[]>(initialValue);
  // True once the initial SELECT from Supabase has resolved (successfully
  // or not). Callers that need to distinguish "genuinely empty" from
  // "hasn't loaded yet" (e.g. seed-if-empty logic) MUST wait for this
  // instead of checking items.length === 0 — on every fresh mount, items
  // starts as initialValue (usually []) purely because the network
  // request hasn't come back yet, not because the table is empty.
  const [ready, setReady] = useState(false);
  // Last-known server state, keyed by row key — used to diff what actually
  // needs to be written (and to apply realtime deltas) without re-sending
  // the entire list on every change.
  const knownRef = useRef<Map<string, T>>(new Map());
  const getKeyRef = useRef(getKey);
  getKeyRef.current = getKey;

  useEffect(() => {
    let active = true;
    setReady(false);

    const applyUpsert = (row: TableRow<T>) => {
      if (!active) return;
      knownRef.current.set(row.key, row.data);
      setItemsState((prev) => {
        const idx = prev.findIndex((it) => getKeyRef.current(it) === row.key);
        if (idx === -1) return [...prev, row.data];
        const next = prev.slice();
        next[idx] = row.data;
        return next;
      });
    };

    const applyDelete = (key: string) => {
      if (!active) return;
      knownRef.current.delete(key);
      setItemsState((prev) => {
        const idx = prev.findIndex((it) => getKeyRef.current(it) === key);
        if (idx === -1) return prev;
        return prev.slice(0, idx).concat(prev.slice(idx + 1));
      });
    };

    // Subscribe first, *then* load — so nothing that changes in the gap
    // between "subscribed" and "initial load resolved" gets missed.
    const channel = supabase
      .channel(`table:${table}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload: RealtimePostgresChangesPayload<{ key: string; data: T }>) => {
          if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as { key?: string };
            if (oldRow.key) applyDelete(oldRow.key);
          } else {
            applyUpsert(payload.new as TableRow<T>);
          }
        }
      )
      .subscribe();

    const load = async () => {
      const { data, error } = await supabase
        .from(table)
        .select('key, data')
        .order('created_at', { ascending: true });

      if (!active) return;

      if (error) {
        console.error(`[supabase] Gagal memuat tabel "${table}":`, error);
        setReady(true);
        return;
      }

      if (data && data.length > 0) {
        const rows = data as unknown as TableRow<T>[];
        knownRef.current = new Map(rows.map((row) => [row.key, row.data]));
        setItemsState(rows.map((row) => row.data));
      } else if (initialValue.length > 0) {
        // First run for this table: seed with the provided defaults so
        // future reloads persist real, user-entered data from then on.
        const seedRows = initialValue.map((item) => ({
          key: getKeyRef.current(item),
          data: item as never,
        }));
        const { error: insertError } = await supabase.from(table).insert(seedRows);
        // Ignore unique-violation races (another tab/device seeded it a
        // moment earlier — that data arrives here via the subscription
        // above instead).
        if (insertError && insertError.code !== '23505') {
          console.error(`[supabase] Gagal seed data awal untuk tabel "${table}":`, insertError);
        } else {
          knownRef.current = new Map(initialValue.map((item) => [getKeyRef.current(item), item]));
        }
      }

      setReady(true);
    };

    load();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  const setItems = (next: T[] | ((prev: T[]) => T[])) => {
    setItemsState((prev) => {
      const resolved = typeof next === 'function' ? (next as (prev: T[]) => T[])(prev) : next;

      const prevKnown = knownRef.current;
      const nextMap = new Map(resolved.map((item) => [getKeyRef.current(item), item]));

      const toUpsert: TableRow<T>[] = [];
      nextMap.forEach((item, key) => {
        const prevItem = prevKnown.get(key);
        if (!prevItem || JSON.stringify(prevItem) !== JSON.stringify(item)) {
          toUpsert.push({ key, data: item });
        }
      });

      const toDelete: string[] = [];
      prevKnown.forEach((_item, key) => {
        if (!nextMap.has(key)) toDelete.push(key);
      });

      knownRef.current = nextMap;

      (async () => {
        if (toUpsert.length > 0) {
          const { error } = await supabase
            .from(table)
            .upsert(toUpsert as never, { onConflict: 'key' });
          if (error) {
            // Was probably offline (or a transient network error) — don't
            // just lose this write. Queue it so offlineSync.ts can replay
            // it once the connection is back, instead of the change
            // silently disappearing after only updating local state.
            console.warn(`[supabase] Gagal menyimpan ke tabel "${table}", disimpan ke antrian offline:`, error);
            await enqueueOp({ kind: 'table_upsert', table, rows: toUpsert, createdAt: Date.now() });
          }
        }
        if (toDelete.length > 0) {
          const { error } = await supabase.from(table).delete().in('key', toDelete);
          if (error) {
            console.warn(`[supabase] Gagal menghapus dari tabel "${table}", disimpan ke antrian offline:`, error);
            await enqueueOp({ kind: 'table_delete', table, keys: toDelete, createdAt: Date.now() });
          }
        }
      })();

      return resolved;
    });
  };

  return [items, setItems, ready];
}

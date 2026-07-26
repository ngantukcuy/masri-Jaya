import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from './supabase';

type SingletonRow<T> = { id: 1; value: T };
type TableRow<T> = { key: string; data: T };

/**
 * Lightweight Supabase-backed cache for code that isn't a React component
 * (plain utility modules, event handlers) and needs synchronous-looking
 * get/set, similar to how localStorage.getItem/setItem used to work.
 *
 * A background Realtime subscription keeps the in-memory cache fresh; reads
 * return whatever's currently cached (instantly available after the first
 * row arrives, which happens shortly after app load). Writes update the
 * cache immediately and push to Supabase in the background.
 *
 * Each singleton value lives in its own dedicated Supabase table (single
 * fixed row, id = 1) — not a shared key-value store. `table` is the actual
 * Supabase table name (snake_case), e.g. `getSupabaseCache('cash_session_current', ...)`.
 * See backend/supabase/schema.sql for the full table list.
 *
 * For reading a real per-entity table (e.g. `printers`) from non-component
 * code, see `getSupabaseTableCache` below instead.
 */
const caches = new Map<string, unknown>();
const subscribed = new Set<string>();

function ensureSubscribed<T>(table: string, defaultValue: T) {
  if (subscribed.has(table)) return;
  subscribed.add(table);
  caches.set(table, defaultValue);

  supabase
    .channel(`singleton_cache:${table}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: 'id=eq.1' },
      (payload: RealtimePostgresChangesPayload<SingletonRow<T>>) => {
        if (payload.eventType === 'DELETE') return;
        const row = payload.new as SingletonRow<T>;
        caches.set(table, row.value);
      }
    )
    .subscribe();

  supabase
    .from(table)
    .select('value')
    .eq('id', 1)
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) {
        console.error(`[supabase-cache] Gagal memuat tabel "${table}":`, error);
        return;
      }
      if (data) caches.set(table, data.value);
    });
}

export function getSupabaseCache<T>(table: string, defaultValue: T): T {
  ensureSubscribed(table, defaultValue);
  return caches.has(table) ? (caches.get(table) as T) : defaultValue;
}

export function setSupabaseCache<T>(table: string, value: T): void {
  caches.set(table, value);
  subscribed.add(table);
  supabase
    .from(table)
    .upsert({ id: 1, value: value as never }, { onConflict: 'id' })
    .then(({ error }) => {
      if (error) console.error(`[supabase-cache] Gagal menyimpan ke tabel "${table}":`, error);
    });
}

/**
 * Read-only, non-component cache for a real per-entity table (the same
 * tables `useSupabaseTable` writes to — see backend/supabase/schema.sql).
 * Used where a plain function (not a hook) needs the current list, e.g.
 * checking printer status from inside a POS checkout handler.
 */
const tableCaches = new Map<string, unknown[]>();
const tableSubscribed = new Set<string>();

function ensureTableSubscribed(table: string) {
  if (tableSubscribed.has(table)) return;
  tableSubscribed.add(table);
  tableCaches.set(table, []);

  const rowsByKey = new Map<string, unknown>();

  supabase
    .channel(`table_cache:${table}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      (payload: RealtimePostgresChangesPayload<TableRow<unknown>>) => {
        if (payload.eventType === 'DELETE') {
          const oldRow = payload.old as { key?: string };
          if (oldRow.key) rowsByKey.delete(oldRow.key);
        } else {
          const row = payload.new as TableRow<unknown>;
          rowsByKey.set(row.key, row.data);
        }
        tableCaches.set(table, Array.from(rowsByKey.values()));
      }
    )
    .subscribe();

  supabase
    .from(table)
    .select('key, data')
    .order('created_at', { ascending: true })
    .then(({ data, error }) => {
      if (error) {
        console.error(`[supabase-cache] Gagal memuat tabel "${table}":`, error);
        return;
      }
      (data ?? []).forEach((row: any) => rowsByKey.set(row.key, row.data));
      tableCaches.set(table, Array.from(rowsByKey.values()));
    });
}

export function getSupabaseTableCache<T>(table: string): T[] {
  ensureTableSubscribed(table);
  return (tableCaches.get(table) as T[]) ?? [];
}

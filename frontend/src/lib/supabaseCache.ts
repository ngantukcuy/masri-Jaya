import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from './supabase';

const TABLE = 'app_settings';

type StateRow<T> = { key: string; value: T };
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
 * This is for the singleton `app_settings` table. For reading a real
 * per-entity table (e.g. `printers`) from non-component code, see
 * `getSupabaseTableCache` below instead.
 */
const caches = new Map<string, unknown>();
const subscribed = new Set<string>();

function ensureSubscribed<T>(key: string, defaultValue: T) {
  if (subscribed.has(key)) return;
  subscribed.add(key);
  caches.set(key, defaultValue);

  supabase
    .channel(`app_settings_cache:${key}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE, filter: `key=eq.${key}` },
      (payload: RealtimePostgresChangesPayload<StateRow<T>>) => {
        if (payload.eventType === 'DELETE') return;
        const row = payload.new as StateRow<T>;
        caches.set(key, row.value);
      }
    )
    .subscribe();

  supabase
    .from(TABLE)
    .select('value')
    .eq('key', key)
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) {
        console.error(`[supabase-cache] Gagal memuat "${key}":`, error);
        return;
      }
      if (data) caches.set(key, data.value);
    });
}

export function getSupabaseCache<T>(key: string, defaultValue: T): T {
  ensureSubscribed(key, defaultValue);
  return caches.has(key) ? (caches.get(key) as T) : defaultValue;
}

export function setSupabaseCache<T>(key: string, value: T): void {
  caches.set(key, value);
  subscribed.add(key);
  supabase
    .from(TABLE)
    .upsert({ key, value: value as never }, { onConflict: 'key' })
    .then(({ error }) => {
      if (error) console.error(`[supabase-cache] Gagal menyimpan "${key}":`, error);
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

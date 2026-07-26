import { useEffect, useRef, useState } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from './supabase';

const TABLE = 'app_settings';

type StateRow<T> = { key: string; value: T };

/**
 * Drop-in replacement for `useState<T>(initialValue)` for genuinely
 * singleton/scalar app values (not lists) — persists to a single row in the
 * small `app_settings` table and keeps every open tab/device in sync in
 * real time. For list-shaped data (products, customers, ...), use
 * `useSupabaseTable` instead — each of those gets its own dedicated table
 * (see backend/supabase/schema.sql).
 *
 * Usage is identical to useState:
 *   const [registeredOwner, setRegisteredOwner] = useSupabaseState('registeredOwner', null);
 */
export function useSupabaseState<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValueState] = useState<T>(initialValue);
  const [ready, setReady] = useState(false);
  const initialValueRef = useRef(initialValue);
  initialValueRef.current = initialValue;

  useEffect(() => {
    let active = true;

    // Subscribe first, *then* fetch the current value — this way nothing
    // that changes in the gap between "subscribed" and "initial fetch
    // resolved" gets missed.
    const channel = supabase
      .channel(`tokku_state:${key}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLE, filter: `key=eq.${key}` },
        (payload: RealtimePostgresChangesPayload<StateRow<T>>) => {
          if (!active || payload.eventType === 'DELETE') return;
          const row = payload.new as StateRow<T>;
          setValueState(row.value);
        }
      )
      .subscribe();

    const load = async () => {
      const { data, error } = await supabase
        .from(TABLE)
        .select('value')
        .eq('key', key)
        .maybeSingle();

      if (!active) return;

      if (error) {
        console.error(`[supabase] Gagal memuat "${key}":`, error);
        setReady(true);
        return;
      }

      if (data) {
        setValueState(data.value as T);
      } else {
        // First run for this "table": seed the row with the provided
        // default (usually an empty array) so future reloads persist real,
        // user-entered data — no demo/dummy content.
        const { error: insertError } = await supabase
          .from(TABLE)
          .insert({ key, value: initialValueRef.current as never });
        // Ignore unique-violation races (another tab/device seeded it a
        // moment earlier — that row arrives here via the subscription
        // above instead).
        if (insertError && insertError.code !== '23505') {
          console.error(`[supabase] Gagal seed data awal untuk "${key}":`, insertError);
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
  }, [key]);

  const setValue = (next: T | ((prev: T) => T)) => {
    setValueState((prev) => {
      const resolved = typeof next === 'function' ? (next as (prev: T) => T)(prev) : next;
      supabase
        .from(TABLE)
        .upsert({ key, value: resolved as never }, { onConflict: 'key' })
        .then(({ error }) => {
          if (error) console.error(`[supabase] Gagal menyimpan "${key}":`, error);
        });
      return resolved;
    });
  };

  void ready; // exposed via useSupabaseState if a loading state is ever needed

  return [value, setValue];
}

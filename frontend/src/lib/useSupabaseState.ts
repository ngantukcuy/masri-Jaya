import { useEffect, useRef, useState } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from './supabase';

type SingletonRow<T> = { id: 1; value: T };

/**
 * Drop-in replacement for `useState<T>(initialValue)` for genuinely
 * singleton/scalar app values (not lists) — persists to the single fixed
 * row (id = 1) of its own dedicated Supabase table and keeps every open
 * tab/device in sync in real time. For list-shaped data (products,
 * customers, ...), use `useSupabaseTable` instead — see
 * backend/supabase/schema.sql for the full table list and the value ->
 * table mapping for singleton tables.
 *
 * Usage is identical to useState, but `table` is the actual Supabase table
 * name (snake_case), one dedicated table per value — not a shared
 * key-value store:
 *   const [registeredOwner, setRegisteredOwner] = useSupabaseState('store_owner', null);
 */
export function useSupabaseState<T>(
  table: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  const [value, setValueState] = useState<T>(initialValue);
  const [ready, setReady] = useState(false);
  const initialValueRef = useRef(initialValue);
  initialValueRef.current = initialValue;

  useEffect(() => {
    let active = true;

    // Subscribe first, *then* fetch the current value — this way nothing
    // that changes in the gap between "subscribed" and "initial fetch
    // resolved" gets missed.
    //
    // NOTE: the channel name includes a random suffix, not just `table`.
    // Multiple components can call useSupabaseState for the *same* table
    // at the same time (e.g. `store_owner` is read in App.tsx,
    // LoginView.tsx and SettingsView.tsx simultaneously). Supabase's
    // realtime client dedupes channels by topic name, so if two hook
    // instances both tried to open the same topic, the second call could
    // get handed back the first instance's *already-subscribed* channel
    // object — and calling `.on()` on a channel after `.subscribe()`
    // throws "cannot add postgres_changes callbacks ... after
    // subscribe()". Giving every instance its own unique topic keeps each
    // subscription independent.
    const channel = supabase
      .channel(`singleton:${table}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: 'id=eq.1' },
        (payload: RealtimePostgresChangesPayload<SingletonRow<T>>) => {
          if (!active || payload.eventType === 'DELETE') return;
          const row = payload.new as SingletonRow<T>;
          setValueState(row.value);
        }
      )
      .subscribe();

    const load = async () => {
      const { data, error } = await supabase
        .from(table)
        .select('value')
        .eq('id', 1)
        .maybeSingle();

      if (!active) return;

      if (error) {
        console.error(`[supabase] Gagal memuat tabel "${table}":`, error);
        setReady(true);
        return;
      }

      if (data) {
        setValueState(data.value as T);
      } else {
        // First run for this table: seed the single row with the provided
        // default so future reloads persist real, user-entered data — no
        // demo/dummy content.
        const { error: insertError } = await supabase
          .from(table)
          .insert({ id: 1, value: initialValueRef.current as never });
        // Ignore unique-violation races (another tab/device seeded it a
        // moment earlier — that row arrives here via the subscription
        // above instead).
        if (insertError && insertError.code !== '23505') {
          console.error(`[supabase] Gagal seed data awal untuk tabel "${table}":`, insertError);
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

  const setValue = (next: T | ((prev: T) => T)) => {
    setValueState((prev) => {
      const resolved = typeof next === 'function' ? (next as (prev: T) => T)(prev) : next;
      supabase
        .from(table)
        .upsert({ id: 1, value: resolved as never }, { onConflict: 'id' })
        .then(({ error }) => {
          if (error) console.error(`[supabase] Gagal menyimpan ke tabel "${table}":`, error);
        });
      return resolved;
    });
  };

  return [value, setValue, ready];
}

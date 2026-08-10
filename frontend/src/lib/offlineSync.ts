// Replays everything sitting in the offline queue (lib/offlineQueue.ts)
// back to Supabase, in the order they were queued, once the connection is
// back. Wired up once from App.tsx: on the browser's 'online' event, on
// app load (in case the tab was already open when connectivity returned),
// and on a slow periodic timer as a safety net for flaky connections that
// don't reliably fire 'online'/'offline' events.
import { supabase } from './supabase';
import { getAllOps, removeOp, type PendingOp } from './offlineQueue';

let flushing = false;

async function replayOp(op: PendingOp): Promise<boolean> {
  try {
    if (op.kind === 'table_upsert') {
      const { error } = await supabase.from(op.table).upsert(op.rows as never, { onConflict: 'key' });
      if (error) throw error;
    } else if (op.kind === 'table_delete') {
      const { error } = await supabase.from(op.table).delete().in('key', op.keys);
      if (error) throw error;
    } else if (op.kind === 'singleton_upsert') {
      const { error } = await supabase.from(op.table).upsert({ id: 1, value: op.value as never }, { onConflict: 'id' });
      if (error) throw error;
    }
    return true;
  } catch (err) {
    console.error('[offlineSync] Gagal mengirim ulang perubahan tersimpan:', op, err);
    return false;
  }
}

/**
 * Attempts to send every queued write to Supabase, oldest first. Stops at
 * the first failure (rather than skipping it) so writes to the same row
 * apply in their original order — e.g. a stock decrement queued before a
 * later manual stock edit shouldn't ever be allowed to replay *after* it.
 */
export async function flushOfflineQueue(): Promise<void> {
  if (flushing) return; // already in progress elsewhere (e.g. both the 'online' event and the periodic timer fired close together)
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  flushing = true;
  try {
    const ops = await getAllOps();
    // IndexedDB's autoIncrement keys already come back in insertion order,
    // but sort defensively by id in case that ever changes.
    ops.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

    for (const op of ops) {
      const ok = await replayOp(op);
      if (!ok) break; // leave this and everything after it queued; try again next flush
      if (op.id !== undefined) await removeOp(op.id);
    }
  } finally {
    flushing = false;
  }
}

let initialized = false;

/** Call once from App.tsx to wire up automatic flushing. */
export function initOfflineSync() {
  if (initialized) return;
  initialized = true;

  window.addEventListener('online', () => {
    void flushOfflineQueue();
  });

  // Covers the case where the tab was already open and connectivity came
  // back without a clean 'online' event (happens on some mobile networks),
  // plus retries anything that failed mid-flush for a non-connectivity
  // reason (e.g. a transient Supabase 5xx).
  setInterval(() => {
    void flushOfflineQueue();
  }, 30_000);

  // In case the app loaded already-online with stale queued items from a
  // previous offline session that never got flushed (e.g. tab was closed
  // before reconnecting).
  void flushOfflineQueue();
}

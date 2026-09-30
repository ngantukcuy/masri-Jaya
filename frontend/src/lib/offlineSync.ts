// Replays everything sitting in the offline queue (lib/offlineQueue.ts)
// back to Supabase, in the order they were queued, once the connection is
// back. Wired up once from App.tsx: on the browser's 'online' event, on
// app load (in case the tab was already open when connectivity returned),
// and on a slow periodic timer as a safety net for flaky connections that
// don't reliably fire 'online'/'offline' events.
import './db/repos'; // pastikan semua repo terdaftar sebelum antrian dikirim ulang
import { getRepo } from './db/registry';
import { getAllOps, removeOp, type PendingOp } from './offlineQueue';

let flushing = false;

// Nama tabel versi lama -> nama tabel sekarang.
const LEGACY_TABLE_NAMES: Record<string, string> = { store_owner: 'store_profile' };

type ReplayResult = 'done' | 'retry';

/**
 * Kirim satu perubahan tersimpan.
 *  - 'done'  : sudah terkirim ATAU tidak mungkin dikirim (mis. ditolak database,
 *              format lama yang tak relevan) — op dibuang supaya tidak
 *              memblokir antrian selamanya.
 *  - 'retry' : gangguan jaringan/sementara — biarkan di antrian, coba lagi nanti.
 */
async function replayOp(op: PendingOp): Promise<ReplayResult> {
  try {
    const table = LEGACY_TABLE_NAMES[op.table] ?? op.table;
    const repo = getRepo(table);
    if (!repo) {
      console.warn(`[offlineSync] Tabel "${op.table}" tidak dikenal lagi — perubahan tersimpan dibuang.`, op);
      return 'done';
    }
    switch (op.kind) {
      case 'repo_upsert':
        await repo.persistUpsert(op.items);
        break;
      case 'repo_delete':
      case 'table_delete':
        await repo.persistDelete(op.keys);
        break;
      case 'table_upsert':
        // Format lama: tiap baris = { key, data(JSON objek) }. Kolom yang tidak
        // ada lagi (mis. `pin`) otomatis diabaikan saat dipetakan ke tabel baru.
        await repo.persistUpsert(op.rows.map((r) => r.data));
        break;
      case 'singleton_upsert':
        if (table === 'store_profile' && op.value && typeof op.value === 'object') {
          await repo.persistUpsert([{ ...(op.value as object), id: 'main' }]);
        } else {
          console.warn(`[offlineSync] Data tunggal lama "${op.table}" dibuang (sekarang disimpan per kolom).`);
        }
        break;
    }
    return 'done';
  } catch (err) {
    // Error dari Postgres/PostgREST selalu punya `code`; gangguan jaringan tidak.
    const code = (err as { code?: string } | null)?.code;
    if (code) {
      console.error('[offlineSync] Database menolak perubahan tersimpan — dibuang supaya antrian tidak macet:', op, err);
      return 'done';
    }
    console.error('[offlineSync] Gagal mengirim ulang perubahan tersimpan (akan dicoba lagi):', op, err);
    return 'retry';
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
      const result = await replayOp(op);
      if (result === 'retry') break; // leave this and everything after it queued; try again next flush
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

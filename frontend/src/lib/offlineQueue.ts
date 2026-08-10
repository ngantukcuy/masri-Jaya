// A small IndexedDB-backed queue that holds Supabase writes which failed
// because the device was offline (or the request otherwise errored out).
// Used by useSupabaseTable.ts and useSupabaseState.ts as a safety net: both
// hooks update React state optimistically and fire the Supabase write in
// the background — previously, if that write failed, the change was
// silently lost (just a console.error). Now it lands here instead, and
// offlineSync.ts replays it once the connection comes back.
//
// Raw IndexedDB (no added dependency) — the API is verbose but this file
// is the only place that has to deal with it.

const DB_NAME = 'tokku-offline-queue';
const DB_VERSION = 1;
const STORE_NAME = 'pending_ops';

export type PendingOp =
  | { id?: number; kind: 'table_upsert'; table: string; rows: { key: string; data: unknown }[]; createdAt: number }
  | { id?: number; kind: 'table_delete'; table: string; keys: string[]; createdAt: number }
  | { id?: number; kind: 'singleton_upsert'; table: string; value: unknown; createdAt: number };

// Plain `Omit<PendingOp, 'id'>` collapses the union down to only the
// fields common to every variant (losing `rows`/`keys`/`value`) because
// Omit isn't distributive by default — this variant is.
type DistributiveOmit<T, K extends keyof any> = T extends unknown ? Omit<T, K> : never;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB tidak tersedia di lingkungan ini.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

// UI (Header's offline indicator) listens for this instead of polling.
function broadcastQueueChanged() {
  window.dispatchEvent(new CustomEvent('tokku:offline-queue-changed'));
}

export async function enqueueOp(op: DistributiveOmit<PendingOp, 'id'>): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).add(op);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    broadcastQueueChanged();
  } catch (err) {
    // If IndexedDB itself is unavailable (very old browser, private-mode
    // quota issues, ...), there's nowhere left to put this write — it's
    // genuinely lost, same as before this feature existed. Log loudly.
    console.error('[offlineQueue] Gagal menyimpan perubahan ke antrian offline — perubahan ini HILANG:', op, err);
  }
}

export async function getAllOps(): Promise<PendingOp[]> {
  try {
    const db = await openDb();
    return await new Promise<PendingOp[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result as PendingOp[]);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function removeOp(id: number): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    broadcastQueueChanged();
  } catch (err) {
    console.error('[offlineQueue] Gagal menghapus item dari antrian offline:', id, err);
  }
}

export async function countOps(): Promise<number> {
  try {
    const db = await openDb();
    return await new Promise<number>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return 0;
  }
}

// =============================================================================
// Lapisan database — SATU-SATUNYA tempat frontend bicara ke tabel Supabase.
//
// Cara pakainya sederhana dan eksplisit:
//   BACA  : db.products.snapshot()              (atau useRows(db.products) di komponen)
//   TULIS : db.products.upsert([produk])        -> INSERT/UPDATE baris di tabel `products`
//           db.products.remove(['SKU-1'])       -> DELETE baris
//           db.products.save(daftarBaru)        -> samakan tabel dengan daftar ini (diff)
//
// Tiap entitas = tabel sungguhan dengan kolom sungguhan (lihat spec.json &
// backend/supabase/schema.sql). Array bersarang (item invoice, item PO, dst.)
// = tabel anak sendiri. Tidak ada JSON blob, tidak ada data dummy/seed.
// =============================================================================
import { supabase } from '../supabase';
import { enqueueOp } from '../offlineQueue';
import { registerRepo } from './registry';
import spec from './spec.json';

type ColType = 'text' | 'num' | 'bool' | 'json' | 'text[]';
type Col = [string, ColType];
interface ChildSpec { field: string; table: string; columns: Col[] }
interface TableSpec { table: string; key: string; singleton?: boolean; columns: Col[]; children?: ChildSpec[] }

export const snake = (s: string) =>
  s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2').toLowerCase();

const PAGE_SIZE = 1000; // batas default PostgREST per request
const CHUNK = 400;

// ------------------------------------------------------------------ mapping
function toDbValue(v: unknown, type: ColType): unknown {
  if (v === undefined || v === null) return null;
  if (type === 'num') {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  }
  if (type === 'bool') return Boolean(v);
  if (type === 'text[]') return Array.isArray(v) ? v : null;
  if (type === 'json') return v;
  return String(v);
}

function fromDbValue(v: unknown, type: ColType): unknown {
  if (v === undefined || v === null) return type === 'text[]' ? [] : undefined;
  if (type === 'num' && typeof v === 'string') return Number(v);
  return v;
}

function childRows(ch: ChildSpec, parentKey: string, list: unknown): Record<string, unknown>[] {
  const arr = Array.isArray(list) ? list : [];
  return arr.map((el, position) => {
    const row: Record<string, unknown> = { parent_key: parentKey, position };
    for (const [f, t] of ch.columns) row[snake(f)] = toDbValue((el as Record<string, unknown>)[f], t);
    return row;
  });
}

function childItem(ch: ChildSpec, row: Record<string, unknown>) {
  const item: Record<string, unknown> = {};
  for (const [f, t] of ch.columns) {
    const v = fromDbValue(row[snake(f)], t);
    if (v !== undefined) item[f] = v;
  }
  return item;
}

// ------------------------------------------------------------------- repo
export interface Repo<T> {
  readonly table: string;
  keyOf(item: T): string;
  /** Isi tabel saat ini (referensi array stabil selama tidak ada perubahan). */
  snapshot(): T[];
  isReady(): boolean;
  subscribe(listener: () => void): () => void;
  /** Muat dari database + nyalakan realtime. Aman dipanggil berkali-kali. */
  start(): Promise<void>;
  /** Ambil ulang dari database. */
  reload(): Promise<void>;
  /** INSERT/UPDATE baris ini (berdasarkan primary key). */
  upsert(items: T[]): Promise<void>;
  /** DELETE baris dengan primary key ini. */
  remove(keys: string[]): Promise<void>;
  /** Samakan tabel dengan `next`: baris baru/berubah di-upsert, yang hilang di-delete. */
  save(next: T[]): Promise<void>;
  /** Dipakai antrian offline: tulis langsung ke database, lempar error kalau gagal. */
  persistUpsert(items: T[]): Promise<void>;
  persistDelete(keys: string[]): Promise<void>;
}

const tableSpecs = new Map<string, TableSpec>((spec.tables as TableSpec[]).map((t) => [t.table, t]));

export function createRepo<T>(table: string): Repo<T> {
  const ts = tableSpecs.get(table);
  if (!ts) throw new Error(`[db] Tabel "${table}" tidak ada di spec.json`);
  const keyCol = snake(ts.key);
  const children = ts.children ?? [];
  const selectExpr = ['*', ...children.map((c) => `${c.table}(*)`)].join(', ');

  let rows: T[] = [];
  let ready = false;
  let started: Promise<void> | null = null;
  let pendingWrites = 0;
  let reloadTimer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<() => void>();
  const keyOf = (item: T) => String((item as Record<string, unknown>)[ts.key] ?? '');
  // Sengaja TIDAK di-cache: kode lain bisa saja mengubah objek baris di tempat,
  // dan sidik jari basi akan membuat perubahan tidak pernah tersimpan.
  const fingerprint = (item: T) => JSON.stringify(item);
  let dirtyWhileHidden = false;

  const emit = () => listeners.forEach((l) => l());
  const setRows = (next: T[]) => { rows = next; emit(); };

  function rowToItem(row: Record<string, unknown>): T {
    const item: Record<string, unknown> = { [ts!.key]: row[keyCol] };
    for (const [f, t] of ts!.columns) {
      const v = fromDbValue(row[snake(f)], t);
      if (v !== undefined) item[f] = v;
    }
    for (const ch of children) {
      const list = (row[ch.table] as Record<string, unknown>[] | null) ?? [];
      item[ch.field] = list
        .slice()
        .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
        .map((r) => childItem(ch, r));
    }
    return item as T;
  }

  function itemToRow(item: T): Record<string, unknown> {
    const src = item as Record<string, unknown>;
    const row: Record<string, unknown> = { [keyCol]: keyOf(item) };
    for (const [f, t] of ts!.columns) row[snake(f)] = toDbValue(src[f], t);
    return row;
  }

  async function fetchAll(): Promise<T[]> {
    const out: T[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from(table)
        .select(selectExpr)
        .order('db_created_at', { ascending: true })
        .order(keyCol, { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      const page = (data ?? []) as unknown as Record<string, unknown>[];
      out.push(...page.map(rowToItem));
      if (page.length < PAGE_SIZE) break;
    }
    return out;
  }

  // Baca ulang seluruh tabel, tapi pertahankan OBJEK LAMA untuk baris yang
  // isinya tidak berubah, dan jangan memicu render sama sekali kalau tidak
  // ada yang berubah. Sebelumnya setiap event realtime (termasuk "gema" dari
  // tulisan kita sendiri) mengganti seluruh array dan menggambar ulang semua
  // daftar yang membaca tabel ini.
  async function reload() {
    try {
      const fetched = await fetchAll();
      if (!ready) {
        setRows(fetched);
      } else {
        const prev = new Map(rows.map((r) => [keyOf(r), r]));
        let changed = fetched.length !== rows.length;
        const merged = fetched.map((item, i) => {
          const old = prev.get(keyOf(item));
          if (old !== undefined && fingerprint(old) === fingerprint(item)) {
            if (rows[i] !== old) changed = true; // urutan berubah
            return old;
          }
          changed = true;
          return item;
        });
        if (changed) setRows(merged);
      }
    } catch (err) {
      console.error(`[db] Gagal membaca tabel "${table}":`, err);
    } finally {
      if (!ready) { ready = true; emit(); }
    }
  }

  function scheduleReload() {
    if (reloadTimer) clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      // Jangan timpa perubahan lokal yang belum selesai ditulis.
      if (pendingWrites > 0) { scheduleReload(); return; }
      // App di latar belakang / tab tersembunyi: tunda sampai terlihat lagi
      // supaya tidak membuang baterai dan CPU untuk layar yang tak dilihat.
      if (typeof document !== 'undefined' && document.hidden) { dirtyWhileHidden = true; return; }
      void reload();
    }, 800);
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && dirtyWhileHidden) {
        dirtyWhileHidden = false;
        scheduleReload();
      }
    });
  }

  function listenRealtime() {
    let channel = supabase.channel(`db:${table}:${Math.random().toString(36).slice(2)}`);
    for (const name of [table, ...children.map((c) => c.table)]) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: name }, scheduleReload);
    }
    channel.subscribe();
  }

  async function persistUpsert(items: T[]) {
    if (items.length === 0) return;
    for (let i = 0; i < items.length; i += CHUNK) {
      const part = items.slice(i, i + CHUNK);
      const { error } = await supabase.from(table).upsert(part.map(itemToRow) as never, { onConflict: keyCol });
      if (error) throw error;
      const keys = part.map(keyOf);
      for (const ch of children) {
        const childPayload = part.flatMap((it) => childRows(ch, keyOf(it), (it as Record<string, unknown>)[ch.field]));
        const { error: childError } = await supabase.rpc('replace_children', {
          p_table: ch.table,
          p_parent_keys: keys,
          p_rows: childPayload,
        });
        if (childError) throw childError;
      }
    }
  }

  async function persistDelete(keys: string[]) {
    for (let i = 0; i < keys.length; i += CHUNK) {
      const { error } = await supabase.from(table).delete().in(keyCol, keys.slice(i, i + CHUNK));
      if (error) throw error;
    }
  }

  // Kalau tulis gagal karena jaringan -> antrikan & kirim ulang nanti.
  // Kalau ditolak database (constraint/permission) -> jangan diantrikan
  // (bakal gagal terus & memblokir antrian), cukup laporkan.
  async function guarded(op: () => Promise<void>, queue: () => Promise<void>) {
    pendingWrites++;
    try {
      await op();
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      const isNetwork = !code || code === '' || (typeof navigator !== 'undefined' && navigator.onLine === false);
      if (isNetwork) {
        console.warn(`[db] Gagal menyimpan ke "${table}", masuk antrian offline:`, err);
        await queue();
      } else {
        console.error(`[db] Database menolak perubahan di "${table}":`, err);
        window.dispatchEvent(new CustomEvent('tokku:db-error', { detail: { table, error: err } }));
      }
    } finally {
      pendingWrites--;
    }
  }

  const repo: Repo<T> = {
    table,
    keyOf,
    snapshot: () => rows,
    isReady: () => ready,
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    start() {
      if (!started) {
        listenRealtime();
        started = reload();
      }
      return started;
    },
    reload,
    persistUpsert,
    persistDelete,

    async upsert(items) {
      if (items.length === 0) return;
      const byKey = new Map(items.map((it) => [keyOf(it), it]));
      const merged = rows.map((r) => byKey.get(keyOf(r)) ?? r);
      const existing = new Set(rows.map(keyOf));
      byKey.forEach((it, k) => { if (!existing.has(k)) merged.push(it); });
      setRows(merged);
      await guarded(
        () => persistUpsert(items),
        () => enqueueOp({ kind: 'repo_upsert', table, items, createdAt: Date.now() })
      );
    },

    async remove(keys) {
      if (keys.length === 0) return;
      const gone = new Set(keys);
      setRows(rows.filter((r) => !gone.has(keyOf(r))));
      await guarded(
        () => persistDelete(keys),
        () => enqueueOp({ kind: 'repo_delete', table, keys, createdAt: Date.now() })
      );
    },

    async save(next) {
      const before = new Map(rows.map((r) => [keyOf(r), fingerprint(r)]));
      const nextKeys = new Set(next.map(keyOf));
      const changed = next.filter((it) => before.get(keyOf(it)) !== fingerprint(it));
      const removed = [...before.keys()].filter((k) => !nextKeys.has(k));
      setRows(next);
      if (changed.length > 0) {
        await guarded(
          () => persistUpsert(changed),
          () => enqueueOp({ kind: 'repo_upsert', table, items: changed, createdAt: Date.now() })
        );
      }
      if (removed.length > 0) {
        await guarded(
          () => persistDelete(removed),
          () => enqueueOp({ kind: 'repo_delete', table, keys: removed, createdAt: Date.now() })
        );
      }
    },
  };

  registerRepo(repo as Repo<unknown>);
  return repo;
}

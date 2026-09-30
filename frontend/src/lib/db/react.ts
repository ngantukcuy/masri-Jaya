import { useEffect, useSyncExternalStore } from 'react';
import type { Repo } from './core';

/**
 * Baca isi sebuah tabel di komponen (READ-ONLY). Hook ini cuma "mendengarkan"
 * database — tidak ada salinan yang kamu ubah-ubah. Untuk menulis, panggil
 * fungsi repo langsung, mis. `db.products.upsert([...])`.
 */
export function useRows<T>(repo: Repo<T>): T[] {
  useEffect(() => { void repo.start(); }, [repo]);
  return useSyncExternalStore(repo.subscribe, repo.snapshot);
}

/** True setelah pembacaan pertama dari database selesai (berhasil atau tidak). */
export function useRepoReady<T>(repo: Repo<T>): boolean {
  useEffect(() => { void repo.start(); }, [repo]);
  return useSyncExternalStore(repo.subscribe, repo.isReady);
}

import type { Repo } from './core';

// Daftar semua repo yang sudah dibuat — dipakai antrian offline & reset data
// untuk menemukan repo dari nama tabelnya.
const registry = new Map<string, Repo<unknown>>();

export function registerRepo(repo: Repo<unknown>) {
  registry.set(repo.table, repo);
}

export function getRepo(table: string): Repo<unknown> | undefined {
  return registry.get(table);
}

export function allRepos(): Repo<unknown>[] {
  return [...registry.values()];
}

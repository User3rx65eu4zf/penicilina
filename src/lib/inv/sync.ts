import type { DB, Role } from './types';

export type Snapshot = { data: DB; version: number };
export interface Repository {
  read(): Promise<Snapshot>;
  save(expected: number, data: DB, action: string, duration: number): Promise<number | null>;
}

/** Rebase each action on the latest committed state; a failed CAS changes nothing. */
export async function transact<T>(repo: Repository, role: Role, action: (db: DB) => T, label: string) {
  const started = performance.now();
  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await repo.read();
    const draft = structuredClone(current.data);
    draft.currentRole = role;
    const result = action(draft);
    const version = await repo.save(current.version, draft, label, Math.round(performance.now() - started));
    if (version !== null) return { result, snapshot: { data: draft, version } };
  }
  throw new Error('Hay varias operaciones simultáneas. Vuelva a intentarlo.');
}
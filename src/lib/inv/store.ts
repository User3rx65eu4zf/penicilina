import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { buildSeed } from "./seed";
import { BusinessError, syncTransferAlerts } from "./logic";
import type { DB } from "./types";

/**
 * Repository layer. Persists the whole DB in localStorage.
 * To migrate to a backend, replace load/save with API calls; actions in logic.ts stay the same.
 */
const KEY = "vega-inventario-db-v1";
let state: DB | null = null;
const listeners = new Set<() => void>();

function load(): DB {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = JSON.parse(raw) as DB;
  } catch { /* ignore */ }
  if (!state) { state = buildSeed(); save(); }
  syncTransferAlerts(state);
  return state;
}
function save() { if (state) localStorage.setItem(KEY, JSON.stringify(state)); }
function emit() { listeners.forEach((l) => l()); }

export function useDB(): DB {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    load,
    () => { throw new Error("DB is client-only"); },
  );
}

/** Runs an action transactionally: either all changes apply or none. Returns true on success. */
export function run<T>(fn: (db: DB) => T, success?: string): T | undefined {
  const draft = structuredClone(load());
  try {
    const res = fn(draft);
    state = draft; save(); emit();
    if (success) toast.success(success);
    return res;
  } catch (e) {
    toast.error(e instanceof BusinessError ? e.message : `Error: ${(e as Error).message}`);
    return undefined;
  }
}

export function resetDemo() { state = buildSeed(); save(); emit(); toast.success("Datos de demostración restablecidos"); }

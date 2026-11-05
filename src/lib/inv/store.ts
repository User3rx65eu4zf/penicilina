import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { buildSeed } from "./seed";
import { BusinessError, syncTransferAlerts } from "./logic";
import { ROLES, USERS, type DB, type Role } from "./types";
import { supabase } from '@/integrations/supabase/client';
import type { Json, Tables } from '@/integrations/supabase/types';
import { transact, type Repository } from './sync';

const KEY = "vega-inventario-db-v1";
const ROLE_KEY = 'vega-inventario-role';
let state: DB | null = null;
const listeners = new Set<() => void>();
let cloudVersion = -1;
let role: Role = 'Administrador';
type SyncStatus = 'loading' | 'ready' | 'saving' | 'offline' | 'uninitialized';
let status: SyncStatus = 'loading';
let operations: Tables<'operation_log'>[] = [];
let queue = Promise.resolve();

function load(): DB {
  if (!state) throw new Error('El inventario aún no está conectado');
  return state;
}
function emit() { listeners.forEach((l) => l()); }
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export function useSyncStatus() { return useSyncExternalStore(subscribe, () => status, () => 'loading' as SyncStatus); }
export function useOperations() { return useSyncExternalStore(subscribe, () => operations, () => operations); }

function accept(data: DB, version: number) {
  if (version < cloudVersion) return;
  cloudVersion = version;
  state = { ...data, currentRole: role };
  syncTransferAlerts(state);
  emit();
}
const repository: Repository = {
  async read() {
    const { data, error } = await supabase.from('inventory_state').select('data,version').eq('id', 1).single();
    if (error) throw error;
    if (!data.data) throw new Error('Comparta primero el inventario de este dispositivo');
    return { data: data.data as unknown as DB, version: data.version };
  },
  async save(expected, data, action, duration) {
    const { data: version, error } = await supabase.rpc('save_inventory_operation', {
      _expected: expected, _data: data as unknown as Json, _action: action, _duration: duration,
    });
    if (error) throw error;
    return version;
  },
};
export async function refreshShared() {
  try {
    const { data, error } = await supabase.from('inventory_state').select('data,version').eq('id', 1).single();
    if (error) throw error;
    if (data.data) { accept(data.data as unknown as DB, data.version); if (status !== 'saving') status = 'ready'; }
    else status = 'uninitialized';
    const logs = await supabase.from('operation_log').select('*').gte('created_at', new Date(Date.now() - 30 * 864e5).toISOString()).order('created_at', { ascending: false }).limit(10000);
    if (logs.error) throw logs.error;
    operations = logs.data;
  } catch { status = 'offline'; }
  emit();
}
export function connectShared() {
  const savedRole = localStorage.getItem(ROLE_KEY);
  if (ROLES.includes(savedRole as Role)) role = savedRole as Role;
  void refreshShared();
  const channel = supabase.channel(`inventory-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_state' }, () => { void refreshShared(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'operation_log' }, () => { void refreshShared(); })
    .subscribe();
  const poll = window.setInterval(() => { void refreshShared(); }, 10000);
  const onFocus = () => { void refreshShared(); };
  window.addEventListener('online', onFocus);
  window.addEventListener('focus', onFocus);
  return () => { void supabase.removeChannel(channel); clearInterval(poll); window.removeEventListener('online', onFocus); window.removeEventListener('focus', onFocus); };
}
export function setLocalRole(value: Role) {
  role = value; localStorage.setItem(ROLE_KEY, value);
  if (state) state = { ...state, currentRole: role };
  emit();
}
export async function shareLocalInventory() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) { toast.error('Este dispositivo no tiene inventario guardado para compartir. Abra la aplicación desde el dispositivo donde hizo los movimientos.'); return; }
    const local = JSON.parse(raw) as DB;
    const { data, error } = await supabase.rpc('save_inventory_state', { _expected: 0, _data: local as unknown as Json });
    if (error) throw error;
    if (data === null) toast.info('Ya existe un inventario compartido; se cargará sin sobrescribirlo.');
    await refreshShared();
  } catch { toast.error('No se pudo compartir el inventario. Inténtelo de nuevo.'); }
}

export function useDB(): DB {
  return useSyncExternalStore(
    subscribe,
    load,
    () => { throw new Error("DB is client-only"); },
  );
}

/** All UI mutations wait for a cloud commit, never optimistic local-only success. */
export function run<T>(fn: (db: DB) => T, success?: string): Promise<T | undefined> {
  const actor = role;
  const task = queue.then(async () => {
    status = 'saving'; emit();
    try {
      const { result, snapshot } = await transact(repository, actor, fn, success ?? 'Operación de inventario');
      accept(snapshot.data, snapshot.version);
      status = 'ready'; emit();
      if (success) toast.success(success);
      void refreshShared();
      return result;
    } catch (e) {
      const message = e instanceof BusinessError || e instanceof Error ? e.message : 'No se pudo guardar';
      await supabase.from('operation_log').insert({ action: (success ?? 'Operación de inventario').slice(0,80), ok: false, duration_ms: 0, user_name: USERS[actor], role: actor, error: message.slice(0,300) });
      toast.error(e instanceof BusinessError ? message : 'No se guardó la operación. Revise la conexión e inténtelo de nuevo.');
      await refreshShared();
      return undefined;
    }
  });
  queue = task.then(() => undefined, () => undefined);
  return task;
}

export async function resetDemo() { return run((db) => { Object.assign(db, buildSeed(), { currentRole: role }); }, 'Datos de demostración restablecidos'); }

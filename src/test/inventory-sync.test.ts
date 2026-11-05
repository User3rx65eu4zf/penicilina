import { describe, expect, it } from 'vitest';
import { buildSeed } from '@/lib/inv/seed';
import { transact, type Repository } from '@/lib/inv/sync';
import { registerMovement, getRow } from '@/lib/inv/logic';
import { qualityMetrics } from '@/lib/inv/quality';

function memoryRepository() {
  let snapshot = { data: buildSeed(), version: 1 };
  const repo: Repository = {
    async read() { return structuredClone(snapshot); },
    async save(expected, data) {
      if (expected !== snapshot.version) return null;
      snapshot = { data: structuredClone(data), version: expected + 1 };
      return snapshot.version;
    },
  };
  return repo;
}
describe('Shared inventory', () => {
  it('keeps both simultaneous movements and their own actors', async () => {
    const repo = memoryRepository();
    const before = getRow((await repo.read()).data, 'p1', 'cd').stock;
    const action = (quantity: number) => (db: Parameters<typeof registerMovement>[0]) => registerMovement(db, { productId:'p1', locationId:'cd', type:'Entrada', quantity, reason:'Prueba concurrente' });
    await Promise.all([transact(repo,'Supervisor',action(3),'entrada'),transact(repo,'Encargado de almacén',action(7),'entrada')]);
    const db = (await repo.read()).data;
    expect(getRow(db,'p1','cd').stock).toBe(before + 10);
    expect(db.movements[0]?.role).toBe('Encargado de almacén');
    expect(db.movements[1]?.role).toBe('Supervisor');
  });
  it('revalidates availability after another person consumes the stock', async () => {
    const repo = memoryRepository();
    const before = getRow((await repo.read()).data,'p1','norte').stock;
    const action = (db: Parameters<typeof registerMovement>[0]) => registerMovement(db,{productId:'p1',locationId:'norte',type:'Salida',quantity:before,reason:'Salida simultánea'});
    const results = await Promise.allSettled([transact(repo,'Supervisor',action,'salida'),transact(repo,'Supervisor',action,'salida')]);
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    expect(getRow((await repo.read()).data,'p1','norte').stock).toBe(0);
  });
  it('derives dashboard metrics from the same committed movement and period', async () => {
    const repo = memoryRepository();
    await transact(repo,'Supervisor',db=>registerMovement(db,{ productId:'p1',locationId:'cd',type:'Entrada',quantity:3,reason:'Dashboard'}),'entrada');
    const now = Date.now();
    const logs = [0, 2*864e5].map((age,i)=>({id:String(i),action:'Entrada',ok:i===0,duration_ms:120,user_name:'Carmen Rojas',role:'Supervisor',error:null,created_at:new Date(now-age).toISOString()}));
    const today = qualityMetrics((await repo.read()).data,logs,'24h',now);
    expect(today.total).toBe(1);
    expect(today.successRate).toBe(100);
    expect(today.inconsistent).toBe(0);
    expect(today.traceRate).toBe(100);
    expect(qualityMetrics((await repo.read()).data,logs,'7d',now).successRate).toBe(50);
  });
});
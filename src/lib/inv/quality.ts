import type { DB } from './types';
import type { Tables } from '@/integrations/supabase/types';

export function qualityMetrics(db: DB, logs: Tables<'operation_log'>[], period: string, now = Date.now()) {
  const hours = period === '7d' ? 168 : period === '30d' ? 720 : 24;
  const start = now - hours * 36e5;
  const selected = logs.filter(l => Date.parse(l.created_at) >= start && Date.parse(l.created_at) <= now);
  const moves = db.movements.filter(m => Date.parse(m.date) >= start && Date.parse(m.date) <= now);
  const success = selected.filter(l => l.ok).length;
  const percentile = (values: number[], p: number) => values.length ? [...values].sort((a,b) => a-b)[Math.ceil(values.length*p)-1] ?? null : null;
  const bucketCount = hours === 24 ? 24 : hours / 24;
  const bucketMs = hours === 24 ? 36e5 : 864e5;
  const buckets = Array.from({ length: bucketCount }, (_, i) => {
    const from = start + i * bucketMs;
    const group = selected.filter(l => Date.parse(l.created_at) >= from && Date.parse(l.created_at) < from + bucketMs);
    const times = group.filter(l => l.ok).map(l => l.duration_ms);
    return { h: new Date(from).toLocaleString('es-PE', hours === 24 ? { hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: '2-digit' }), ok: group.filter(l => l.ok).length, fail: group.filter(l => !l.ok).length, p95: percentile(times,.95), p99: percentile(times,.99) };
  });
  const inconsistent = db.inventory.filter(row => {
    const balance = db.movements.filter(m => m.productId === row.productId && m.locationId === row.locationId).reduce((n,m) => n + (m.direction === 'in' ? m.quantity : -m.quantity),0);
    return row.stock !== balance || row.stock < 0 || row.reserved < 0 || row.reserved > row.stock;
  }).length;
  const traced = moves.filter(m => m.user && m.role && db.audit.some(a => a.entityId === m.code || a.entityId === db.transfers.find(t => t.id === m.refId)?.code || a.entityId === db.reconciliations.find(r => r.id === m.refId)?.code)).length;
  return { selected, buckets, inconsistent, success, total: selected.length, successRate: selected.length ? 100*success/selected.length : null, traceRate: moves.length ? 100*traced/moves.length : null, moves: moves.length, p95: percentile(selected.filter(l=>l.ok).map(l=>l.duration_ms),.95), alerts: db.alerts.filter(a => Date.parse(a.updatedAt) >= start).slice(0,10) };
}
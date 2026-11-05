import { createFileRoute, Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useDB } from "@/lib/inv/store";
import { inventoryView, pName, STATUSES } from "@/lib/inv/selectors";
import { locName } from "@/lib/inv/logic";
import { Empty, fmtDate, Kpi, PageHeader, Panel, Pill, TableWrap } from "@/components/inv/ui";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard · Inventario Corporación Vega" },
      { name: "description", content: "Indicadores en tiempo real del inventario distribuido de Corporación Vega." },
      { property: "og:title", content: "Dashboard · Inventario Corporación Vega" },
      { property: "og:description", content: "Indicadores en tiempo real del inventario distribuido." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

const STATUS_COLORS: Record<string, string> = { Normal: "var(--chart-1)", Bajo: "var(--chart-2)", "Crítico": "var(--chart-3)", "Sin stock": "var(--chart-4)" };

function Dashboard() {
  const db = useDB();
  const inv = inventoryView(db).filter((r) => r.active);
  const products = db.products.filter((p) => p.active);
  const worstByProduct = (s: string) => new Set(inv.filter((r) => r.status === s).map((r) => r.productId)).size;
  const pendingRecon = db.reconciliations.filter((r) => r.status === "Pendiente" || r.status === "En revisión");
  const pendingTransfers = db.transfers.filter((t) => t.status === "Pendiente" || t.status === "En tránsito");
  const activeAlerts = db.alerts.filter((a) => a.status !== "Resuelta");
  const lossUnits = db.losses.reduce((s, l) => s + l.quantity, 0);

  const byStatus = STATUSES.map((s) => ({ name: s, value: inv.filter((r) => r.status === s).length }));
  const byLocation = db.locations.map((l) => {
    const rows = inv.filter((r) => r.locationId === l.id);
    return { name: l.name, ...Object.fromEntries(STATUSES.map((s) => [s, rows.filter((r) => r.status === s).length])) };
  });
  const risk = inv.filter((r) => r.status !== "Normal").sort((a, b) => a.stock / Math.max(1, a.minStock) - b.stock / Math.max(1, b.minStock)).slice(0, 8);
  const biggestDiff = pendingRecon.slice().sort((a, b) => Math.abs(b.originalDifference) - Math.abs(a.originalDifference)).slice(0, 5);

  return (
    <>
      <PageHeader title="Dashboard" description="Indicadores calculados a partir de los datos actuales del sistema." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Productos activos" value={products.length} />
        <Kpi label="Sin stock" value={worstByProduct("Sin stock")} tone="danger" hint="productos con ≥1 sede en cero" />
        <Kpi label="Críticos" value={worstByProduct("Crítico")} tone="critical" hint="productos con ≥1 sede crítica" />
        <Kpi label="Stock bajo" value={worstByProduct("Bajo")} tone="warning" hint="productos con ≥1 sede baja" />
        <Kpi label="Diferencias pendientes" value={pendingRecon.length} tone="info" />
        <Kpi label="Transferencias abiertas" value={pendingTransfers.length} tone="info" hint="pendientes o en tránsito" />
        <Kpi label="Alertas activas" value={activeAlerts.length} tone="danger" />
        <Kpi label="Mermas acumuladas" value={lossUnits} tone="muted" hint={`${db.losses.length} registros`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Combinaciones producto-sede por estado">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byStatus}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" fontSize={12} /><YAxis allowDecimals={false} fontSize={12} /><Tooltip />
              <Bar dataKey="value" name="Registros" radius={[4, 4, 0, 0]}>
                {byStatus.map((d) => <Cell key={d.name} fill={STATUS_COLORS[d.name]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Estado de inventario por sede">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byLocation}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" fontSize={12} /><YAxis allowDecimals={false} fontSize={12} /><Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} />
              {STATUSES.map((s) => <Bar key={s} dataKey={s} stackId="a" fill={STATUS_COLORS[s]} />)}
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Productos con riesgo de quiebre" actions={<Link to="/inventario" className="text-xs text-primary hover:underline">Ver inventario</Link>}>
          {risk.length === 0 ? <Empty>Sin riesgos detectados</Empty> : (
            <TableWrap>
              <thead><tr><th>Producto</th><th>Sede</th><th className="num">Stock</th><th className="num">Mín.</th><th>Estado</th></tr></thead>
              <tbody>{risk.map((r) => (
                <tr key={r.id}>
                  <td><Link to="/productos/$id" params={{ id: r.productId }} className="font-medium text-primary hover:underline">{r.product}</Link></td>
                  <td>{r.location}</td><td className="num">{r.stock}</td><td className="num">{r.minStock}</td><td><Pill>{r.status}</Pill></td>
                </tr>
              ))}</tbody>
            </TableWrap>
          )}
        </Panel>
        <Panel title="Alertas recientes" actions={<Link to="/alertas" className="text-xs text-primary hover:underline">Ver todas</Link>}>
          {activeAlerts.length === 0 ? <Empty>Sin alertas activas</Empty> : (
            <ul className="divide-y">{activeAlerts.slice(0, 7).map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                <div><div className="font-medium">{a.type}</div><div className="text-muted-foreground">{a.message}</div></div>
                <div className="flex shrink-0 gap-1"><Pill>{a.priority}</Pill><Pill>{a.status}</Pill></div>
              </li>
            ))}</ul>
          )}
        </Panel>
        <Panel title="Últimos movimientos" actions={<Link to="/movimientos" className="text-xs text-primary hover:underline">Ver todos</Link>}>
          <TableWrap>
            <thead><tr><th>Fecha</th><th>Tipo</th><th>Producto</th><th>Sede</th><th className="num">Cant.</th></tr></thead>
            <tbody>{db.movements.slice(0, 8).map((m) => (
              <tr key={m.id}><td className="whitespace-nowrap text-xs">{fmtDate(m.date)}</td><td>{m.type}</td><td>{pName(db, m.productId)}</td>
                <td>{locName(db, m.locationId)}</td><td className="num">{m.direction === "in" ? "+" : "−"}{m.quantity}</td></tr>
            ))}</tbody>
          </TableWrap>
        </Panel>
        <Panel title="Mayores diferencias pendientes" actions={<Link to="/conciliaciones" className="text-xs text-primary hover:underline">Conciliar</Link>}>
          {biggestDiff.length === 0 ? <Empty>No hay diferencias pendientes</Empty> : (
            <TableWrap>
              <thead><tr><th>Código</th><th>Producto</th><th>Sede</th><th className="num">Dif.</th><th>Estado</th></tr></thead>
              <tbody>{biggestDiff.map((r) => (
                <tr key={r.id}><td className="font-mono text-xs">{r.code}</td><td>{pName(db, r.productId)}</td><td>{locName(db, r.locationId)}</td>
                  <td className="num">{r.originalDifference > 0 ? "+" : ""}{r.originalDifference}</td><td><Pill>{r.status}</Pill></td></tr>
              ))}</tbody>
            </TableWrap>
          )}
        </Panel>
      </div>
    </>
  );
}

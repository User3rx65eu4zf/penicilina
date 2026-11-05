import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Truck, BookOpen, ClipboardCheck } from "lucide-react";
import { useDB } from "@/lib/inv/store";
import { inventoryView } from "@/lib/inv/selectors";
import { locName } from "@/lib/inv/logic";
import { Button } from "@/components/ui/button";
import { Empty, fmtDate, PageHeader, Panel, Pill, TableWrap } from "@/components/inv/ui";

export const Route = createFileRoute("/productos/$id")({
  head: () => ({ meta: [{ title: "Detalle de producto · Inventario Vega" }, { name: "description", content: "Stock por sede, alertas y movimientos del producto." },
    { property: "og:title", content: "Detalle de producto · Inventario Vega" }, { property: "og:description", content: "Stock por sede del producto." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: ProductDetail,
});

function ProductDetail() {
  const { id } = Route.useParams();
  const db = useDB();
  const p = db.products.find((x) => x.id === id);
  if (!p) return <Empty>Producto no encontrado. <Link to="/productos" className="text-primary underline">Volver</Link></Empty>;
  const rows = inventoryView(db).filter((r) => r.productId === id);
  const cd = db.locations.find((l) => l.type === "CD")!;
  const alerts = db.alerts.filter((a) => a.productId === id && a.status !== "Resuelta");
  const transfers = db.transfers.filter((t) => t.productId === id).slice(0, 6);
  const moves = db.movements.filter((m) => m.productId === id).slice(0, 10);
  return (
    <>
      <Link to="/productos" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Productos</Link>
      <PageHeader title={p.name} description={`${p.sku} · ${db.categories.find((c) => c.id === p.categoryId)?.name} · ${p.unit} · mín. ${p.minStock} / objetivo ${p.targetStock} por sede`}
        actions={<Pill tone={p.active ? "success" : "muted"}>{p.active ? "Activo" : "Inactivo"}</Pill>} />
      <Panel title="Stock por sede">
        <TableWrap>
          <thead><tr><th>Sede</th><th className="num">Stock sistema</th><th className="num">Reservado</th><th className="num">Disponible</th><th className="num">Físico</th><th className="num">Dif.</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}>
              <td className="font-medium">{r.location}</td><td className="num">{r.stock}</td><td className="num">{r.reserved}</td><td className="num">{r.available}</td>
              <td className="num">{r.physical ?? "—"}</td><td className="num">{r.difference ?? "—"}</td><td><Pill>{r.status}</Pill></td>
              <td className="flex flex-wrap gap-1">
                {r.locationId !== cd.id && (
                  <Button asChild size="sm" variant={r.status === "Normal" ? "outline" : "default"}>
                    <Link to="/transferencias" search={{ productId: id, toId: r.locationId, qty: Math.max(1, r.targetStock - r.stock) }}><Truck className="mr-1 h-3.5 w-3.5" />Reponer desde {cd.name}</Link>
                  </Button>
                )}
                <Button asChild size="sm" variant="ghost"><Link to="/conteos" search={{ productId: id, locationId: r.locationId }}><ClipboardCheck className="mr-1 h-3.5 w-3.5" />Contar</Link></Button>
                <Button asChild size="sm" variant="ghost"><Link to="/kardex" search={{ productId: id, locationId: r.locationId }}><BookOpen className="mr-1 h-3.5 w-3.5" />Kardex</Link></Button>
              </td>
            </tr>
          ))}</tbody>
        </TableWrap>
      </Panel>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Alertas activas">
          {alerts.length === 0 ? <Empty>Sin alertas activas</Empty> : <ul className="divide-y text-sm">{alerts.map((a) => (
            <li key={a.id} className="flex justify-between gap-2 py-2"><span><b>{a.type}</b> · {locName(db, a.locationId)}</span><span className="flex gap-1"><Pill>{a.priority}</Pill><Pill>{a.status}</Pill></span></li>))}</ul>}
        </Panel>
        <Panel title="Transferencias">
          {transfers.length === 0 ? <Empty>Sin transferencias</Empty> : <ul className="divide-y text-sm">{transfers.map((t) => (
            <li key={t.id} className="flex justify-between gap-2 py-2"><span className="font-mono text-xs">{t.code}</span><span>{locName(db, t.fromId)} → {locName(db, t.toId)} · {t.quantity}</span><Pill>{t.status}</Pill></li>))}</ul>}
        </Panel>
      </div>
      <Panel title="Últimos movimientos" className="mt-6">
        <TableWrap>
          <thead><tr><th>Fecha</th><th>Código</th><th>Tipo</th><th>Sede</th><th className="num">Cant.</th><th className="num">Saldo</th><th>Responsable</th></tr></thead>
          <tbody>{moves.map((m) => (
            <tr key={m.id}><td className="text-xs">{fmtDate(m.date)}</td><td className="font-mono text-xs">{m.code}</td><td>{m.type}</td><td>{locName(db, m.locationId)}</td>
              <td className="num">{m.direction === "in" ? "+" : "−"}{m.quantity}</td><td className="num">{m.before} → {m.after}</td><td className="text-xs">{m.user}<br /><span className="text-muted-foreground">{m.role}</span></td></tr>
          ))}</tbody>
        </TableWrap>
      </Panel>
    </>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useDB } from "@/lib/inv/store";
import { inventoryView, pName } from "@/lib/inv/selectors";
import { locName } from "@/lib/inv/logic";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CsvButton, Field, fmtDate, PageHeader, Panel, Pill, TableWrap } from "@/components/inv/ui";

export const Route = createFileRoute("/reportes")({
  head: () => ({ meta: [{ title: "Reportes · Inventario Vega" }, { name: "description", content: "Reportes de stock, movimientos, diferencias, mermas y transferencias con exportación CSV." },
    { property: "og:title", content: "Reportes · Inventario Vega" }, { property: "og:description", content: "Reportes de inventario." }] }),
  component: Reportes,
});

type Cell = string | number | null;
function Report({ name, head, rows, render }: { name: string; head: string[]; rows: Cell[][]; render?: (r: Cell[], i: number) => ReactNode }) {
  return (
    <Panel title={`${rows.length} filas`} actions={<CsvButton name={name} rows={() => [head, ...rows]} />}>
      <TableWrap>
        <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => render ? render(r, i) : <tr key={i}>{r.map((c, j) => <td key={j} className={typeof c === "number" ? "num" : ""}>{c ?? "—"}</td>)}</tr>)}</tbody>
      </TableWrap>
    </Panel>
  );
}

function Reportes() {
  const db = useDB();
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const inv = inventoryView(db).filter((r) => r.active);
  const stockByLoc = db.locations.map((l) => {
    const rows = inv.filter((r) => r.locationId === l.id);
    return [l.name, rows.reduce((s, r) => s + r.stock, 0), rows.reduce((s, r) => s + r.reserved, 0),
      rows.filter((r) => r.status === "Normal").length, rows.filter((r) => r.status === "Bajo").length, rows.filter((r) => r.status === "Crítico").length, rows.filter((r) => r.status === "Sin stock").length];
  });
  const moves = db.movements.filter((m) => m.date.slice(0, 10) >= from && m.date.slice(0, 10) <= to);
  const kardexAll = db.movements.slice().reverse();
  return (
    <>
      <PageHeader title="Reportes" description="Generados a partir de los datos actuales." />
      <Tabs defaultValue="stock">
        <TabsList className="mb-4 flex-wrap">
          {["stock", "movimientos", "criticos", "diferencias", "mermas", "transferencias", "kardex"].map((t) => <TabsTrigger key={t} value={t} className="capitalize">{t === "criticos" ? "Críticos" : t}</TabsTrigger>)}
        </TabsList>
        <TabsContent value="stock"><Report name="stock-por-sede" head={["Sede", "Unidades", "Reservado", "Normal", "Bajo", "Crítico", "Sin stock"]} rows={stockByLoc} /></TabsContent>
        <TabsContent value="movimientos">
          <div className="mb-4 flex gap-3"><Field label="Desde"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field><Field label="Hasta"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field></div>
          <Report name="movimientos-periodo" head={["Fecha", "Código", "Tipo", "Producto", "Sede", "Cantidad", "Saldo post.", "Responsable"]}
            rows={moves.map((m) => [fmtDate(m.date), m.code, m.type, pName(db, m.productId), locName(db, m.locationId), (m.direction === "in" ? 1 : -1) * m.quantity, m.after, m.user])} />
        </TabsContent>
        <TabsContent value="criticos"><Report name="productos-criticos" head={["SKU", "Producto", "Sede", "Stock", "Mínimo", "Estado"]}
          rows={inv.filter((r) => r.status === "Crítico" || r.status === "Sin stock").map((r) => [r.sku, r.product, r.location, r.stock, r.minStock, r.status])}
          render={(r, i) => <tr key={i}>{r.slice(0, 5).map((c, j) => <td key={j} className={typeof c === "number" ? "num" : ""}>{c}</td>)}<td><Pill>{r[5]}</Pill></td></tr>} /></TabsContent>
        <TabsContent value="diferencias"><Report name="diferencias" head={["Código", "Fecha", "Producto", "Sede", "Diferencia", "Estado", "Motivo", "Acción"]}
          rows={db.reconciliations.map((r) => [r.code, fmtDate(r.createdAt), pName(db, r.productId), locName(db, r.locationId), r.originalDifference, r.status, r.reason, r.action])} /></TabsContent>
        <TabsContent value="mermas"><Report name="mermas" head={["Código", "Fecha", "Producto", "Sede", "Cantidad", "Motivo", "Responsable"]}
          rows={db.losses.map((l) => [l.code, fmtDate(l.date), pName(db, l.productId), locName(db, l.locationId), l.quantity, l.reason, l.user])} /></TabsContent>
        <TabsContent value="transferencias"><Report name="transferencias" head={["Código", "Creada", "Producto", "Origen", "Destino", "Cantidad", "Estado"]}
          rows={db.transfers.map((t) => [t.code, fmtDate(t.createdAt), pName(db, t.productId), locName(db, t.fromId), locName(db, t.toId), t.quantity, t.status])} /></TabsContent>
        <TabsContent value="kardex"><Report name="kardex-general" head={["Fecha", "Producto", "Sede", "Tipo", "Documento", "Entrada", "Salida", "Saldo ant.", "Saldo post."]}
          rows={kardexAll.map((m) => [fmtDate(m.date), pName(db, m.productId), locName(db, m.locationId), m.type, m.code, m.direction === "in" ? m.quantity : null, m.direction === "out" ? m.quantity : null, m.before, m.after])} /></TabsContent>
      </Tabs>
    </>
  );
}

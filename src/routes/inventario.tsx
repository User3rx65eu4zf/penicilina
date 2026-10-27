import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useDB } from "@/lib/inv/store";
import { inventoryView, STATUSES } from "@/lib/inv/selectors";
import { Input } from "@/components/ui/input";
import { CsvButton, locationOptions, PageHeader, Panel, Pill, Select, TableWrap } from "@/components/inv/ui";

export const Route = createFileRoute("/inventario")({
  head: () => ({ meta: [{ title: "Inventario por sede · Inventario Vega" }, { name: "description", content: "Stock por producto y sede con estado calculado." },
    { property: "og:title", content: "Inventario por sede · Inventario Vega" }, { property: "og:description", content: "Stock por producto y sede." }] }),
  component: Inventario,
});

function Inventario() {
  const db = useDB();
  const [loc, setLoc] = useState("");
  const [st, setSt] = useState("");
  const [q, setQ] = useState("");
  const rows = inventoryView(db).filter((r) => r.active && (!loc || r.locationId === loc) && (!st || r.status === st) && `${r.sku} ${r.product}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHeader title="Inventario por sede" description="Estado: Sin stock ≤ 0 · Crítico ≤ 50% del mínimo · Bajo ≤ mínimo · Normal > mínimo"
        actions={<CsvButton name="inventario" rows={() => [["SKU", "Producto", "Sede", "Stock", "Reservado", "Disponible", "Físico", "Mínimo", "Diferencia", "Estado"],
          ...rows.map((r) => [r.sku, r.product, r.location, r.stock, r.reserved, r.available, r.physical, r.minStock, r.difference, r.status])]} />} />
      <Panel>
        <div className="mb-4 flex flex-wrap gap-3">
          <Input className="max-w-xs" placeholder="Buscar producto" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="w-44"><Select value={loc} onChange={setLoc} placeholder="Todas las sedes" options={locationOptions(db)} /></div>
          <div className="w-44"><Select value={st} onChange={setSt} placeholder="Todos los estados" options={STATUSES.map((s) => ({ value: s, label: s }))} /></div>
          <span className="self-center text-sm text-muted-foreground">{rows.length} registros</span>
        </div>
        <TableWrap>
          <thead><tr><th>SKU</th><th>Producto</th><th>Sede</th><th className="num">Disponible</th><th className="num">Sistema</th><th className="num">Reservado</th><th className="num">Físico</th><th className="num">Mínimo</th><th className="num">Diferencia</th><th>Estado</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}>
              <td className="font-mono text-xs">{r.sku}</td>
              <td><Link to="/productos/$id" params={{ id: r.productId }} className="text-primary hover:underline">{r.product}</Link></td>
              <td>{r.location}</td><td className="num font-semibold">{r.available}</td><td className="num">{r.stock}</td><td className="num">{r.reserved}</td>
              <td className="num">{r.physical ?? "—"}</td><td className="num">{r.minStock}</td>
              <td className="num">{r.difference === null ? "—" : r.difference > 0 ? `+${r.difference}` : r.difference}</td><td><Pill>{r.status}</Pill></td>
            </tr>
          ))}</tbody>
        </TableWrap>
      </Panel>
    </>
  );
}

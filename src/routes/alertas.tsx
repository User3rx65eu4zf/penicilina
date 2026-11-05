import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useDB, run } from "@/lib/inv/store";
import { locName, setAlertStatus } from "@/lib/inv/logic";
import { pName } from "@/lib/inv/selectors";
import { Button } from "@/components/ui/button";
import { fmtDate, PageHeader, Panel, Pill, Select, TableWrap } from "@/components/inv/ui";

export const Route = createFileRoute("/alertas")({
  head: () => ({ meta: [{ title: "Alertas · Inventario Vega" }, { name: "description", content: "Alertas automáticas de stock, diferencias, mermas y transferencias." },
    { property: "og:title", content: "Alertas · Inventario Vega" }, { property: "og:description", content: "Alertas automáticas." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Alertas,
});

const PRI = { Alta: 0, Media: 1, Baja: 2 };
function Alertas() {
  const db = useDB();
  const [st, setSt] = useState("activas");
  const [pr, setPr] = useState("");
  const list = db.alerts
    .filter((a) => (st === "activas" ? a.status !== "Resuelta" : !st || a.status === st) && (!pr || a.priority === pr))
    .sort((a, b) => PRI[a.priority] - PRI[b.priority] || b.createdAt.localeCompare(a.createdAt));
  return (
    <>
      <PageHeader title="Alertas" description="Las alertas de stock se resuelven automáticamente cuando el stock vuelve a Normal; las de diferencia, al cerrar la conciliación." />
      <Panel>
        <div className="mb-4 flex gap-3">
          <div className="w-44"><Select value={st} onChange={setSt} options={[{ value: "activas", label: "Activas" }, { value: "", label: "Todas" }, ...["Pendiente", "Revisada", "Resuelta"].map((x) => ({ value: x, label: x }))]} /></div>
          <div className="w-44"><Select value={pr} onChange={setPr} placeholder="Todas las prioridades" options={["Alta", "Media", "Baja"].map((x) => ({ value: x, label: x }))} /></div>
          <span className="self-center text-sm text-muted-foreground">{list.length} alertas</span>
        </div>
        <TableWrap>
          <thead><tr><th>Prioridad</th><th>Tipo</th><th>Producto</th><th>Sede</th><th>Detalle</th><th>Creada</th><th>Estado</th><th /></tr></thead>
          <tbody>{list.map((a) => (
            <tr key={a.id}>
              <td><Pill>{a.priority}</Pill></td><td className="font-medium">{a.type}</td>
              <td>{a.productId ? <Link to="/productos/$id" params={{ id: a.productId }} className="text-primary hover:underline">{pName(db, a.productId)}</Link> : "—"}</td>
              <td>{locName(db, a.locationId)}</td><td className="text-xs text-muted-foreground">{a.message}</td>
              <td className="whitespace-nowrap text-xs">{fmtDate(a.createdAt)}</td><td><Pill>{a.status}</Pill></td>
              <td><div className="flex gap-1">
                {a.status === "Pendiente" && <Button size="sm" variant="outline" onClick={() => run((d) => setAlertStatus(d, a.id, "Revisada"), "Alerta revisada")}>Revisada</Button>}
                {a.status !== "Resuelta" && (a.type === "Merma registrada" || a.type === "Transferencia demorada") &&
                  <Button size="sm" onClick={() => run((d) => setAlertStatus(d, a.id, "Resuelta"), "Alerta resuelta")}>Resolver</Button>}
              </div></td>
            </tr>
          ))}</tbody>
        </TableWrap>
      </Panel>
    </>
  );
}

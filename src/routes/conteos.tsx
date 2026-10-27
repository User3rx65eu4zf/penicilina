import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useDB, run } from "@/lib/inv/store";
import { getRow, locName, registerCount } from "@/lib/inv/logic";
import { pName } from "@/lib/inv/selectors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, fmtDate, locationOptions, PageHeader, Panel, Pill, productOptions, Select, TableWrap } from "@/components/inv/ui";

type Search = { productId?: string | undefined; locationId?: string | undefined };
export const Route = createFileRoute("/conteos")({
  validateSearch: (s: { productId?: unknown; locationId?: unknown; toId?: unknown; qty?: unknown }): Search => ({
    productId: typeof s.productId === "string" ? s.productId : undefined,
    locationId: typeof s.locationId === "string" ? s.locationId : undefined,
  }),
  head: () => ({ meta: [{ title: "Conteo físico · Inventario Vega" }, { name: "description", content: "Registro de inventarios físicos y diferencias contra el sistema." },
    { property: "og:title", content: "Conteo físico · Inventario Vega" }, { property: "og:description", content: "Conteos físicos." }] }),
  component: Conteos,
});

function Conteos() {
  const db = useDB();
  const s = Route.useSearch();
  const [f, setF] = useState({ productId: s.productId ?? "", locationId: s.locationId ?? "", counted: "", note: "" });
  const row = f.productId && f.locationId ? getRow(db, f.productId, f.locationId) : null;
  const diff = row && f.counted !== "" ? Number(f.counted) - row.stock : null;
  const submit = () => {
    if (!row) return run(() => { throw new Error("Seleccione producto y sede"); });
    if (f.counted === "") return run(() => { throw new Error("Ingrese la cantidad contada"); });
    const c = run((d) => registerCount(d, { productId: f.productId, locationId: f.locationId, counted: Number(f.counted), note: f.note }),
      diff ? "Conteo registrado — se generó una conciliación pendiente" : "Conteo registrado sin diferencias");
    if (c) setF((x) => ({ ...x, counted: "", note: "" }));
  };
  return (
    <>
      <PageHeader title="Conteo físico" description="Diferencia = cantidad contada − stock sistema. Toda diferencia genera una conciliación pendiente." />
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Panel title="Registrar conteo">
          <div className="grid gap-3">
            <Field label="Producto"><Select value={f.productId} onChange={(v) => setF({ ...f, productId: v })} placeholder="Seleccione…" options={productOptions(db)} /></Field>
            <Field label="Sede"><Select value={f.locationId} onChange={(v) => setF({ ...f, locationId: v })} placeholder="Seleccione…" options={locationOptions(db)} /></Field>
            <Field label="Stock sistema"><Input value={row?.stock ?? ""} readOnly className="bg-muted" /></Field>
            <Field label="Cantidad contada"><Input type="number" min={0} value={f.counted} onChange={(e) => setF({ ...f, counted: e.target.value })} /></Field>
            {diff !== null && <p className="rounded-md bg-muted px-3 py-2 text-sm">Diferencia: <b className={diff === 0 ? "text-success" : "text-destructive"}>{diff > 0 ? "+" : ""}{diff}</b></p>}
            <Field label="Observación"><Textarea rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
            <Button onClick={submit}>Registrar conteo</Button>
          </div>
        </Panel>
        <Panel title="Conteos registrados">
          <TableWrap>
            <thead><tr><th>Código</th><th>Fecha</th><th>Producto</th><th>Sede</th><th className="num">Sistema</th><th className="num">Contado</th><th className="num">Dif.</th><th>Responsable</th><th>Conciliación</th></tr></thead>
            <tbody>{db.counts.map((c) => {
              const r = db.reconciliations.find((x) => x.id === c.reconciliationId);
              return (
                <tr key={c.id}>
                  <td className="font-mono text-xs">{c.code}</td><td className="text-xs">{fmtDate(c.date)}</td><td>{pName(db, c.productId)}</td><td>{locName(db, c.locationId)}</td>
                  <td className="num">{c.systemStock}</td><td className="num">{c.counted}</td><td className="num">{c.difference > 0 ? "+" : ""}{c.difference}</td>
                  <td className="text-xs">{c.user}<div className="text-muted-foreground">{c.role}</div></td>
                  <td>{r ? <Link to="/conciliaciones" className="inline-flex gap-1"><span className="font-mono text-xs">{r.code}</span><Pill>{r.status}</Pill></Link> : <Pill tone="success">Sin diferencia</Pill>}</td>
                </tr>
              );
            })}</tbody>
          </TableWrap>
        </Panel>
      </div>
    </>
  );
}

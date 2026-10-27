import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useDB, run } from "@/lib/inv/store";
import { available, getRow, locName, registerLoss } from "@/lib/inv/logic";
import { pName } from "@/lib/inv/selectors";
import { LOSS_REASONS } from "@/lib/inv/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Confirm, Field, fmtDate, locationOptions, PageHeader, Panel, productOptions, Select, TableWrap } from "@/components/inv/ui";

export const Route = createFileRoute("/mermas")({
  head: () => ({ meta: [{ title: "Mermas · Inventario Vega" }, { name: "description", content: "Registro de mermas con evidencia y descuento de stock." },
    { property: "og:title", content: "Mermas · Inventario Vega" }, { property: "og:description", content: "Registro de mermas." }] }),
  component: Mermas,
});

function Mermas() {
  const db = useDB();
  const [f, setF] = useState({ productId: "", locationId: "", quantity: "", reason: "", evidence: "", note: "" });
  const row = f.productId && f.locationId ? getRow(db, f.productId, f.locationId) : null;
  const submit = () => {
    if (!row) return run(() => { throw new Error("Seleccione producto y sede"); });
    if (run((d) => registerLoss(d, { ...f, quantity: Number(f.quantity) }), "Merma registrada")) setF((x) => ({ ...x, quantity: "", evidence: "", note: "" }));
  };
  return (
    <>
      <PageHeader title="Mermas" description="Cada merma descuenta stock, genera movimiento en Kardex y una alerta." />
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Panel title="Registrar merma">
          <div className="grid gap-3">
            <Field label="Producto"><Select value={f.productId} onChange={(v) => setF({ ...f, productId: v })} placeholder="Seleccione…" options={productOptions(db)} /></Field>
            <Field label="Sede"><Select value={f.locationId} onChange={(v) => setF({ ...f, locationId: v })} placeholder="Seleccione…" options={locationOptions(db)} /></Field>
            {row && <p className="rounded-md bg-muted px-3 py-2 text-xs">Disponible: <b>{available(row)}</b></p>}
            <Field label="Cantidad"><Input type="number" min={1} value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></Field>
            <Field label="Motivo"><Select value={f.reason} onChange={(v) => setF({ ...f, reason: v })} placeholder="Seleccione…" options={LOSS_REASONS.map((x) => ({ value: x, label: x }))} /></Field>
            <Field label="Evidencia (descripción)"><Textarea rows={2} value={f.evidence} onChange={(e) => setF({ ...f, evidence: e.target.value })} placeholder="Ej. lote, foto, acta…" /></Field>
            <Field label="Observación"><Textarea rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
            <Confirm title="Confirmar merma" description={`Se descontarán ${f.quantity || 0} unidades del stock de ${locName(db, f.locationId || null)}.`} onConfirm={submit}
              trigger={<Button>Registrar merma</Button>} />
          </div>
        </Panel>
        <Panel title={`Mermas registradas · ${db.losses.reduce((s, l) => s + l.quantity, 0)} unidades`}>
          <TableWrap>
            <thead><tr><th>Código</th><th>Fecha</th><th>Producto</th><th>Sede</th><th className="num">Cant.</th><th>Motivo</th><th>Evidencia</th><th>Responsable</th></tr></thead>
            <tbody>{db.losses.map((l) => (
              <tr key={l.id}>
                <td className="font-mono text-xs">{l.code}</td><td className="text-xs">{fmtDate(l.date)}</td><td>{pName(db, l.productId)}</td><td>{locName(db, l.locationId)}</td>
                <td className="num">{l.quantity}</td><td>{l.reason}</td><td className="text-xs">{l.evidence}{l.note && <div className="text-muted-foreground">{l.note}</div>}</td>
                <td className="text-xs">{l.user}<div className="text-muted-foreground">{l.role}</div></td>
              </tr>
            ))}</tbody>
          </TableWrap>
        </Panel>
      </div>
    </>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useDB, run } from "@/lib/inv/store";
import { available, getRow, locName, registerMovement, type MovementInput } from "@/lib/inv/logic";
import { MOVEMENT_TYPES } from "@/lib/inv/types";
import { pName } from "@/lib/inv/selectors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CsvButton, Field, fmtDate, locationOptions, PageHeader, Panel, productOptions, Select, TableWrap } from "@/components/inv/ui";

export const Route = createFileRoute("/movimientos")({
  head: () => ({ meta: [{ title: "Movimientos · Inventario Vega" }, { name: "description", content: "Registro de entradas, salidas y ajustes con saldo anterior y posterior." },
    { property: "og:title", content: "Movimientos · Inventario Vega" }, { property: "og:description", content: "Entradas, salidas y ajustes." }] }),
  component: Movimientos,
});

const TYPES: MovementInput["type"][] = ["Entrada", "Salida", "Ajuste positivo", "Ajuste negativo"];

function Movimientos() {
  const db = useDB();
  const [f, setF] = useState({ type: "Entrada" as MovementInput["type"], productId: "", locationId: "", quantity: "", reason: "", note: "" });
  const [ft, setFt] = useState("");
  const row = f.productId && f.locationId ? getRow(db, f.productId, f.locationId) : null;
  const submit = () => {
    if (!f.productId || !f.locationId) return run(() => { throw new Error("Seleccione producto y sede"); });
    const ok = run((d) => registerMovement(d, { ...f, quantity: Number(f.quantity) }), `${f.type} registrada`);
    if (ok) setF((x) => ({ ...x, quantity: "", reason: "", note: "" }));
  };
  const list = db.movements.filter((m) => !ft || m.type === ft);
  return (
    <>
      <PageHeader title="Movimientos" description="Las transferencias y mermas se registran en sus propios módulos." />
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Panel title="Registrar movimiento">
          <div className="grid gap-3">
            <Field label="Tipo"><Select value={f.type} onChange={(v) => setF({ ...f, type: v as MovementInput["type"] })} options={TYPES.map((t) => ({ value: t, label: t }))} /></Field>
            <Field label="Producto"><Select value={f.productId} onChange={(v) => setF({ ...f, productId: v })} placeholder="Seleccione…" options={productOptions(db)} /></Field>
            <Field label="Sede"><Select value={f.locationId} onChange={(v) => setF({ ...f, locationId: v })} placeholder="Seleccione…" options={locationOptions(db)} /></Field>
            {row && <p className="rounded-md bg-muted px-3 py-2 text-xs">Stock actual: <b>{row.stock}</b> · disponible: <b>{available(row)}</b></p>}
            <Field label="Cantidad"><Input type="number" min={1} value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></Field>
            <Field label="Motivo"><Input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="Ej. Recepción de proveedor" /></Field>
            <Field label="Observación"><Textarea value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} rows={2} /></Field>
            <Button onClick={submit}>Registrar como {db.currentRole}</Button>
          </div>
        </Panel>
        <Panel title={`Historial (${list.length})`} actions={<div className="flex gap-2"><div className="w-44"><Select value={ft} onChange={setFt} placeholder="Todos los tipos" options={MOVEMENT_TYPES.map((t) => ({ value: t, label: t }))} /></div>
          <CsvButton name="movimientos" rows={() => [["Código", "Fecha", "Tipo", "Producto", "Sede", "Origen", "Destino", "Cantidad", "Saldo anterior", "Saldo posterior", "Motivo", "Responsable", "Rol", "Observación"],
            ...list.map((m) => [m.code, m.date, m.type, pName(db, m.productId), locName(db, m.locationId), locName(db, m.fromLocationId), locName(db, m.toLocationId), (m.direction === "in" ? 1 : -1) * m.quantity, m.before, m.after, m.reason, m.user, m.role, m.note])]} /></div>}>
          <TableWrap>
            <thead><tr><th>Código</th><th>Fecha</th><th>Tipo</th><th>Producto</th><th>Sede</th><th>Origen → Destino</th><th className="num">Cant.</th><th className="num">Saldo</th><th>Motivo</th><th>Responsable</th></tr></thead>
            <tbody>{list.slice(0, 200).map((m) => (
              <tr key={m.id}>
                <td className="font-mono text-xs">{m.code}</td><td className="whitespace-nowrap text-xs">{fmtDate(m.date)}</td><td>{m.type}</td>
                <td>{pName(db, m.productId)}</td><td>{locName(db, m.locationId)}</td>
                <td className="text-xs">{locName(db, m.fromLocationId)} → {locName(db, m.toLocationId)}</td>
                <td className="num">{m.direction === "in" ? "+" : "−"}{m.quantity}</td><td className="num whitespace-nowrap">{m.before} → {m.after}</td>
                <td className="text-xs">{m.reason}{m.note && <div className="text-muted-foreground">{m.note}</div>}</td>
                <td className="text-xs">{m.user}<div className="text-muted-foreground">{m.role}</div></td>
              </tr>
            ))}</tbody>
          </TableWrap>
        </Panel>
      </div>
    </>
  );
}

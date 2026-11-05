import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useDB, run } from "@/lib/inv/store";
import { available, cancelTransfer, createTransfer, dispatchTransfer, getRow, locName, receiveTransfer } from "@/lib/inv/logic";
import { pName } from "@/lib/inv/selectors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Confirm, Field, fmtDate, locationOptions, PageHeader, Panel, Pill, productOptions, Select, TableWrap } from "@/components/inv/ui";

type Search = { productId?: string | undefined; toId?: string | undefined; qty?: number | undefined };
export const Route = createFileRoute("/transferencias")({
  validateSearch: (s: { productId?: unknown; locationId?: unknown; toId?: unknown; qty?: unknown }): Search => ({
    productId: typeof s.productId === "string" ? s.productId : undefined,
    toId: typeof s.toId === "string" ? s.toId : undefined,
    qty: typeof s.qty === "number" ? s.qty : undefined,
  }),
  head: () => ({ meta: [{ title: "Transferencias · Inventario Vega" }, { name: "description", content: "Flujo de transferencias: pendiente, en tránsito y completada." },
    { property: "og:title", content: "Transferencias · Inventario Vega" }, { property: "og:description", content: "Transferencias entre sedes." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Transferencias,
});

function Transferencias() {
  const db = useDB();
  const s = Route.useSearch();
  const cd = db.locations.find((l) => l.type === "CD");
  const [f, setF] = useState({ productId: s.productId ?? "", fromId: cd?.id ?? '', toId: s.toId ?? "", quantity: s.qty ? String(s.qty) : "", note: "" });
  const [fs, setFs] = useState("");
  const row = f.productId && f.fromId ? getRow(db, f.productId, f.fromId) : null;
  const dest = f.productId && f.toId ? getRow(db, f.productId, f.toId) : null;
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (saving) return;
    if (!f.productId || !f.toId) return run(() => { throw new Error("Seleccione producto y destino"); });
    setSaving(true);
    const ok = await run((d) => createTransfer(d, { ...f, quantity: Number(f.quantity) }), "Transferencia creada (Pendiente)");
    setSaving(false);
    if (ok) setF((x) => ({ ...x, quantity: "", note: "" }));
  };
  const list = db.transfers.filter((t) => !fs || t.status === fs);
  return (
    <>
      <PageHeader title="Transferencias" description="El stock del origen se reserva al crear, sale al despachar y entra al destino solo al confirmar recepción." />
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Panel title="Nueva transferencia">
          <div className="grid gap-3">
            <Field label="Producto"><Select value={f.productId} onChange={(v) => setF({ ...f, productId: v })} placeholder="Seleccione…" options={productOptions(db)} /></Field>
            <Field label="Origen"><Select value={f.fromId} onChange={(v) => setF({ ...f, fromId: v })} options={locationOptions(db)} /></Field>
            <Field label="Destino"><Select value={f.toId} onChange={(v) => setF({ ...f, toId: v })} placeholder="Seleccione…" options={locationOptions(db).filter((o) => o.value !== f.fromId)} /></Field>
            {row && <p className="rounded-md bg-muted px-3 py-2 text-xs">Disponible en origen: <b>{available(row)}</b>{dest && <> · stock destino: <b>{dest.stock}</b></>}</p>}
            <Field label="Cantidad"><Input type="number" min={1} value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></Field>
            <Field label="Observación"><Textarea rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
            <Button disabled={saving} onClick={submit}>{saving ? 'Guardando…' : 'Crear transferencia'}</Button>
          </div>
        </Panel>
        <Panel title="Transferencias" actions={<div className="w-44"><Select value={fs} onChange={setFs} placeholder="Todos los estados" options={["Pendiente", "En tránsito", "Completada", "Cancelada"].map((x) => ({ value: x, label: x }))} /></div>}>
          <TableWrap>
            <thead><tr><th>Código</th><th>Producto</th><th>Ruta</th><th className="num">Cant.</th><th>Estado</th><th>Trazabilidad</th><th>Acciones</th></tr></thead>
            <tbody>{list.map((t) => (
              <tr key={t.id}>
                <td className="font-mono text-xs">{t.code}</td><td>{pName(db, t.productId)}</td>
                <td className="whitespace-nowrap text-xs">{locName(db, t.fromId)} → {locName(db, t.toId)}</td><td className="num">{t.quantity}</td>
                <td><Pill>{t.status}</Pill></td>
                <td className="text-xs text-muted-foreground">
                  <div>Creada {fmtDate(t.createdAt)} · {t.createdBy}</div>
                  {t.dispatchedAt && <div>Despachada {fmtDate(t.dispatchedAt)} · {t.dispatchedBy}</div>}
                  {t.receivedAt && <div>Recibida {fmtDate(t.receivedAt)} · {t.receivedBy}</div>}
                  {t.cancelledAt && <div>Cancelada {fmtDate(t.cancelledAt)} · {t.cancelledBy}</div>}
                </td>
                <td><div className="flex flex-wrap gap-1">
                  {t.status === "Pendiente" && <Confirm title={`Confirmar despacho ${t.code}`} description={`Se descontarán ${t.quantity} unidades de ${locName(db, t.fromId)}.`}
                    onConfirm={() => run((d) => dispatchTransfer(d, t.id), "Despacho confirmado — En tránsito")} trigger={<Button size="sm">Despachar</Button>} />}
                  {t.status === "En tránsito" && <Confirm title={`Confirmar recepción ${t.code}`} description={`Se sumarán ${t.quantity} unidades a ${locName(db, t.toId)}.`}
                    onConfirm={() => run((d) => receiveTransfer(d, t.id), "Recepción confirmada — Completada")} trigger={<Button size="sm">Recibir</Button>} />}
                  {(t.status === "Pendiente" || t.status === "En tránsito") && <Confirm title={`Cancelar ${t.code}`} confirmLabel="Cancelar transferencia"
                    description={t.status === "Pendiente" ? "Se liberará la reserva en origen." : "La mercadería en tránsito se devolverá al stock de origen."}
                    onConfirm={() => run((d) => cancelTransfer(d, t.id), "Transferencia cancelada")} trigger={<Button size="sm" variant="outline">Cancelar</Button>} />}
                </div></td>
              </tr>
            ))}</tbody>
          </TableWrap>
        </Panel>
      </div>
    </>
  );
}

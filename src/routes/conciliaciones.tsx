import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useDB, run } from "@/lib/inv/store";
import { approveReconciliation, getRow, locName, rejectReconciliation, startReview } from "@/lib/inv/logic";
import { pName } from "@/lib/inv/selectors";
import { RECON_REASONS, type Reconciliation } from "@/lib/inv/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, fmtDate, PageHeader, Panel, Pill, Select, TableWrap } from "@/components/inv/ui";

export const Route = createFileRoute("/conciliaciones")({
  head: () => ({ meta: [{ title: "Conciliación · Inventario Vega" }, { name: "description", content: "Revisión y aprobación de diferencias entre stock físico y sistema." },
    { property: "og:title", content: "Conciliación · Inventario Vega" }, { property: "og:description", content: "Conciliación de inventario." }] }),
  component: Conciliaciones,
});

function ResolveDialog({ r, onClose }: { r: Reconciliation; onClose: () => void }) {
  const db = useDB();
  const [reason, setReason] = useState(r.reason ?? "");
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const row = getRow(db, r.productId, r.locationId);
  const d = r.originalDifference;
  const approve = () => { if (run((x) => { approveReconciliation(x, r.id, reason, note); return true; }, "Conciliación aprobada e inventario ajustado")) onClose(); };
  const reject = () => { if (run((x) => { rejectReconciliation(x, r.id, reason, note); return true; }, "Conciliación rechazada")) onClose(); };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Resolver {r.code}</DialogTitle></DialogHeader>
        <div className="grid gap-3 text-sm">
          <div className="grid grid-cols-3 gap-2 rounded-md bg-muted p-3">
            <div><div className="text-xs text-muted-foreground">Producto</div>{pName(db, r.productId)}</div>
            <div><div className="text-xs text-muted-foreground">Sede</div>{locName(db, r.locationId)}</div>
            <div><div className="text-xs text-muted-foreground">Diferencia original</div><b>{d > 0 ? "+" : ""}{d}</b></div>
          </div>
          <Field label="Motivo"><Select value={reason} onChange={setReason} placeholder="Seleccione…" options={RECON_REASONS.map((x) => ({ value: x, label: x }))} /></Field>
          <Field label="Observación"><Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          {confirming && (
            <div className="rounded-md border border-warning/50 bg-warning/15 p-3">
              <b>¿Confirmar modificación de inventario?</b>
              <p className="mt-1">Se registrará un <b>{d > 0 ? "Ajuste positivo" : "Ajuste negativo"}</b> de {Math.abs(d)} en {locName(db, r.locationId)}.
                Stock sistema: {row.stock} → <b>{row.stock + d}</b>. Acción realizada por {db.currentRole}.</p>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={reject}>Rechazar</Button>
          {confirming ? <Button onClick={approve}>Sí, aplicar ajuste</Button>
            : <Button onClick={() => (reason ? setConfirming(true) : run(() => { throw new Error("Seleccione un motivo"); }))}>Aprobar ajuste</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Conciliaciones() {
  const db = useDB();
  const [open, setOpen] = useState<Reconciliation | null>(null);
  const [fs, setFs] = useState("");
  const canReview = db.currentRole !== "Encargado de almacén";
  const list = db.reconciliations.filter((r) => !fs || r.status === fs);
  return (
    <>
      <PageHeader title="Conciliación" description="Solo Supervisor o Administrador pueden revisar, aprobar o rechazar." />
      {!canReview && <p className="mb-4 rounded-md border border-warning/50 bg-warning/15 px-4 py-2 text-sm">Está actuando como <b>{db.currentRole}</b>. Cambie a Supervisor en la barra superior para resolver conciliaciones.</p>}
      <Panel actions={undefined}>
        <div className="mb-4 w-48"><Select value={fs} onChange={setFs} placeholder="Todos los estados" options={["Pendiente", "En revisión", "Conciliada", "Rechazada"].map((x) => ({ value: x, label: x }))} /></div>
        <TableWrap>
          <thead><tr><th>Código</th><th>Creada</th><th>Producto</th><th>Sede</th><th className="num">Dif.</th><th>Estado</th><th>Motivo / acción</th><th>Revisó</th><th /></tr></thead>
          <tbody>{list.map((r) => (
            <tr key={r.id}>
              <td className="font-mono text-xs">{r.code}</td><td className="text-xs">{fmtDate(r.createdAt)}<div className="text-muted-foreground">{r.createdBy}</div></td>
              <td>{pName(db, r.productId)}</td><td>{locName(db, r.locationId)}</td>
              <td className="num">{r.originalDifference > 0 ? "+" : ""}{r.originalDifference}</td><td><Pill>{r.status}</Pill></td>
              <td className="text-xs">{r.reason ?? "—"}{r.action && <div className="text-muted-foreground">{r.action}</div>}{r.note && <div className="italic text-muted-foreground">{r.note}</div>}</td>
              <td className="text-xs">{r.reviewedBy ? <>{r.reviewedBy}<div className="text-muted-foreground">{r.reviewedRole} · {fmtDate(r.reviewedAt)}</div></> : "—"}</td>
              <td><div className="flex gap-1">
                {r.status === "Pendiente" && <Button size="sm" variant="outline" disabled={!canReview} onClick={() => run((d) => startReview(d, r.id), "Conciliación en revisión")}>Revisar</Button>}
                {(r.status === "Pendiente" || r.status === "En revisión") && <Button size="sm" disabled={!canReview} onClick={() => setOpen(r)}>Resolver</Button>}
              </div></td>
            </tr>
          ))}</tbody>
        </TableWrap>
      </Panel>
      {open && <ResolveDialog r={open} onClose={() => setOpen(null)} />}
    </>
  );
}

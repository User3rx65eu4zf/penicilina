import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useDB } from "@/lib/inv/store";
import { getRow } from "@/lib/inv/logic";
import { MOVEMENT_TYPES } from "@/lib/inv/types";
import { Input } from "@/components/ui/input";
import { CsvButton, Empty, Field, fmtDate, locationOptions, PageHeader, Panel, Pill, productOptions, Select, TableWrap } from "@/components/inv/ui";

type Search = { productId?: string; locationId?: string };
export const Route = createFileRoute("/kardex")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    productId: typeof s.productId === "string" ? s.productId : undefined,
    locationId: typeof s.locationId === "string" ? s.locationId : undefined,
  }),
  head: () => ({ meta: [{ title: "Kardex · Inventario Vega" }, { name: "description", content: "Kardex por producto y sede con saldos consistentes." },
    { property: "og:title", content: "Kardex · Inventario Vega" }, { property: "og:description", content: "Kardex por producto y sede." }] }),
  component: Kardex,
});

function Kardex() {
  const db = useDB();
  const s = Route.useSearch();
  const nav = useNavigate({ from: "/kardex" });
  const productId = s.productId ?? db.products[0]?.id ?? "";
  const locationId = s.locationId ?? db.locations[0]?.id ?? "";
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const all = db.movements.filter((m) => m.productId === productId && m.locationId === locationId).slice().reverse();
  const rows = all.filter((m) => (!type || m.type === type) && (!from || m.date.slice(0, 10) >= from) && (!to || m.date.slice(0, 10) <= to));
  const stock = productId && locationId ? getRow(db, productId, locationId).stock : 0;
  const kardexBalance = all.reduce((acc, m) => acc + (m.direction === "in" ? m.quantity : -m.quantity), 0);
  const consistent = kardexBalance === stock;
  return (
    <>
      <PageHeader title="Kardex" description="Movimientos ordenados cronológicamente por producto y sede."
        actions={<CsvButton name="kardex" rows={() => [["Fecha", "Tipo", "Documento", "Entrada", "Salida", "Saldo anterior", "Saldo posterior", "Responsable", "Observación"],
          ...rows.map((m) => [m.date, m.type, m.code, m.direction === "in" ? m.quantity : "", m.direction === "out" ? m.quantity : "", m.before, m.after, m.user, [m.reason, m.note].filter(Boolean).join(" · ")])]} />} />
      <Panel>
        <div className="mb-4 grid gap-3 md:grid-cols-5">
          <Field label="Producto"><Select value={productId} onChange={(v) => nav({ search: (p) => ({ ...p, productId: v }) })} options={productOptions(db, false)} /></Field>
          <Field label="Sede"><Select value={locationId} onChange={(v) => nav({ search: (p) => ({ ...p, locationId: v }) })} options={locationOptions(db)} /></Field>
          <Field label="Tipo"><Select value={type} onChange={setType} placeholder="Todos" options={MOVEMENT_TYPES.map((t) => ({ value: t, label: t }))} /></Field>
          <Field label="Desde"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="Hasta"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          <span>Stock actual: <b className="font-mono">{stock}</b></span>
          <span>Saldo Kardex: <b className="font-mono">{kardexBalance}</b></span>
          <Pill tone={consistent ? "success" : "danger"}>{consistent ? "Consistente" : "Inconsistente"}</Pill>
        </div>
        {rows.length === 0 ? <Empty>Sin movimientos para los filtros seleccionados</Empty> : (
          <TableWrap>
            <thead><tr><th>Fecha</th><th>Tipo</th><th>Documento</th><th className="num">Entrada</th><th className="num">Salida</th><th className="num">Saldo ant.</th><th className="num">Saldo post.</th><th>Responsable</th><th>Observación</th></tr></thead>
            <tbody>{rows.map((m) => (
              <tr key={m.id}>
                <td className="whitespace-nowrap text-xs">{fmtDate(m.date)}</td><td>{m.type}</td><td className="font-mono text-xs">{m.code}</td>
                <td className="num text-success">{m.direction === "in" ? m.quantity : ""}</td><td className="num text-destructive">{m.direction === "out" ? m.quantity : ""}</td>
                <td className="num">{m.before}</td><td className="num font-semibold">{m.after}</td>
                <td className="text-xs">{m.user}<div className="text-muted-foreground">{m.role}</div></td>
                <td className="text-xs">{m.reason}{m.note && <div className="text-muted-foreground">{m.note}</div>}</td>
              </tr>
            ))}</tbody>
          </TableWrap>
        )}
      </Panel>
    </>
  );
}

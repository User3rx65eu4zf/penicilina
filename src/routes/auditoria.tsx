import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useDB } from "@/lib/inv/store";
import { ROLES } from "@/lib/inv/types";
import { Input } from "@/components/ui/input";
import { CsvButton, fmtDate, PageHeader, Panel, Select, TableWrap } from "@/components/inv/ui";

export const Route = createFileRoute("/auditoria")({
  head: () => ({ meta: [{ title: "Auditoría · Inventario Vega" }, { name: "description", content: "Bitácora de acciones con usuario, rol y detalle." },
    { property: "og:title", content: "Auditoría · Inventario Vega" }, { property: "og:description", content: "Bitácora de auditoría." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Auditoria,
});

function Auditoria() {
  const db = useDB();
  const [q, setQ] = useState("");
  const [ent, setEnt] = useState("");
  const [role, setRole] = useState("");
  const entities = [...new Set(db.audit.map((a) => a.entity))];
  const list = db.audit.filter((a) => (!ent || a.entity === ent) && (!role || a.role === role) && `${a.action} ${a.entityId} ${a.detail} ${a.user}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHeader title="Auditoría" description={`${db.audit.length} acciones registradas`}
        actions={<CsvButton name="auditoria" rows={() => [["Fecha", "Acción", "Entidad", "ID", "Usuario", "Rol", "Detalle"], ...list.map((a) => [a.date, a.action, a.entity, a.entityId, a.user, a.role, a.detail])]} />} />
      <Panel>
        <div className="mb-4 flex flex-wrap gap-3">
          <Input className="max-w-xs" placeholder="Buscar" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="w-44"><Select value={ent} onChange={setEnt} placeholder="Todas las entidades" options={entities.map((e) => ({ value: e, label: e }))} /></div>
          <div className="w-52"><Select value={role} onChange={setRole} placeholder="Todos los roles" options={ROLES.map((r) => ({ value: r, label: r }))} /></div>
        </div>
        <TableWrap>
          <thead><tr><th>Fecha</th><th>Acción</th><th>Entidad</th><th>ID</th><th>Usuario</th><th>Detalle</th></tr></thead>
          <tbody>{list.slice(0, 300).map((a) => (
            <tr key={a.id}>
              <td className="whitespace-nowrap text-xs">{fmtDate(a.date)}</td><td className="font-medium">{a.action}</td><td>{a.entity}</td>
              <td className="font-mono text-xs">{a.entityId}</td><td className="text-xs">{a.user}<div className="text-muted-foreground">{a.role}</div></td>
              <td className="text-xs text-muted-foreground">{a.detail}</td>
            </tr>
          ))}</tbody>
        </TableWrap>
      </Panel>
    </>
  );
}

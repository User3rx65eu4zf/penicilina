import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { useDB, run } from "@/lib/inv/store";
import { createProduct, updateProduct, type ProductInput } from "@/lib/inv/logic";
import type { DB, Product } from "@/lib/inv/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Field, fmtDate, PageHeader, Panel, Pill, Select, TableWrap } from "@/components/inv/ui";

export const Route = createFileRoute("/productos/")({
  head: () => ({ meta: [{ title: "Productos · Inventario Vega" }, { name: "description", content: "Catálogo de productos con SKU único." },
    { property: "og:title", content: "Productos · Inventario Vega" }, { property: "og:description", content: "Catálogo de productos." }] }),
  component: Productos,
});

const empty = (db: DB): ProductInput => ({ sku: "", name: "", categoryId: db.categories[0]?.id ?? "", unit: "unidad", minStock: 10, targetStock: 30, active: true });

function ProductDialog({ db, product, open, onClose }: { db: DB; product: Product | null; open: boolean; onClose: () => void }) {
  const [f, setF] = useState<ProductInput>(product ?? empty(db));
  const set = <K extends keyof ProductInput>(k: K, v: ProductInput[K]) => setF((x) => ({ ...x, [k]: v }));
  const submit = () => {
    const ok = run((d) => (product ? updateProduct(d, product.id, f) : createProduct(d, f)), product ? "Producto actualizado" : "Producto creado");
    if (ok !== undefined || product) { if (ok !== undefined || product) onClose(); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{product ? "Editar producto" : "Nuevo producto"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <Field label="SKU"><Input value={f.sku} onChange={(e) => set("sku", e.target.value)} placeholder="CV-1100" /></Field>
          <Field label="Unidad de medida"><Input value={f.unit} onChange={(e) => set("unit", e.target.value)} /></Field>
          <div className="col-span-2"><Field label="Nombre"><Input value={f.name} onChange={(e) => set("name", e.target.value)} /></Field></div>
          <Field label="Categoría"><Select value={f.categoryId} onChange={(v) => set("categoryId", v)} options={db.categories.map((c) => ({ value: c.id, label: c.name }))} /></Field>
          <Field label="Estado"><Select value={f.active ? "1" : "0"} onChange={(v) => set("active", v === "1")} options={[{ value: "1", label: "Activo" }, { value: "0", label: "Inactivo" }]} /></Field>
          <Field label="Stock mínimo (por sede)"><Input type="number" min={0} value={f.minStock} onChange={(e) => set("minStock", Number(e.target.value))} /></Field>
          <Field label="Stock objetivo (por sede)"><Input type="number" min={0} value={f.targetStock} onChange={(e) => set("targetStock", Number(e.target.value))} /></Field>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={submit}>Guardar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Productos() {
  const db = useDB();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [editing, setEditing] = useState<Product | null | "new">(null);
  const list = db.products.filter((p) => (!cat || p.categoryId === cat) && `${p.sku} ${p.name}`.toLowerCase().includes(q.toLowerCase()));
  const total = (id: string) => db.inventory.filter((r) => r.productId === id).reduce((s, r) => s + r.stock, 0);
  return (
    <>
      <PageHeader title="Productos" description={`${db.products.length} productos registrados`}
        actions={<Button onClick={() => setEditing("new")}><Plus className="mr-1.5 h-4 w-4" />Nuevo producto</Button>} />
      <Panel>
        <div className="mb-4 flex flex-wrap gap-3">
          <Input className="max-w-xs" placeholder="Buscar por SKU o nombre" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="w-48"><Select value={cat} onChange={setCat} placeholder="Todas las categorías" options={db.categories.map((c) => ({ value: c.id, label: c.name }))} /></div>
        </div>
        <TableWrap>
          <thead><tr><th>SKU</th><th>Nombre</th><th>Categoría</th><th>Unidad</th><th className="num">Mín.</th><th className="num">Objetivo</th><th className="num">Stock total</th><th>Estado</th><th>Creado</th><th /></tr></thead>
          <tbody>{list.map((p) => (
            <tr key={p.id}>
              <td className="font-mono text-xs">{p.sku}</td>
              <td><Link to="/productos/$id" params={{ id: p.id }} className="font-medium text-primary hover:underline">{p.name}</Link></td>
              <td>{db.categories.find((c) => c.id === p.categoryId)?.name}</td><td>{p.unit}</td>
              <td className="num">{p.minStock}</td><td className="num">{p.targetStock}</td><td className="num">{total(p.id)}</td>
              <td><Pill tone={p.active ? "success" : "muted"}>{p.active ? "Activo" : "Inactivo"}</Pill></td>
              <td className="whitespace-nowrap text-xs">{fmtDate(p.createdAt)}</td>
              <td><Button size="sm" variant="ghost" onClick={() => setEditing(p)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button></td>
            </tr>
          ))}</tbody>
        </TableWrap>
      </Panel>
      {editing && <ProductDialog key={editing === "new" ? "new" : editing.id} db={db} product={editing === "new" ? null : editing} open onClose={() => setEditing(null)} />}
    </>
  );
}

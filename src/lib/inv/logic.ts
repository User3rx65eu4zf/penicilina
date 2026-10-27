import {
  USERS, type Alert, type AlertType, type DB, type InventoryRow, type Movement, type MovementType,
  type Priority, type Product, type Role, type StockStatus,
} from "./types";

export class BusinessError extends Error {}
const fail = (m: string): never => { throw new BusinessError(m); };

// Clock override allows the seed to create history in the past.
let clockOverride: Date | null = null;
export const setClock = (d: Date | null) => { clockOverride = d; };
export const nowIso = () => (clockOverride ?? new Date()).toISOString();

export const TRANSFER_DELAY_HOURS = 48;

export function stockStatus(stock: number, minStock: number): StockStatus {
  if (stock <= 0) return "Sin stock";
  if (stock <= minStock * 0.5) return "Crítico";
  if (stock <= minStock) return "Bajo";
  return "Normal";
}

export function differencePriority(diff: number, minStock: number): Priority {
  return Math.abs(diff) >= Math.max(1, minStock * 0.5) ? "Alta" : "Media";
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export function nextCode(db: DB, prefix: string) {
  db.seq[prefix] = (db.seq[prefix] ?? 0) + 1;
  return `${prefix}-${String(db.seq[prefix]).padStart(5, "0")}`;
}

const user = (db: DB) => ({ name: USERS[db.currentRole], role: db.currentRole });

export function audit(db: DB, action: string, entity: string, entityId: string, detail: string) {
  const u = user(db);
  db.audit.unshift({ id: uid(), date: nowIso(), action, entity, entityId, user: u.name, role: u.role, detail });
}

export const getProduct = (db: DB, id: string) => db.products.find((p) => p.id === id) ?? fail("Producto no encontrado");
export const locName = (db: DB, id: string | null) => db.locations.find((l) => l.id === id)?.name ?? "—";
export function getRow(db: DB, productId: string, locationId: string): InventoryRow {
  const r = db.inventory.find((i) => i.productId === productId && i.locationId === locationId);
  return r ?? fail("No existe inventario para esa combinación producto-sede");
}
export const available = (r: InventoryRow) => r.stock - r.reserved;

function assertQty(q: number) {
  if (!Number.isFinite(q) || q <= 0) fail("La cantidad debe ser mayor a 0");
  if (!Number.isInteger(q)) fail("La cantidad debe ser un número entero");
}

// ---------- Alerts ----------
const STOCK_ALERTS: AlertType[] = ["Sin stock", "Stock crítico", "Stock bajo", "Stock negativo"];
function createAlert(db: DB, a: Omit<Alert, "id" | "createdAt" | "updatedAt" | "status">) {
  const t = nowIso();
  db.alerts.unshift({ ...a, id: uid(), status: "Pendiente", createdAt: t, updatedAt: t });
}
function resolveAlert(a: Alert) { a.status = "Resuelta"; a.updatedAt = nowIso(); }

export function syncRowAlerts(db: DB, row: InventoryRow) {
  const p = getProduct(db, row.productId);
  let desired: AlertType | null = null;
  if (p.active) {
    if (row.stock < 0) desired = "Stock negativo";
    else {
      const s = stockStatus(row.stock, p.minStock);
      desired = s === "Sin stock" ? "Sin stock" : s === "Crítico" ? "Stock crítico" : s === "Bajo" ? "Stock bajo" : null;
    }
  }
  const open = db.alerts.filter((a) => a.status !== "Resuelta" && STOCK_ALERTS.includes(a.type) && a.productId === row.productId && a.locationId === row.locationId);
  for (const a of open) if (a.type !== desired) resolveAlert(a);
  if (desired && !open.some((a) => a.type === desired)) {
    const priority: Priority = desired === "Stock bajo" ? "Baja" : desired === "Stock crítico" ? "Media" : "Alta";
    createAlert(db, { type: desired, priority, productId: p.id, locationId: row.locationId, refId: row.id,
      message: `${p.name} en ${locName(db, row.locationId)}: ${row.stock} ${p.unit} (mínimo ${p.minStock})` });
  }
}

export function syncTransferAlerts(db: DB, now = new Date()) {
  for (const t of db.transfers) {
    const open = db.alerts.find((a) => a.type === "Transferencia demorada" && a.refId === t.id && a.status !== "Resuelta");
    const active = t.status === "Pendiente" || t.status === "En tránsito";
    const hours = (now.getTime() - new Date(t.createdAt).getTime()) / 36e5;
    if (active && hours > TRANSFER_DELAY_HOURS && !open) {
      createAlert(db, { type: "Transferencia demorada", priority: "Media", productId: t.productId, locationId: t.toId, refId: t.id,
        message: `${t.code} lleva ${Math.floor(hours)} h en estado ${t.status}` });
    } else if (!active && open) resolveAlert(open);
  }
}

// ---------- Movements ----------
function applyMovement(db: DB, args: {
  productId: string; locationId: string; quantity: number; direction: "in" | "out"; type: MovementType;
  reason: string; note?: string | undefined; from?: string | null | undefined; to?: string | null | undefined; refType?: string | undefined; refId?: string | undefined; code?: string | undefined;
}): Movement {
  const row = getRow(db, args.productId, args.locationId);
  const before = row.stock;
  const after = args.direction === "in" ? before + args.quantity : before - args.quantity;
  if (after < 0) fail("La operación dejaría stock negativo");
  row.stock = after;
  const u = user(db);
  const m: Movement = {
    id: uid(), code: args.code ?? nextCode(db, "MOV"), date: nowIso(), productId: args.productId, quantity: args.quantity,
    locationId: args.locationId, direction: args.direction, fromLocationId: args.from ?? null, toLocationId: args.to ?? null,
    type: args.type, reason: args.reason, user: u.name, role: u.role, note: args.note ?? "", before, after,
    refType: args.refType ?? null, refId: args.refId ?? null,
  };
  db.movements.unshift(m);
  syncRowAlerts(db, row);
  return m;
}

export interface MovementInput {
  type: "Entrada" | "Salida" | "Ajuste positivo" | "Ajuste negativo";
  productId: string; locationId: string; quantity: number; reason: string; note?: string | undefined;
}
export function registerMovement(db: DB, i: MovementInput) {
  assertQty(i.quantity);
  if (!i.reason.trim()) fail("Indique el motivo");
  const p = getProduct(db, i.productId);
  if (!p.active) fail("El producto está inactivo");
  if (i.type.startsWith("Ajuste") && db.currentRole === "Encargado de almacén") fail("Solo Supervisor o Administrador pueden registrar ajustes");
  const out = i.type === "Salida" || i.type === "Ajuste negativo";
  const row = getRow(db, i.productId, i.locationId);
  if (out && i.quantity > available(row)) fail(`Stock disponible insuficiente (${available(row)} ${p.unit})`);
  const m = applyMovement(db, { ...i, direction: out ? "out" : "in", from: out ? i.locationId : null, to: out ? null : i.locationId });
  audit(db, `Registro de ${i.type.toLowerCase()}`, "Movimiento", m.code, `${p.name} · ${i.quantity} ${p.unit} · ${locName(db, i.locationId)} · ${m.before}→${m.after}`);
  return m;
}

// ---------- Transfers ----------
export function createTransfer(db: DB, i: { productId: string; fromId: string; toId: string; quantity: number; note?: string | undefined }) {
  assertQty(i.quantity);
  if (i.fromId === i.toId) fail("Origen y destino deben ser distintos");
  const p = getProduct(db, i.productId);
  if (!p.active) fail("El producto está inactivo");
  const row = getRow(db, i.productId, i.fromId);
  getRow(db, i.productId, i.toId);
  if (i.quantity > available(row)) fail(`Stock disponible insuficiente en origen (${available(row)} ${p.unit})`);
  row.reserved += i.quantity;
  const u = user(db);
  const t = {
    id: uid(), code: nextCode(db, "TRF"), productId: i.productId, fromId: i.fromId, toId: i.toId, quantity: i.quantity,
    status: "Pendiente" as const, createdAt: nowIso(), createdBy: u.name, note: i.note ?? "",
    dispatchedAt: null, dispatchedBy: null, receivedAt: null, receivedBy: null, cancelledAt: null, cancelledBy: null,
  };
  db.transfers.unshift(t);
  audit(db, "Creación de transferencia", "Transferencia", t.code, `${p.name} · ${i.quantity} ${p.unit} · ${locName(db, i.fromId)} → ${locName(db, i.toId)} (reservado)`);
  return t;
}
const getTransfer = (db: DB, id: string) => db.transfers.find((t) => t.id === id) ?? fail("Transferencia no encontrada");

export function dispatchTransfer(db: DB, id: string) {
  const t = getTransfer(db, id);
  if (t.status !== "Pendiente") fail("Solo se puede despachar una transferencia pendiente");
  const row = getRow(db, t.productId, t.fromId);
  if (row.stock < t.quantity) fail("Stock insuficiente en origen para despachar");
  row.reserved -= t.quantity;
  applyMovement(db, { productId: t.productId, locationId: t.fromId, quantity: t.quantity, direction: "out", type: "Transferencia",
    reason: "Despacho de transferencia", from: t.fromId, to: t.toId, refType: "Transferencia", refId: t.id, code: `${t.code}-S` });
  t.status = "En tránsito"; t.dispatchedAt = nowIso(); t.dispatchedBy = user(db).name;
  audit(db, "Despacho de transferencia", "Transferencia", t.code, `Sale de ${locName(db, t.fromId)}: ${t.quantity}`);
  syncTransferAlerts(db);
}
export function receiveTransfer(db: DB, id: string) {
  const t = getTransfer(db, id);
  if (t.status !== "En tránsito") fail("Solo se puede recibir una transferencia en tránsito");
  applyMovement(db, { productId: t.productId, locationId: t.toId, quantity: t.quantity, direction: "in", type: "Transferencia",
    reason: "Recepción de transferencia", from: t.fromId, to: t.toId, refType: "Transferencia", refId: t.id, code: `${t.code}-E` });
  t.status = "Completada"; t.receivedAt = nowIso(); t.receivedBy = user(db).name;
  audit(db, "Recepción de transferencia", "Transferencia", t.code, `Ingresa a ${locName(db, t.toId)}: ${t.quantity}`);
  syncTransferAlerts(db);
}
export function cancelTransfer(db: DB, id: string) {
  const t = getTransfer(db, id);
  if (t.status === "Completada" || t.status === "Cancelada") fail("La transferencia ya no puede cancelarse");
  if (t.status === "Pendiente") getRow(db, t.productId, t.fromId).reserved -= t.quantity;
  else applyMovement(db, { productId: t.productId, locationId: t.fromId, quantity: t.quantity, direction: "in", type: "Transferencia",
    reason: "Reversión por cancelación", from: t.toId, to: t.fromId, refType: "Transferencia", refId: t.id, code: `${t.code}-R` });
  const prev = t.status;
  t.status = "Cancelada"; t.cancelledAt = nowIso(); t.cancelledBy = user(db).name;
  audit(db, "Cancelación de transferencia", "Transferencia", t.code, `Cancelada desde estado ${prev}`);
  syncTransferAlerts(db);
}

// ---------- Physical counts ----------
export function registerCount(db: DB, i: { productId: string; locationId: string; counted: number; note?: string | undefined }) {
  if (!Number.isInteger(i.counted) || i.counted < 0) fail("La cantidad contada debe ser un entero mayor o igual a 0");
  const p = getProduct(db, i.productId);
  const row = getRow(db, i.productId, i.locationId);
  const u = user(db);
  const diff = i.counted - row.stock;
  const c = { id: uid(), code: nextCode(db, "CNT"), productId: p.id, locationId: i.locationId, systemStock: row.stock, counted: i.counted,
    difference: diff, user: u.name, role: u.role, date: nowIso(), note: i.note ?? "", reconciliationId: null as string | null };
  row.physical = i.counted; row.lastCountAt = c.date;
  db.counts.unshift(c);
  audit(db, "Registro de conteo físico", "Conteo", c.code, `${p.name} · ${locName(db, i.locationId)} · sistema ${row.stock}, contado ${i.counted}, dif ${diff}`);
  if (diff !== 0) {
    const r = { id: uid(), code: nextCode(db, "CON"), countId: c.id, productId: p.id, locationId: i.locationId, originalDifference: diff,
      status: "Pendiente" as const, reason: null, note: "", createdAt: c.date, createdBy: u.name, reviewedBy: null, reviewedRole: null,
      reviewedAt: null, action: null, movementId: null };
    db.reconciliations.unshift(r);
    c.reconciliationId = r.id;
    createAlert(db, { type: "Diferencia de inventario", priority: differencePriority(diff, p.minStock), productId: p.id, locationId: i.locationId,
      refId: r.id, message: `${p.name} en ${locName(db, i.locationId)}: diferencia ${diff > 0 ? "+" : ""}${diff} ${p.unit} (${r.code})` });
    audit(db, "Conciliación generada automáticamente", "Conciliación", r.code, `Diferencia ${diff}`);
  }
  return c;
}

// ---------- Reconciliations ----------
const getRecon = (db: DB, id: string) => db.reconciliations.find((r) => r.id === id) ?? fail("Conciliación no encontrada");
const canReview = (role: Role) => role === "Supervisor" || role === "Administrador";

export function startReview(db: DB, id: string) {
  if (!canReview(db.currentRole)) fail("Solo Supervisor o Administrador pueden revisar conciliaciones");
  const r = getRecon(db, id);
  if (r.status !== "Pendiente") fail("Solo se pueden revisar conciliaciones pendientes");
  r.status = "En revisión";
  db.alerts.filter((a) => a.refId === r.id && a.status === "Pendiente").forEach((a) => { a.status = "Revisada"; a.updatedAt = nowIso(); });
  audit(db, "Inicio de revisión", "Conciliación", r.code, "En revisión");
}
export function approveReconciliation(db: DB, id: string, reason: string, note: string) {
  if (!canReview(db.currentRole)) fail("Solo Supervisor o Administrador pueden aprobar conciliaciones");
  const r = getRecon(db, id);
  if (r.status !== "Pendiente" && r.status !== "En revisión") fail("La conciliación ya fue cerrada");
  if (!reason) fail("Seleccione un motivo");
  const row = getRow(db, r.productId, r.locationId);
  const d = r.originalDifference;
  if (d < 0 && row.stock + d < row.reserved) fail("El ajuste dejaría stock por debajo de lo reservado o negativo");
  const m = applyMovement(db, { productId: r.productId, locationId: r.locationId, quantity: Math.abs(d), direction: d > 0 ? "in" : "out",
    type: d > 0 ? "Ajuste positivo" : "Ajuste negativo", reason: `Conciliación: ${reason}`, note, refType: "Conciliación", refId: r.id });
  const u = user(db);
  Object.assign(r, { status: "Conciliada", reason, note, reviewedBy: u.name, reviewedRole: u.role, reviewedAt: nowIso(),
    action: `${m.type} de ${Math.abs(d)} (${m.code})`, movementId: m.id });
  db.alerts.filter((a) => a.refId === r.id && a.status !== "Resuelta").forEach(resolveAlert);
  audit(db, "Aprobación de conciliación", "Conciliación", r.code, `${reason} · ${r.action} · saldo ${m.before}→${m.after}`);
}
export function rejectReconciliation(db: DB, id: string, reason: string, note: string) {
  if (!canReview(db.currentRole)) fail("Solo Supervisor o Administrador pueden rechazar conciliaciones");
  const r = getRecon(db, id);
  if (r.status !== "Pendiente" && r.status !== "En revisión") fail("La conciliación ya fue cerrada");
  if (!note.trim()) fail("Indique una observación para el rechazo");
  const u = user(db);
  Object.assign(r, { status: "Rechazada", reason: reason || null, note, reviewedBy: u.name, reviewedRole: u.role, reviewedAt: nowIso(), action: "Sin ajuste (se recomienda reconteo)" });
  db.alerts.filter((a) => a.refId === r.id && a.status !== "Resuelta").forEach(resolveAlert);
  audit(db, "Rechazo de conciliación", "Conciliación", r.code, note);
}

// ---------- Losses ----------
export function registerLoss(db: DB, i: { productId: string; locationId: string; quantity: number; reason: string; evidence: string; note?: string | undefined }) {
  assertQty(i.quantity);
  if (!i.reason) fail("Seleccione un motivo");
  if (!i.evidence.trim()) fail("Describa la evidencia");
  const p = getProduct(db, i.productId);
  const row = getRow(db, i.productId, i.locationId);
  if (i.quantity > available(row)) fail(`Stock disponible insuficiente (${available(row)} ${p.unit})`);
  const code = nextCode(db, "MER");
  const m = applyMovement(db, { productId: p.id, locationId: i.locationId, quantity: i.quantity, direction: "out", type: "Merma",
    reason: i.reason, note: i.note, from: i.locationId, refType: "Merma", code: `${code}` });
  const u = user(db);
  const l = { id: uid(), code, productId: p.id, locationId: i.locationId, quantity: i.quantity, reason: i.reason, date: nowIso(),
    user: u.name, role: u.role, evidence: i.evidence, note: i.note ?? "", movementId: m.id };
  m.refId = l.id;
  db.losses.unshift(l);
  createAlert(db, { type: "Merma registrada", priority: "Baja", productId: p.id, locationId: i.locationId, refId: l.id,
    message: `${l.code}: ${i.quantity} ${p.unit} de ${p.name} (${i.reason})` });
  audit(db, "Registro de merma", "Merma", l.code, `${p.name} · ${i.quantity} ${p.unit} · ${locName(db, i.locationId)} · ${i.reason}`);
  return l;
}

// ---------- Products ----------
export type ProductInput = Pick<Product, "sku" | "name" | "categoryId" | "unit" | "minStock" | "targetStock" | "active">;
function validateProduct(db: DB, i: ProductInput, id?: string) {
  const sku = i.sku.trim().toUpperCase();
  if (!sku) fail("El SKU es obligatorio");
  if (!i.name.trim()) fail("El nombre es obligatorio");
  if (!db.categories.some((c) => c.id === i.categoryId)) fail("Seleccione una categoría válida");
  if (!i.unit.trim()) fail("La unidad es obligatoria");
  if (!Number.isInteger(i.minStock) || i.minStock < 0) fail("Stock mínimo inválido");
  if (!Number.isInteger(i.targetStock) || i.targetStock < i.minStock) fail("El stock objetivo debe ser mayor o igual al mínimo");
  if (db.products.some((p) => p.sku === sku && p.id !== id)) fail(`El SKU ${sku} ya existe`);
  return sku;
}
export function createProduct(db: DB, i: ProductInput, fixedId?: string) {
  const sku = validateProduct(db, i);
  const p: Product = { ...i, sku, name: i.name.trim(), id: fixedId ?? uid(), createdAt: nowIso() };
  db.products.push(p);
  for (const l of db.locations) {
    const row = { id: uid(), productId: p.id, locationId: l.id, stock: 0, reserved: 0, physical: null, lastCountAt: null };
    db.inventory.push(row);
    syncRowAlerts(db, row);
  }
  audit(db, "Creación de producto", "Producto", sku, p.name);
  return p;
}
export function updateProduct(db: DB, id: string, i: ProductInput) {
  const p = getProduct(db, id);
  const sku = validateProduct(db, i, id);
  const changes = (Object.keys(i) as (keyof ProductInput)[]).filter((k) => String(p[k]) !== String(k === "sku" ? sku : i[k]))
    .map((k) => `${k}: ${p[k]} → ${k === "sku" ? sku : i[k]}`);
  Object.assign(p, i, { sku, name: i.name.trim() });
  db.inventory.filter((r) => r.productId === id).forEach((r) => syncRowAlerts(db, r));
  audit(db, "Modificación de producto", "Producto", sku, changes.join("; ") || "Sin cambios");
}

export function setAlertStatus(db: DB, id: string, status: "Revisada" | "Resuelta") {
  const a = db.alerts.find((x) => x.id === id) ?? fail("Alerta no encontrada");
  a.status = status; a.updatedAt = nowIso();
  audit(db, `Alerta marcada como ${status.toLowerCase()}`, "Alerta", a.id, a.message);
}

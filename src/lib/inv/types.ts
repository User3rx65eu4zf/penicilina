export type Role = "Administrador" | "Encargado de almacén" | "Supervisor";
export const ROLES: Role[] = ["Administrador", "Encargado de almacén", "Supervisor"];
export const USERS: Record<Role, string> = {
  Administrador: "Lucía Vega",
  "Encargado de almacén": "Jorge Quispe",
  Supervisor: "Carmen Rojas",
};

export interface Category { id: string; name: string }
export interface Location { id: string; name: string; type: "CD" | "Tienda" }
export interface Product {
  id: string; sku: string; name: string; categoryId: string; unit: string;
  minStock: number; targetStock: number; active: boolean; createdAt: string;
}
export interface InventoryRow {
  id: string; productId: string; locationId: string;
  stock: number; reserved: number; physical: number | null; lastCountAt: string | null;
}
export type MovementType = "Entrada" | "Salida" | "Transferencia" | "Ajuste positivo" | "Ajuste negativo" | "Merma";
export const MOVEMENT_TYPES: MovementType[] = ["Entrada", "Salida", "Transferencia", "Ajuste positivo", "Ajuste negativo", "Merma"];
export interface Movement {
  id: string; code: string; date: string; productId: string; quantity: number;
  locationId: string; direction: "in" | "out";
  fromLocationId: string | null; toLocationId: string | null;
  type: MovementType; reason: string; user: string; role: Role; note: string;
  before: number; after: number; refType: string | null; refId: string | null;
}
export type TransferStatus = "Pendiente" | "En tránsito" | "Completada" | "Cancelada";
export interface Transfer {
  id: string; code: string; productId: string; fromId: string; toId: string; quantity: number;
  status: TransferStatus; createdAt: string; createdBy: string; note: string;
  dispatchedAt: string | null; dispatchedBy: string | null;
  receivedAt: string | null; receivedBy: string | null;
  cancelledAt: string | null; cancelledBy: string | null;
}
export interface StockCount {
  id: string; code: string; productId: string; locationId: string; systemStock: number;
  counted: number; difference: number; user: string; role: Role; date: string; note: string;
  reconciliationId: string | null;
}
export type ReconStatus = "Pendiente" | "En revisión" | "Conciliada" | "Rechazada";
export const RECON_REASONS = ["Error de registro", "Merma", "Pérdida", "Robo", "Movimiento no registrado", "Conteo incorrecto", "Producto deteriorado", "Otro"];
export interface Reconciliation {
  id: string; code: string; countId: string; productId: string; locationId: string;
  originalDifference: number; status: ReconStatus; reason: string | null; note: string;
  createdAt: string; createdBy: string; reviewedBy: string | null; reviewedRole: Role | null;
  reviewedAt: string | null; action: string | null; movementId: string | null;
}
export const LOSS_REASONS = ["Producto vencido", "Deterioro", "Rotura", "Manipulación", "Pérdida", "Otro"];
export interface Loss {
  id: string; code: string; productId: string; locationId: string; quantity: number; reason: string;
  date: string; user: string; role: Role; evidence: string; note: string; movementId: string;
}
export type AlertType = "Stock bajo" | "Stock crítico" | "Sin stock" | "Stock negativo" | "Diferencia de inventario" | "Transferencia demorada" | "Merma registrada";
export type Priority = "Alta" | "Media" | "Baja";
export type AlertStatus = "Pendiente" | "Revisada" | "Resuelta";
export interface Alert {
  id: string; type: AlertType; priority: Priority; status: AlertStatus;
  productId: string | null; locationId: string | null; message: string;
  createdAt: string; updatedAt: string; refId: string | null;
}
export interface AuditEntry {
  id: string; date: string; action: string; entity: string; entityId: string;
  user: string; role: Role; detail: string;
}
export interface DB {
  version: number;
  categories: Category[]; locations: Location[]; products: Product[]; inventory: InventoryRow[];
  movements: Movement[]; transfers: Transfer[]; counts: StockCount[]; reconciliations: Reconciliation[];
  losses: Loss[]; alerts: Alert[]; audit: AuditEntry[];
  seq: Record<string, number>;
  currentRole: Role;
}
export type StockStatus = "Normal" | "Bajo" | "Crítico" | "Sin stock";

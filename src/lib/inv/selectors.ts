import { available, stockStatus } from "./logic";
import type { DB, StockStatus } from "./types";

export interface InvView {
  id: string; productId: string; locationId: string; sku: string; product: string; category: string; unit: string;
  location: string; stock: number; reserved: number; available: number; physical: number | null;
  minStock: number; targetStock: number; difference: number | null; status: StockStatus; active: boolean;
}

export function inventoryView(db: DB): InvView[] {
  return db.inventory.map((r) => {
    const p = db.products.find((x) => x.id === r.productId)!;
    return {
      id: r.id, productId: p.id, locationId: r.locationId, sku: p.sku, product: p.name, unit: p.unit,
      category: db.categories.find((c) => c.id === p.categoryId)?.name ?? "—",
      location: db.locations.find((l) => l.id === r.locationId)?.name ?? "—",
      stock: r.stock, reserved: r.reserved, available: available(r), physical: r.physical,
      minStock: p.minStock, targetStock: p.targetStock, active: p.active,
      difference: r.physical === null ? null : r.physical - r.stock, status: stockStatus(r.stock, p.minStock),
    };
  });
}

export const STATUSES: StockStatus[] = ["Normal", "Bajo", "Crítico", "Sin stock"];
export const pName = (db: DB, id: string | null) => db.products.find((p) => p.id === id)?.name ?? "—";
export const pSku = (db: DB, id: string | null) => db.products.find((p) => p.id === id)?.sku ?? "—";

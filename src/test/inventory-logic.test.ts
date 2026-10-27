import { describe, expect, it } from "vitest";
import * as L from "@/lib/inv/logic";
import { buildSeed } from "@/lib/inv/seed";

const fresh = () => { const db = buildSeed(); return db; };

describe("Estados de stock", () => {
  it("clasifica según stock mínimo", () => {
    expect(L.stockStatus(0, 40)).toBe("Sin stock");
    expect(L.stockStatus(20, 40)).toBe("Crítico");
    expect(L.stockStatus(21, 40)).toBe("Bajo");
    expect(L.stockStatus(40, 40)).toBe("Bajo");
    expect(L.stockStatus(41, 40)).toBe("Normal");
  });
});

describe("Datos semilla", () => {
  it("cumple cantidades mínimas y kardex consistente", () => {
    const db = fresh();
    expect(db.products.length).toBeGreaterThanOrEqual(25);
    expect(db.movements.length).toBeGreaterThanOrEqual(40);
    expect(db.transfers.length).toBeGreaterThanOrEqual(5);
    expect(db.alerts.length).toBeGreaterThanOrEqual(8);
    expect(db.reconciliations.length).toBeGreaterThanOrEqual(5);
    expect(db.losses.length).toBeGreaterThanOrEqual(4);
    for (const row of db.inventory) {
      const k = db.movements.filter((m) => m.productId === row.productId && m.locationId === row.locationId);
      const bal = k.reduce((s, m) => s + (m.direction === "in" ? m.quantity : -m.quantity), 0);
      expect(bal).toBe(row.stock);
      expect(row.stock).toBeGreaterThanOrEqual(0);
    }
    expect(L.stockStatus(L.getRow(db, "p1", "norte").stock, 40)).toBe("Crítico");
  });
});

describe("Reglas de movimientos", () => {
  it("rechaza cantidades <= 0 y salidas mayores al disponible", () => {
    const db = fresh();
    expect(() => L.registerMovement(db, { type: "Salida", productId: "p1", locationId: "norte", quantity: 0, reason: "x" })).toThrow();
    expect(() => L.registerMovement(db, { type: "Salida", productId: "p1", locationId: "norte", quantity: 9999, reason: "x" })).toThrow();
  });
  it("transferencia solo suma al destino al recibir", () => {
    const db = fresh();
    const o = L.getRow(db, "p1", "cd").stock, d = L.getRow(db, "p1", "norte").stock;
    const t = L.createTransfer(db, { productId: "p1", fromId: "cd", toId: "norte", quantity: 50 });
    L.dispatchTransfer(db, t.id);
    expect(L.getRow(db, "p1", "cd").stock).toBe(o - 50);
    expect(L.getRow(db, "p1", "norte").stock).toBe(d);
    L.receiveTransfer(db, t.id);
    expect(L.getRow(db, "p1", "norte").stock).toBe(d + 50);
    expect(() => L.cancelTransfer(db, t.id)).toThrow();
    const open = db.alerts.filter((a) => a.productId === "p1" && a.locationId === "norte" && a.status !== "Resuelta");
    expect(open.length).toBe(0);
  });
  it("no permite transferir más que el disponible en origen", () => {
    const db = fresh();
    expect(() => L.createTransfer(db, { productId: "p1", fromId: "norte", toId: "sur", quantity: 9999 })).toThrow();
  });
});

describe("Conteo y conciliación", () => {
  it("diferencia genera conciliación y la aprobación corrige el stock", () => {
    const db = fresh();
    const s = L.getRow(db, "p2", "sur").stock;
    const c = L.registerCount(db, { productId: "p2", locationId: "sur", counted: s - 3 });
    expect(c.difference).toBe(-3);
    db.currentRole = "Supervisor";
    L.approveReconciliation(db, c.reconciliationId!, "Merma", "");
    expect(L.getRow(db, "p2", "sur").stock).toBe(s - 3);
    expect(db.alerts.find((a) => a.refId === c.reconciliationId)?.status).toBe("Resuelta");
  });
  it("encargado de almacén no puede aprobar", () => {
    const db = fresh();
    const s = L.getRow(db, "p2", "sur").stock;
    const c = L.registerCount(db, { productId: "p2", locationId: "sur", counted: s + 1 });
    db.currentRole = "Encargado de almacén";
    expect(() => L.approveReconciliation(db, c.reconciliationId!, "Otro", "")).toThrow();
  });
  it("SKU duplicado no permitido", () => {
    const db = fresh();
    expect(() => L.createProduct(db, { sku: "cv-1001", name: "X", categoryId: "cat1", unit: "u", minStock: 1, targetStock: 2, active: true })).toThrow();
  });
});

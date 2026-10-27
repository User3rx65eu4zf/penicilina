import * as L from "./logic";
import type { DB, Role } from "./types";

const CATS = ["Abarrotes", "Aceites", "Bebidas", "Lácteos", "Limpieza", "Cuidado personal", "Conservas"];
const PRODUCTS: [string, string, string, number, number][] = [
  // name, category, unit, min, target
  ["Aceite Primor Premium 1L", "Aceites", "botella", 40, 120],
  ["Arroz Costeño Extra 5kg", "Abarrotes", "bolsa", 30, 90],
  ["Azúcar Rubia Cartavio 1kg", "Abarrotes", "bolsa", 50, 150],
  ["Fideos Don Vittorio Spaghetti 500g", "Abarrotes", "paquete", 60, 180],
  ["Leche Gloria Evaporada 400g", "Lácteos", "lata", 80, 240],
  ["Yogurt Laive Fresa 1L", "Lácteos", "botella", 25, 70],
  ["Mantequilla Laive 200g", "Lácteos", "unidad", 20, 60],
  ["Inca Kola 1.5L", "Bebidas", "botella", 50, 160],
  ["Coca-Cola 1.5L", "Bebidas", "botella", 50, 160],
  ["Agua San Luis sin gas 625ml", "Bebidas", "botella", 70, 200],
  ["Cifrut Naranja 1.5L", "Bebidas", "botella", 30, 90],
  ["Atún Florida en trozos 170g", "Conservas", "lata", 40, 120],
  ["Leche condensada Nestlé 393g", "Conservas", "lata", 25, 75],
  ["Durazno en almíbar Dos Caballos 820g", "Conservas", "lata", 15, 45],
  ["Detergente Bolívar 2.6kg", "Limpieza", "bolsa", 20, 60],
  ["Lejía Clorox 1L", "Limpieza", "botella", 35, 100],
  ["Lavavajilla Ayudín 900g", "Limpieza", "pote", 25, 70],
  ["Papel higiénico Elite Doble Hoja x4", "Limpieza", "paquete", 40, 120],
  ["Jabón Protex Avena 110g", "Cuidado personal", "unidad", 40, 110],
  ["Shampoo H&S 375ml", "Cuidado personal", "botella", 15, 45],
  ["Pasta dental Colgate Triple Acción 75ml", "Cuidado personal", "unidad", 30, 90],
  ["Aceite Cocinero 900ml", "Aceites", "botella", 35, 100],
  ["Avena Quaker 300g", "Abarrotes", "bolsa", 30, 80],
  ["Menestra Lentejas Costeño 500g", "Abarrotes", "bolsa", 25, 70],
  ["Galletas Soda San Jorge x6", "Abarrotes", "paquete", 45, 130],
];

function rng(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
}
const daysAgo = (d: number, h = 9) => { const x = new Date(); x.setDate(x.getDate() - d); x.setHours(h, Math.floor(d * 7) % 60, 0, 0); return x; };

export function buildSeed(): DB {
  const r = rng(20261027);
  const db: DB = {
    version: 1, categories: CATS.map((name, i) => ({ id: `cat${i + 1}`, name })),
    locations: [
      { id: "cd", name: "CD Trapiche", type: "CD" },
      { id: "norte", name: "Tienda Norte", type: "Tienda" },
      { id: "centro", name: "Tienda Centro", type: "Tienda" },
      { id: "sur", name: "Tienda Sur", type: "Tienda" },
    ],
    products: [], inventory: [], movements: [], transfers: [], counts: [], reconciliations: [], losses: [], alerts: [], audit: [],
    seq: {}, currentRole: "Administrador",
  };
  const as = (role: Role, d: Date, fn: () => void) => { db.currentRole = role; L.setClock(d); fn(); };
  try {
    // Products
    PRODUCTS.forEach(([name, cat, unit, min, target], i) => as("Administrador", daysAgo(40), () => {
      L.createProduct(db, { sku: `CV-${String(1001 + i)}`, name, categoryId: db.categories.find((c) => c.name === cat)!.id, unit, minStock: min, targetStock: target, active: true }, `p${i + 1}`);
    }));
    db.alerts = []; // initial empty-stock alerts are superseded by opening balances
    // Opening balances
    db.products.forEach((p, i) => db.locations.forEach((l) => as("Encargado de almacén", daysAgo(30, 8), () => {
      let q = l.type === "CD" ? p.targetStock * 3 : Math.round(p.minStock * (0.9 + r() * 1.6));
      if (i === 0 && l.id === "norte") q = 30; // will become critical (demo)
      if (i === 5 && l.id === "sur") q = 12;
      if (i === 13 && l.id === "centro") q = 6;
      L.registerMovement(db, { type: "Entrada", productId: p.id, locationId: l.id, quantity: q, reason: "Inventario inicial", note: "Saldo de apertura" });
    })));
    // Sales / outputs in stores
    const stores = ["norte", "centro", "sur"];
    for (let k = 0; k < 45; k++) {
      const p = db.products[Math.floor(r() * db.products.length)]!;
      const loc = stores[Math.floor(r() * 3)]!;
      as("Encargado de almacén", daysAgo(28 - Math.floor(k / 2), 10 + (k % 8)), () => {
        const row = L.getRow(db, p.id, loc);
        const q = Math.min(L.available(row) - 1, Math.max(1, Math.round(p.minStock * (0.1 + r() * 0.4))));
        if (q > 0) L.registerMovement(db, { type: "Salida", productId: p.id, locationId: loc, quantity: q, reason: "Despacho a cliente mayorista", note: `Guía ${7000 + k}` });
      });
    }
    // Demo product: sales in Norte push it to critical
    as("Encargado de almacén", daysAgo(2, 15), () => L.registerMovement(db, { type: "Salida", productId: "p1", locationId: "norte", quantity: 14, reason: "Despacho a cliente mayorista", note: "Pedido Bodega San Martín" }));
    // CD replenishment entries
    for (let k = 0; k < 6; k++) as("Encargado de almacén", daysAgo(20 - k * 3), () =>
      L.registerMovement(db, { type: "Entrada", productId: `p${2 + k * 4}`, locationId: "cd", quantity: 100 + k * 20, reason: "Recepción de proveedor", note: `OC-2026-${310 + k}` }));
    // Transfers
    const t = (pid: string, to: string, q: number, d: number) => { let id = ""; as("Encargado de almacén", daysAgo(d), () => { id = L.createTransfer(db, { productId: pid, fromId: "cd", toId: to, quantity: q, note: "Reposición programada" }).id; }); return id; };
    const t1 = t("p5", "centro", 80, 12); as("Encargado de almacén", daysAgo(12, 14), () => L.dispatchTransfer(db, t1)); as("Encargado de almacén", daysAgo(11), () => L.receiveTransfer(db, t1));
    const t2 = t("p9", "sur", 60, 9); as("Encargado de almacén", daysAgo(9, 13), () => L.dispatchTransfer(db, t2)); as("Encargado de almacén", daysAgo(8), () => L.receiveTransfer(db, t2));
    const t3 = t("p16", "norte", 40, 1); as("Encargado de almacén", daysAgo(1, 12), () => L.dispatchTransfer(db, t3));
    t("p6", "sur", 30, 4); // pending too long
    t("p12", "centro", 50, 0);
    // Losses
    const losses: [string, string, number, string, string][] = [
      ["p6", "centro", 4, "Producto vencido", "Lote L-2210 con fecha vencida 15/10"],
      ["p16", "sur", 3, "Rotura", "Botellas rotas durante descarga, foto en parte interno"],
      ["p8", "norte", 6, "Manipulación", "Fardos aplastados en almacén de tienda"],
      ["p14", "cd", 5, "Deterioro", "Latas abolladas detectadas en control de calidad"],
    ];
    losses.forEach(([pid, loc, q, reason, ev], k) => as("Encargado de almacén", daysAgo(15 - k * 4), () => L.registerLoss(db, { productId: pid, locationId: loc, quantity: q, reason, evidence: ev })));
    // Counts → reconciliations
    const counts: [string, string, number, number][] = [["p3", "norte", -5, 14], ["p10", "centro", 3, 10], ["p18", "sur", -8, 6], ["p20", "cd", -4, 3], ["p22", "norte", 6, 2]];
    const recIds: string[] = [];
    counts.forEach(([pid, loc, diff, d]) => as("Encargado de almacén", daysAgo(d), () => {
      const row = L.getRow(db, pid, loc);
      const c = L.registerCount(db, { productId: pid, locationId: loc, counted: row.stock + diff, note: "Conteo cíclico" });
      recIds.push(c.reconciliationId!);
    }));
    as("Supervisor", daysAgo(13), () => L.approveReconciliation(db, recIds[0]!, "Error de registro", "Salida no digitada"));
    as("Supervisor", daysAgo(9), () => L.approveReconciliation(db, recIds[1]!, "Movimiento no registrado", "Devolución de cliente no ingresada"));
    as("Supervisor", daysAgo(5), () => L.rejectReconciliation(db, recIds[2]!, "Conteo incorrecto", "Se solicita reconteo con dos operarios"));
    as("Supervisor", daysAgo(1), () => L.startReview(db, recIds[3]!));
    L.setClock(null);
    L.syncTransferAlerts(db);
  } finally { L.setClock(null); }
  db.currentRole = "Administrador";
  return db;
}

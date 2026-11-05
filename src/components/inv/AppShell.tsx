import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  LayoutDashboard, Package, Warehouse, ArrowLeftRight, Truck, ClipboardCheck, Scale, Trash2, Bell,
  BookOpen, FileBarChart, ShieldCheck, Gauge,
} from "lucide-react";
import { useDB, connectShared, useSyncStatus, setLocalRole, shareLocalInventory, refreshShared } from "@/lib/inv/store";
import { ROLES, USERS, type Role } from "@/lib/inv/types";
import { Button } from '@/components/ui/button';

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/productos", label: "Productos", icon: Package },
  { to: "/inventario", label: "Inventario por sede", icon: Warehouse },
  { to: "/movimientos", label: "Movimientos", icon: ArrowLeftRight },
  { to: "/transferencias", label: "Transferencias", icon: Truck },
  { to: "/conteos", label: "Conteo físico", icon: ClipboardCheck },
  { to: "/conciliaciones", label: "Conciliación", icon: Scale },
  { to: "/mermas", label: "Mermas", icon: Trash2 },
  { to: "/alertas", label: "Alertas", icon: Bell },
  { to: "/kardex", label: "Kardex", icon: BookOpen },
  { to: "/reportes", label: "Reportes", icon: FileBarChart },
  { to: "/auditoria", label: "Auditoría", icon: ShieldCheck },
  { to: "/dashboard", label: "Calidad del software", icon: Gauge },
] as const;

function Shell({ children }: { children: ReactNode }) {
  const db = useDB();
  const status = useSyncStatus();
  const activeAlerts = db.alerts.filter((a) => a.status !== "Resuelta").length;
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="border-b border-sidebar-border px-5 py-5">
          <div className="text-xs font-medium uppercase tracking-widest text-sidebar-primary">Corporación Vega</div>
          <div className="mt-1 text-sm font-semibold text-sidebar-accent-foreground">Inventario Distribuido</div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} activeOptions={{ exact: to === "/" }}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground font-medium" }}>
              <Icon className="h-4 w-4" />
              <span className="flex-1">{label}</span>
              {to === "/alertas" && activeAlerts > 0 && (
                <span className="rounded-full bg-sidebar-primary px-1.5 text-xs font-semibold text-sidebar-primary-foreground">{activeAlerts}</span>
              )}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b bg-card/95 px-6 py-3 backdrop-blur">
          <select className="field-select w-auto md:hidden" onChange={(e) => (window.location.href = e.target.value)} value="">
            <option value="">Ir a…</option>
            {NAV.map((n) => <option key={n.to} value={n.to}>{n.label}</option>)}
          </select>
          <div role="status" className={`text-xs ${status === 'offline' ? 'text-destructive' : 'text-success'}`}>{status === 'saving' ? 'Guardando…' : status === 'offline' ? 'Sin conexión · no se guardarán cambios' : 'Inventario sincronizado'}</div>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-3">
            <div className="text-right text-sm leading-tight">
              <div className="font-medium">{USERS[db.currentRole]}</div>
              <div className="text-xs text-muted-foreground">{db.currentRole}</div>
            </div>
            <select className="field-select w-auto" value={db.currentRole} aria-label="Rol"
              onChange={(e) => setLocalRole(e.target.value as Role)}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const status = useSyncStatus();
  const [connected, setConnected] = useState(false);
  useEffect(() => { const cleanup = connectShared(); setConnected(true); return cleanup; }, []);
  if (!connected || status === 'loading') return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Conectando inventario…</div>;
  if (status === 'uninitialized') return <div className="flex min-h-screen items-center justify-center p-6"><div className="max-w-lg space-y-4"><h1 className="text-2xl font-semibold">Compartir inventario</h1><p className="text-muted-foreground">Todavía no hay un inventario compartido. Continúe desde el dispositivo donde registró sus movimientos.</p><p className="text-sm text-warning-foreground">Sin cuentas ni contraseña: cualquier persona con el enlace podrá consultar y modificar el inventario. Los nombres y roles siguen siendo simulados.</p><Button onClick={() => void shareLocalInventory()}>Compartir inventario de este dispositivo</Button></div></div>;
  if (status === 'offline' && !connected) return null;
  return <ConnectedShell>{children}</ConnectedShell>;
}

function ConnectedShell({ children }: { children: ReactNode }) {
  const status = useSyncStatus();
  // A first failed read has no snapshot to render. Retrying never creates local demo data.
  if (status === 'offline') return <div className="flex min-h-screen items-center justify-center p-6"><div className="space-y-4"><h1 className="text-xl font-semibold">No se pudo conectar el inventario</h1><Button onClick={() => void refreshShared()}>Reintentar</Button></div></div>;
  return <Shell>{children}</Shell>;
}

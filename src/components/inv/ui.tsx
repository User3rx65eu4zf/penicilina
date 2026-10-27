import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { DB } from "@/lib/inv/types";
import { Download } from "lucide-react";

export const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const TONES = {
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/20 text-warning-foreground border-warning/40",
  critical: "bg-critical/15 text-critical border-critical/30",
  danger: "bg-destructive/15 text-destructive border-destructive/30",
  info: "bg-info/15 text-info border-info/30",
  muted: "bg-muted text-muted-foreground border-border",
  primary: "bg-primary/10 text-primary border-primary/20",
} as const;
export type Tone = keyof typeof TONES;
const TONE_MAP: Record<string, Tone> = {
  Normal: "success", Bajo: "warning", "Crítico": "critical", "Sin stock": "danger",
  Alta: "danger", Media: "critical", Baja: "warning",
  Pendiente: "warning", "En tránsito": "info", Completada: "success", Cancelada: "muted",
  "En revisión": "info", Conciliada: "success", Rechazada: "muted", Revisada: "info", Resuelta: "success",
};
export function Pill({ children, tone }: { children: ReactNode; tone?: Tone }) {
  const t = tone ?? TONE_MAP[String(children)] ?? "muted";
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium", TONES[t])}>{children}</span>;
}

export function Panel({ title, children, className, actions }: { title?: string; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={cn("rounded-lg border bg-card shadow-card", className)}>
      {title && (
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>{actions}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Field({ label, children, error }: { label: string; children: ReactNode; error?: string }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </label>
  );
}

export function Select({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string;
}) {
  return (
    <select className="field-select" value={value} onChange={(e) => onChange(e.target.value)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
export const productOptions = (db: DB, onlyActive = true) =>
  db.products.filter((p) => !onlyActive || p.active).map((p) => ({ value: p.id, label: `${p.sku} · ${p.name}` }));
export const locationOptions = (db: DB) => db.locations.map((l) => ({ value: l.id, label: l.name }));

export function Confirm({ trigger, title, description, onConfirm, confirmLabel = "Confirmar" }: {
  trigger: ReactNode; title: string; description: ReactNode; onConfirm: () => void; confirmLabel?: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild><div>{description}</div></AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>;
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-md border"><table className="data-table w-full">{children}</table></div>;
}

export function downloadCsv(name: string, rows: (string | number | null)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = `${name}.csv`; a.click();
  URL.revokeObjectURL(a.href);
}
export function CsvButton({ name, rows }: { name: string; rows: () => (string | number | null)[][] }) {
  return <Button variant="outline" size="sm" onClick={() => downloadCsv(name, rows())}><Download className="mr-1.5 h-4 w-4" />Exportar CSV</Button>;
}

export function Kpi({ label, value, tone = "primary", hint }: { label: string; value: ReactNode; tone?: Tone; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-card">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span className={cn("h-2 w-2 rounded-full border", TONES[tone])} />{label}
      </div>
      <div className="mt-2 font-mono text-3xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

import { useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity, ArrowDownRight, ArrowUpRight, CheckCircle2, Clock, Code2, Database, FileCheck2,
  FlaskConical, Gauge, GitMerge, ShieldCheck,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, Legend, Line, LineChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useDB, useOperations } from "@/lib/inv/store";
import { qualityMetrics } from "@/lib/inv/quality";
import { locName } from "@/lib/inv/logic";
import { Button } from "@/components/ui/button";
import { fmtDate, PageHeader, Pill, Select, TableWrap } from "@/components/inv/ui";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Calidad del software · Inventario Corporación Vega" },
      { name: "description", content: "Dashboard de calidad del producto y del proceso de ingeniería del sistema de inventario distribuido." },
      { property: "og:title", content: "Calidad del software · Inventario Corporación Vega" },
      { property: "og:description", content: "Dashboard de calidad del producto y del proceso de ingeniería del sistema de inventario distribuido." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QualityDashboard,
});

const C1 = "var(--chart-1)";
const C2 = "var(--chart-2)";
const C3 = "var(--chart-3)";
const BAD = "var(--destructive)";


// ---------- UI ----------
function Card({ children, className = "" }: { children: ReactNode; className?: string | undefined }) {
  return <div className={`rounded-xl border border-border bg-card p-5 shadow-sm ${className}`}>{children}</div>;
}

function Metric({ label, value, icon, hint, delta, good, tone }: {
  label: string; value: string; icon: ReactNode; hint: string; delta?: string; good?: boolean; tone?: "success";
}) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={`rounded-md p-1.5 ${tone === "success" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>{icon}</span>
      </div>
      <div className={`mt-3 font-mono text-3xl font-bold ${tone === "success" ? "text-success" : ""}`}>{value}</div>
      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        {delta && (
          <span className={`flex items-center font-semibold ${good ? "text-success" : "text-destructive"}`}>
            {delta.startsWith("-") ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
            {delta}
          </span>
        )}
        {hint}
      </div>
    </Card>
  );
}

function ChartCard({ title, subtitle, children, className }: { title: string; subtitle: string; children: ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mb-4 text-xs text-muted-foreground">{subtitle}</p>
      <div className="h-72">{children}</div>
    </Card>
  );
}

const axis = { fontSize: 11, fill: "var(--muted-foreground)" };
const tip = { contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 } };

function ProductTab({ period }: { period: string }) {
  const db = useDB();
  const metrics = qualityMetrics(db, useOperations(), period);
  const percent = (value: number | null) => value === null ? "—" : `${value.toFixed(1)}%`;
  const latency = metrics.buckets;
  const ops = metrics.buckets;
  const alerts = metrics.alerts;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Metric label="Saldos inconsistentes" value={String(metrics.inconsistent)} icon={<Database className="h-4 w-4" />} hint={`${db.inventory.length} saldos comprobados · Kardex vs stock`} />
        <Metric label="Éxito de operaciones" value={percent(metrics.successRate)} tone="success" icon={<CheckCircle2 className="h-4 w-4" />} hint={`${metrics.success}/${metrics.total} guardadas · periodo seleccionado`} />
        <Metric label="Trazabilidad" value={percent(metrics.traceRate)} icon={<ShieldCheck className="h-4 w-4" />} hint={`${metrics.moves} movimientos en el periodo`} />
        <Metric label="Latencia p95" value={metrics.p95 === null ? "—" : `${metrics.p95} ms`} icon={<Activity className="h-4 w-4" />} hint="lectura + guardado confirmado" />
      </div>

      <ChartCard title="Latencia de operaciones críticas" subtitle="Guardados confirmados · periodo seleccionado">
        <ResponsiveContainer>
          <LineChart data={latency} margin={{ right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="h" tick={axis} />
            <YAxis tick={axis} unit="ms" domain={[0, "auto"]} />
            <Tooltip {...tip} />
            <ReferenceLine y={1000} stroke={BAD} strokeDasharray="5 5" label={{ value: "Meta 1000ms", fill: BAD, fontSize: 10, position: "insideTopRight" }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="p95" stroke={C1} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="p99" stroke={C3} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard title="Volumen de operaciones" subtitle="Operaciones compartidas · periodo seleccionado">
          <ResponsiveContainer>
            <AreaChart data={ops}>
              <defs>
                <linearGradient id="opsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C1} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={C1} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="h" tick={axis} interval={3} />
              <YAxis tick={axis} />
              <Tooltip {...tip} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="ok" name="Exitosas" stroke={C1} fill="url(#opsFill)" strokeWidth={2} />
              <Area type="monotone" dataKey="fail" name="Fallidas" stroke={BAD} fill={BAD} fillOpacity={0.15} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <Card>
          <h3 className="text-sm font-semibold">Alertas recientes</h3>
          <p className="mb-4 text-xs text-muted-foreground">Anomalías detectadas en operaciones del inventario</p>
          <TableWrap>
            <thead><tr><th>Fecha</th><th>Nodo</th><th>Operación</th><th>Gravedad</th><th>Estado</th></tr></thead>
            <tbody>
              {alerts.length === 0 && <tr><td colSpan={5} className="text-muted-foreground">Sin alertas en este periodo</td></tr>}
              {alerts.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap font-mono text-xs">{fmtDate(a.updatedAt)}</td>
                  <td className="text-sm">{locName(db, a.locationId)}</td>
                  <td className="text-sm">{a.type}</td>
                  <td><Pill tone={a.priority === "Alta" ? "danger" : a.priority === "Media" ? "warning" : "muted"}>{a.priority}</Pill></td>
                  <td className={`text-sm ${a.status === "Resuelta" ? "text-success" : ""}`}>{a.status}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </Card>
      </div>
    </div>
  );
}

function ProcessTab() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Metric label="Pruebas exitosas" value="—" icon={<FlaskConical className="h-4 w-4" />} hint="Sin medición de integración continua" />
        <Metric label="Cobertura de ramas" value="—" icon={<Code2 className="h-4 w-4" />} hint="Sin reporte de cobertura conectado" />
        <Metric label="Requisitos verificados" value="—" icon={<FileCheck2 className="h-4 w-4" />} hint="Sin medición de requisitos" />
        <Metric label="Tiempo de ciclo" value="—" icon={<Clock className="h-4 w-4" />} hint="Sin historial de integraciones" />
      </div>
      <div className="border-y border-border py-12 text-center text-sm text-muted-foreground">Sin mediciones del proceso de ingeniería</div>
    </div>
  );
}

const PERIODS = [
  { value: "24h", label: "Últimas 24h" },
  { value: "7d", label: "Últimos 7 días" },
  { value: "30d", label: "Últimos 30 días" },
];

function QualityDashboard() {
  const [tab, setTab] = useState<"product" | "process">("product");
  const [period, setPeriod] = useState("24h");
  const tabs = [
    { id: "product" as const, label: "Calidad del Producto", icon: <Gauge className="h-4 w-4" /> },
    { id: "process" as const, label: "Proceso de Ingeniería", icon: <GitMerge className="h-4 w-4" /> },
  ];
  return (
    <>
      <PageHeader
        title="Dashboard de calidad"
        description="Actividad compartida del inventario"
        actions={<div className="w-44"><Select value={period} onChange={setPeriod} options={PERIODS} /></div>}
      />
      <div className="mb-5 inline-flex rounded-lg border border-border bg-muted p-1">
        {tabs.map((t) => (
          <Button variant="ghost"
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition ${tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t.icon}{t.label}
          </Button>
        ))}
      </div>
      {tab === "product" ? <ProductTab period={period} /> : <ProcessTab />}
    </>
  );
}

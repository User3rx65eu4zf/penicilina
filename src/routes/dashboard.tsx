import { useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity, ArrowDownRight, ArrowUpRight, CheckCircle2, Clock, Code2, Database, FileCheck2,
  FlaskConical, Gauge, GitMerge, ShieldCheck,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, PolarAngleAxis, PolarGrid,
  PolarRadiusAxis, Radar, RadarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { PageHeader, Pill, Select, TableWrap } from "@/components/inv/ui";

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
const OK = "var(--success)";

// ---------- Datos de muestra (ilustrativos para la presentación) ----------
const latency = Array.from({ length: 24 }, (_, h) => {
  const wave = Math.sin((h / 24) * Math.PI * 2 - 1) * 60;
  return { h: `${String(h).padStart(2, "0")}:00`, p95: Math.round(380 + wave + (h % 5) * 12), p99: Math.round(690 + wave * 1.8 + (h % 4) * 25) };
});
const ops = Array.from({ length: 24 }, (_, h) => ({
  h: `${String(h).padStart(2, "0")}:00`,
  ok: Math.round(40 + 260 * Math.exp(-((h - 13) ** 2) / 14)),
  fail: Math.round(Math.max(0, 3 * Math.exp(-((h - 13) ** 2) / 10))),
}));
const alerts = [
  { t: "2026-11-03 17:58", node: "Tienda Norte", op: "Transferencia", sev: "Crítica", st: "Abierta" },
  { t: "2026-11-03 17:41", node: "CD Trapiche", op: "Ajuste de Kardex", sev: "Alta", st: "Investigando" },
  { t: "2026-11-03 16:22", node: "Tienda Sur", op: "Conteo físico", sev: "Media", st: "Resuelta" },
  { t: "2026-11-03 15:09", node: "Tienda Centro", op: "Recepción", sev: "Baja", st: "Resuelta" },
  { t: "2026-11-03 13:47", node: "CD Trapiche", op: "Conciliación", sev: "Media", st: "Resuelta" },
];
const sprints = [
  { s: "S-1", ok: 38, fail: 6 }, { s: "S-2", ok: 52, fail: 5 }, { s: "S-3", ok: 61, fail: 4 },
  { s: "S-4", ok: 74, fail: 3 }, { s: "S-5", ok: 86, fail: 1 }, { s: "S-6", ok: 97, fail: 0 },
];
const cycle = [
  { m: "Jun", ciclo: 4.8, integ: 88 }, { m: "Jul", ciclo: 4.1, integ: 91 }, { m: "Ago", ciclo: 3.6, integ: 93 },
  { m: "Sep", ciclo: 3.1, integ: 95 }, { m: "Oct", ciclo: 2.7, integ: 97 }, { m: "Nov", ciclo: 2.4, integ: 98 },
];
const coverage = [
  { mod: "Transferencias", actual: 92, meta: 80 }, { mod: "Kardex", actual: 88, meta: 80 },
  { mod: "Conciliación", actual: 84, meta: 80 }, { mod: "Conteos", actual: 76, meta: 80 },
  { mod: "Permisos", actual: 90, meta: 80 }, { mod: "Catálogo SKU", actual: 81, meta: 80 },
];
const requirements = [
  { r: "RF-01 Registro de SKU único", crit: true, ok: true },
  { r: "RF-04 Transferencia entre nodos", crit: true, ok: true },
  { r: "RF-07 Conciliación automática", crit: true, ok: true },
  { r: "RF-09 Aprobación por Supervisor", crit: true, ok: true },
  { r: "RF-12 Exportación CSV de reportes", crit: false, ok: false },
];

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

function ProductTab() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Metric label="Integridad del inventario" value="0.08%" icon={<Database className="h-4 w-4" />} delta="-0.02%" good hint="fallas de invariantes · meta 0%" />
        <Metric label="Éxito de operaciones" value="99.6%" tone="success" icon={<CheckCircle2 className="h-4 w-4" />} hint="operaciones críticas · meta ≥ 99%" />
        <Metric label="Trazabilidad" value="100%" icon={<ShieldCheck className="h-4 w-4" />} hint="operaciones con auditoría · meta 100%" />
        <Metric label="Consistencia persistencia" value="100%" icon={<Activity className="h-4 w-4" />} hint="lectura tras escritura · meta 100%" />
      </div>

      <ChartCard title="Latencia de operaciones críticas" subtitle="p95 y p99 en las últimas 24h · meta p95 ≤ 1 s">
        <ResponsiveContainer>
          <LineChart data={latency} margin={{ right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="h" tick={axis} />
            <YAxis tick={axis} unit="ms" domain={[0, 1200]} />
            <Tooltip {...tip} />
            <ReferenceLine y={1000} stroke={BAD} strokeDasharray="5 5" label={{ value: "Meta 1000ms", fill: BAD, fontSize: 10, position: "insideTopRight" }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="p95" stroke={C1} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="p99" stroke={C3} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard title="Volumen de operaciones" subtitle="Transferencias, ajustes y conteos por hora">
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
              {alerts.map((a) => (
                <tr key={a.t}>
                  <td className="whitespace-nowrap font-mono text-xs">{a.t}</td>
                  <td className="text-sm">{a.node}</td>
                  <td className="text-sm">{a.op}</td>
                  <td><Pill tone={a.sev === "Crítica" ? "danger" : a.sev === "Alta" ? "warning" : a.sev === "Media" ? "primary" : "muted"}>{a.sev}</Pill></td>
                  <td className={`text-sm ${a.st === "Resuelta" ? "text-success" : ""}`}>{a.st}</td>
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
        <Metric label="Pruebas exitosas" value="100%" tone="success" icon={<FlaskConical className="h-4 w-4" />} delta="+2.1%" good hint="97/97 · meta 100%" />
        <Metric label="Cobertura de ramas" value="85.2%" icon={<Code2 className="h-4 w-4" />} delta="+1.8%" good hint="lógica de negocio · meta ≥ 80%" />
        <Metric label="Requisitos verificados" value="92%" icon={<FileCheck2 className="h-4 w-4" />} hint="críticos 100% · meta ≥ 90%" />
        <Metric label="Tiempo de ciclo" value="2.4 días" icon={<Clock className="h-4 w-4" />} delta="-0.3d" good hint="mediana inicio → integración" />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard title="Resultado de pruebas por sprint" subtitle="Pruebas aprobadas vs. fallidas · últimos 6 sprints">
          <ResponsiveContainer>
            <BarChart data={sprints}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="s" tick={axis} />
              <YAxis tick={axis} />
              <Tooltip {...tip} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="ok" name="Aprobadas" stackId="a" fill={C1} />
              <Bar dataKey="fail" name="Fallidas" stackId="a" fill={BAD} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Integraciones y tiempo de ciclo" subtitle="% integraciones exitosas (test + lint + build) y días de ciclo">
          <ResponsiveContainer>
            <LineChart data={cycle}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="m" tick={axis} />
              <YAxis yAxisId="l" tick={axis} domain={[80, 100]} unit="%" />
              <YAxis yAxisId="r" orientation="right" tick={axis} domain={[0, 6]} unit="d" />
              <Tooltip {...tip} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line yAxisId="l" type="monotone" dataKey="integ" name="Integraciones exitosas" stroke={C1} strokeWidth={2} />
              <Line yAxisId="r" type="monotone" dataKey="ciclo" name="Tiempo de ciclo" stroke={C2} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-[3fr_2fr]">
        <ChartCard title="Cobertura por módulo" subtitle="Cobertura de ramas actual vs. meta (%)">
          <ResponsiveContainer>
            <RadarChart data={coverage}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="mod" tick={axis} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Tooltip {...tip} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Radar name="Actual" dataKey="actual" stroke={C1} fill={C1} fillOpacity={0.35} />
              <Radar name="Meta" dataKey="meta" stroke={C2} fill="none" strokeDasharray="4 4" />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>

        <Card>
          <h3 className="text-sm font-semibold">Trazabilidad de requisitos</h3>
          <p className="mb-4 text-xs text-muted-foreground">Requisitos aprobados y su verificación</p>
          <ul className="space-y-2.5">
            {requirements.map((r) => (
              <li key={r.r} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                <span>{r.r}{r.crit && <span className="ml-2 text-[10px] font-semibold uppercase text-primary">crítico</span>}</span>
                {r.ok ? <Pill tone="success">Verificado</Pill> : <Pill tone="warning">Pendiente</Pill>}
              </li>
            ))}
          </ul>
        </Card>
      </div>
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
        description="Indicadores del producto software y del proceso de ingeniería · datos de muestra para la presentación"
        actions={<div className="w-44"><Select value={period} onChange={setPeriod} options={PERIODS} /></div>}
      />
      <div className="mb-5 inline-flex rounded-lg border border-border bg-muted p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition ${tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>
      {tab === "product" ? <ProductTab /> : <ProcessTab />}
    </>
  );
}

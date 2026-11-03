import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FlaskConical, Gauge, Sparkles } from "lucide-react";
import { Empty, Kpi, PageHeader, Panel, Pill, Select, TableWrap } from "@/components/inv/ui";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Seguimiento de calidad · Inventario Corporación Vega" },
      { name: "description", content: "Indicadores de calidad del producto software y del proceso de Ingeniería de Software." },
      { property: "og:title", content: "Seguimiento de calidad · Inventario Corporación Vega" },
      { property: "og:description", content: "Indicadores de calidad del producto software y del proceso de Ingeniería de Software." },
    ],
  }),
  component: QualityDashboard,
});

type MeasurementStatus = "Medido" | "Sin medición disponible" | "Requiere instrumentación";

interface Indicator {
  code: string;
  name: string;
  formula: string;
  goal: string;
  source: string;
  status: MeasurementStatus;
  missing: string;
  value: number | null;
  unit: string;
  measuredAt: string | null;
}

const PRODUCT_INDICATORS: Indicator[] = [
  {
    code: "IPS-01",
    name: "Integridad del inventario",
    formula: "Verificaciones fallidas de invariantes / verificaciones ejecutadas × 100",
    goal: "0%",
    source: "Verificador de invariantes del inventario (no implementado)",
    status: "Requiere instrumentación",
    missing: "Falta un verificador que ejecute los invariantes (saldos no negativos, Kardex = stock) y registre sus resultados.",
    value: null,
    unit: "%",
    measuredAt: null,
  },
  {
    code: "IPS-02",
    name: "Éxito de operaciones críticas válidas",
    formula: "Operaciones válidas completadas / intentos válidos × 100",
    goal: "≥ 99%",
    source: "Registro de intentos y resultados de operaciones (no implementado)",
    status: "Requiere instrumentación",
    missing: "Falta registrar cada intento de operación crítica (transferencias, ajustes, conciliaciones) con su resultado.",
    value: null,
    unit: "%",
    measuredAt: null,
  },
  {
    code: "IPS-03",
    name: "Latencia p95",
    formula: "Percentil 95 del tiempo entre enviar una operación crítica y ver su confirmación",
    goal: "≤ 1 segundo",
    source: "Medición de tiempos en la capa de acciones (no implementada)",
    status: "Requiere instrumentación",
    missing: "Falta medir y almacenar el tiempo de ida y vuelta de cada operación crítica.",
    value: null,
    unit: "s",
    measuredAt: null,
  },
  {
    code: "IPS-04",
    name: "Trazabilidad",
    formula: "Operaciones exitosas con registro de auditoría / operaciones exitosas que cambian estado × 100",
    goal: "100%",
    source: "Cruce entre bitácora de auditoría y operaciones (no implementado)",
    status: "Requiere instrumentación",
    missing: "Falta un cruce automático que verifique que cada operación exitosa tenga su entrada de auditoría.",
    value: null,
    unit: "%",
    measuredAt: null,
  },
  {
    code: "IPS-05",
    name: "Consistencia de persistencia",
    formula: "Operaciones cuyo estado leído desde localStorage coincide con el estado confirmado / operaciones confirmadas × 100",
    goal: "100%",
    source: "Verificación de lectura tras escritura (no implementada)",
    status: "Requiere instrumentación",
    missing: "Falta una verificación que relea el estado persistido tras cada operación y lo compare con el confirmado.",
    value: null,
    unit: "%",
    measuredAt: null,
  },
];

const PROCESS_INDICATORS: Indicator[] = [
  {
    code: "IPI-01",
    name: "Pruebas exitosas",
    formula: "Pruebas aprobadas / pruebas ejecutadas × 100",
    goal: "100%",
    source: "Reporte de la suite de pruebas automatizadas (no conectado)",
    status: "Requiere instrumentación",
    missing: "Falta conectar el reporte de ejecución de pruebas para alimentar este indicador automáticamente.",
    value: null,
    unit: "%",
    measuredAt: null,
  },
  {
    code: "IPI-02",
    name: "Cobertura de ramas",
    formula: "Ramas de la lógica de negocio ejecutadas por pruebas / ramas detectadas × 100",
    goal: "≥ 80%",
    source: "Reporte de cobertura de código (no conectado)",
    status: "Requiere instrumentación",
    missing: "Falta generar y conectar el reporte de cobertura de ramas de la lógica de negocio.",
    value: null,
    unit: "%",
    measuredAt: null,
  },
  {
    code: "IPI-03",
    name: "Requisitos verificados",
    formula: "Requisitos aprobados con prueba o verificación asociada / requisitos aprobados × 100",
    goal: "100% de requisitos críticos y ≥ 90% del total",
    source: "Matriz de trazabilidad de requisitos (no implementada)",
    status: "Requiere instrumentación",
    missing: "Falta una matriz que vincule cada requisito aprobado con su prueba o verificación.",
    value: null,
    unit: "%",
    measuredAt: null,
  },
  {
    code: "IPI-04",
    name: "Integraciones exitosas",
    formula: "Ejecuciones con test, lint y build exitosos / ejecuciones completas × 100",
    goal: "100% de las integraciones aceptadas",
    source: "Historial del pipeline de integración continua (no conectado)",
    status: "Requiere instrumentación",
    missing: "Falta conectar el historial del pipeline (test, lint, build) para contabilizar integraciones.",
    value: null,
    unit: "%",
    measuredAt: null,
  },
  {
    code: "IPI-05",
    name: "Tiempo de ciclo",
    formula: "Mediana del tiempo entre el inicio de un trabajo y su integración",
    goal: "Establecer una línea base y mejorarla sin reducir la calidad",
    source: "Registro de tiempos del flujo de trabajo (no implementado)",
    status: "Requiere instrumentación",
    missing: "Falta registrar las fechas de inicio e integración de cada trabajo para calcular la mediana.",
    value: null,
    unit: "días",
    measuredAt: null,
  },
];

const PERIODS = [
  { value: "7", label: "Últimos 7 días" },
  { value: "30", label: "Últimos 30 días" },
  { value: "90", "label": "Últimos 90 días" },
  { value: "all", label: "Todo el historial" },
] as const;

function inPeriod(measuredAt: string | null, days: string): boolean {
  if (!measuredAt) return false;
  if (days === "all") return true;
  const limit = Date.now() - Number(days) * 24 * 60 * 60 * 1000;
  return new Date(measuredAt).getTime() >= limit;
}

function IndicatorTable({ indicators, period }: { indicators: Indicator[]; period: string }) {
  const visible = indicators.filter((i) => i.status !== "Medido" || inPeriod(i.measuredAt, period));
  if (visible.length === 0) return <Empty>No hay mediciones en el periodo seleccionado.</Empty>;
  return (
    <TableWrap>
      <thead>
        <tr>
          <th>Indicador</th>
          <th>Fórmula</th>
          <th>Meta propuesta</th>
          <th className="num">Valor</th>
          <th>Fecha de medición</th>
          <th>Fuente</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>
        {visible.map((i) => (
          <tr key={i.code}>
            <td>
              <div className="font-medium">{i.name}</div>
              <div className="font-mono text-xs text-muted-foreground">{i.code}</div>
            </td>
            <td className="max-w-xs text-xs text-muted-foreground">{i.formula}</td>
            <td className="whitespace-nowrap text-sm">{i.goal}</td>
            <td className="num font-mono">
              {i.value !== null ? `${i.value}${i.unit === "%" ? "%" : ` ${i.unit}`}` : "—"}
            </td>
            <td className="whitespace-nowrap text-xs">
              {i.measuredAt
                ? new Date(i.measuredAt).toLocaleString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
                : "—"}
            </td>
            <td className="max-w-xs text-xs text-muted-foreground">
              {i.source}
              {i.status !== "Medido" && <div className="mt-1 text-xs">{i.missing}</div>}
            </td>
            <td>
              {i.status === "Medido" ? <Pill tone="success">Medido</Pill> : <Pill tone="muted">{i.status}</Pill>}
            </td>
          </tr>
        ))}
      </tbody>
    </TableWrap>
  );
}

function QualityDashboard() {
  const [period, setPeriod] = useState<string>("30");
  const all = useMemo(() => [...PRODUCT_INDICATORS, ...PROCESS_INDICATORS], []);
  const measured = all.filter((i) => i.status === "Medido" && inPeriod(i.measuredAt, period));
  const unmeasured = all.length - all.filter((i) => i.status === "Medido").length;
  const hasHistory = measured.some((i) => i.measuredAt !== null);

  return (
    <>
      <PageHeader
        title="Seguimiento de calidad del software"
        description="Indicadores del producto software y del proceso de Ingeniería de Software. Solo se muestran valores con fuente verificable."
        actions={
          <div className="w-48">
            <Select value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p.value, label: p.label }))} />
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Indicadores definidos" value={all.length} hint="5 de producto + 5 de proceso" />
        <Kpi label="Con medición" value={measured.length} tone="success" hint="en el periodo seleccionado" />
        <Kpi label="Sin medición" value={unmeasured} tone="warning" hint="requieren instrumentación" />
        <Kpi label="Fuentes conectadas" value={0} tone="muted" hint="ninguna fuente automática activa" />
      </div>

      <div className="mt-6 space-y-6">
        <Panel
          title={
            undefined
          }
          className="overflow-hidden"
        >
          <div className="mb-4 flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Indicadores del producto software</h2>
          </div>
          <IndicatorTable indicators={PRODUCT_INDICATORS} period={period} />
        </Panel>

        <Panel>
          <div className="mb-4 flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Indicadores del proceso de Ingeniería de Software</h2>
          </div>
          <IndicatorTable indicators={PROCESS_INDICATORS} period={period} />
        </Panel>

        <Panel title="Gráficos de tendencia">
          {hasHistory ? (
            <Empty>Hay mediciones con fecha: aquí se mostrarían las tendencias.</Empty>
          ) : (
            <Empty>
              No hay mediciones históricas con fechas. Los gráficos de tendencia se activarán automáticamente
              cuando existan mediciones reales en el periodo seleccionado.
            </Empty>
          )}
        </Panel>

        <Panel title="Resumen asistido por IA">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="text-sm">
              <p className="font-medium">Integración de IA pendiente</p>
              <p className="mt-1 text-muted-foreground">
                Este proyecto aún no tiene una integración de IA configurada, por lo que no se genera un resumen
                automático. Cuando se configure, el resumen explicará cambios y posibles alertas usando
                exclusivamente las mediciones disponibles en esta página — nunca datos inventados.
              </p>
              <p className="mt-2 text-muted-foreground">
                Estado actual de los datos: ninguno de los diez indicadores tiene medición disponible; todos
                requieren instrumentación antes de poder analizarse.
              </p>
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}

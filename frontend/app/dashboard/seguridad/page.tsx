"use client";
import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { useMsal } from "@azure/msal-react";
import { fetchExcelXLSX, SHAREPOINT_FILES } from "@/lib/graphClient";
import { normalizarDepartamento } from "@/lib/normalizacion";
import { 
  Shield, 
  Map, 
  MapPin, 
  Building2, 
  Search, 
  X, 
  RotateCcw, 
  Calendar, 
  Home, 
  Bomb, 
  DollarSign, 
  Lock, 
  FileText,
  Zap
} from "lucide-react";
import Loading from "@/components/Loading";
import { formatNum, formatAbbr, formatCurrency } from "@/lib/formatters";
import ExportButton from "@/components/ExportButton";
import MultiSelect from "@/components/MultiSelect";
import DataTable from "@/components/DataTable";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface RegistroSeguridad {
  anio: string;
  mes: string;
  departamento: string;
  municipio: string;
  descripcion: string;
  cantidad: number;
}

type TabKey = "voladuras" | "extorsion" | "secuestros";

const TABS: { key: TabKey; label: string; icon: any; color: string }[] = [
  { key: "voladuras", label: "Voladuras de Oleoductos", icon: Bomb, color: "#C62828" },
  { key: "extorsion", label: "Extorsión", icon: DollarSign, color: "#E65100" },
  { key: "secuestros", label: "Secuestros", icon: Lock, color: "#1565C0" },
];

// ─── Parseo de fecha ──────────────────────────────────────────────────────────
function parsearFecha(valor: unknown): { anio: string; mes: string } {
  if (!valor) return { anio: "", mes: "" };
  // Número serial de Excel → Date
  const num = Number(valor);
  let fecha: Date | null = null;
  if (!isNaN(num) && num > 30000 && num < 80000) {
    fecha = new Date(Math.round((num - 25569) * 86400 * 1000));
  } else {
    const str = String(valor).trim();
    if (str) fecha = new Date(str);
  }
  if (!fecha || isNaN(fecha.getTime())) return { anio: "", mes: "" };
  const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  return {
    anio: String(fecha.getFullYear()),
    mes: MESES[fecha.getMonth()],
  };
}

// ─── Normalizador robusto ──────────────────────────────────────────────────────
function normalizarFila(r: Record<string, unknown>, tipo: TabKey): RegistroSeguridad {
  const s = (k: string) => String(r[k] ?? "").trim();
  const n = (k: string) => Number(r[k] ?? 0) || 0;

  // Fecha principal: "FECHA HECHO" → extraer año y mes
  const { anio: anioFecha, mes: mesFecha } = parsearFecha(
    r["FECHA HECHO"] ?? r["FECHA_HECHO"] ?? r["Fecha Hecho"] ?? r["Fecha_Hecho"] ?? r["fecha_hecho"] ?? r["FECHA"] ?? r["Fecha"]
  );
  const anio = anioFecha || s("AÑO") || s("ANO") || s("Año") || s("ANIO") || s("anio") || "";
  const mes  = mesFecha  || s("MES") || s("Mes") || s("mes") || "";
  const dpto = normalizarDepartamento(s("DEPARTAMENTO") || s("Departamento") || s("departamento") || s("DPTO") || "");
  const municipio = s("MUNICIPIO") || s("Municipio") || s("municipio") || "";

  let descripcion = "";
  let cantidad = 0;

  if (tipo === "voladuras") {
    descripcion = s("OLEODUCTO") || s("Oleoducto") || s("SISTEMA") || s("Sistema") || s("DESCRIPCION") || s("Descripción") || "";
    cantidad = n("VOLADURAS") || n("Voladuras") || n("EVENTOS") || n("Eventos") || n("CANTIDAD") || n("Cantidad") || n("TOTAL") || 1;
  } else if (tipo === "extorsion") {
    descripcion = s("MODALIDAD") || s("Modalidad") || s("TIPO") || s("Tipo") || s("DESCRIPCION") || "";
    cantidad = n("CASOS") || n("Casos") || n("CANTIDAD") || n("Cantidad") || n("EXTORSIONES") || n("Extorsiones") || n("TOTAL") || 1;
  } else {
    descripcion = s("MODALIDAD") || s("Modalidad") || s("TIPO") || s("Tipo") || s("DESCRIPCION") || "";
    cantidad = n("CASOS") || n("Casos") || n("CANTIDAD") || n("Cantidad") || n("SECUESTROS") || n("Secuestros") || n("TOTAL") || 1;
  }

  return { anio, mes, departamento: dpto, municipio, descripcion, cantidad };
}

// ─── Carga desde SharePoint ────────────────────────────────────────────────────
async function cargarDatos(
  tipo: TabKey,
  instance: ReturnType<typeof useMsal>["instance"],
  accounts: ReturnType<typeof useMsal>["accounts"]
): Promise<RegistroSeguridad[]> {
  const account = accounts[0];
  if (!account) throw new Error("No hay sesión activa");
  const cfg =
    tipo === "voladuras" ? SHAREPOINT_FILES.voladurasOleoductos :
    tipo === "extorsion" ? SHAREPOINT_FILES.extorsion :
    SHAREPOINT_FILES.secuestros;
  const rows = await fetchExcelXLSX(cfg.site, cfg.path, cfg.table!, instance, account);
  return (rows as Record<string, unknown>[])
    .map(r => normalizarFila(r, tipo))
    .filter(r => r.anio || r.departamento);
}

// ─── Fetchers Adicionales ──────────────────────────────────────────────────────
function excelDateToISO(serial: unknown): string {
  if (serial === null || serial === undefined || String(serial).trim() === "") return "";
  if (serial instanceof Date) {
    if (isNaN(serial.getTime())) return "";
    const y = serial.getUTCFullYear();
    const m = String(serial.getUTCMonth() + 1).padStart(2, "0");
    const d = String(serial.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof serial === "string") {
    const s = serial.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
    if (s.includes("/")) {
      const pts = s.split("/");
      if (pts.length === 3) {
        const [d, m, a] = pts;
        const year = a.length === 2 ? `20${a}` : a;
        if (year.length === 4) return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      }
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().substring(0, 10);
    return "";
  }
  const num = Number(serial);
  if (!isNaN(num) && num > 30000 && num < 80000) {
    const date = new Date(Math.round((num - 25569) * 86400 * 1000));
    return isNaN(date.getTime()) ? "" : date.toISOString().substring(0, 10);
  }
  return "";
}

function calcularPromedioMensual(registros: any[], campoValor: string): number {
  if (registros.length === 0) return 0;
  const porMes: Record<string, number> = {};
  for (const r of registros) {
    const key = r.Fecha?.substring(0, 7);
    if (!key || key.length < 7) continue;
    porMes[key] = (porMes[key] ?? 0) + r[campoValor];
  }
  const valores = Object.values(porMes);
  if (valores.length === 0) return 0;
  return valores.reduce((s, v) => s + v, 0) / valores.length;
}

async function cargarPetroleo(instance: any, accounts: any[]) {
  const account = accounts[0];
  if (!account) return [];
  const rows = await fetchExcelXLSX(
    SHAREPOINT_FILES.petroleoConsolidado.site,
    SHAREPOINT_FILES.petroleoConsolidado.path,
    SHAREPOINT_FILES.petroleoConsolidado.table,
    instance, account
  );
  return rows.map((r: any) => ({
    Fecha: excelDateToISO(r["Fecha"]),
    Produccion: Number(r["Producción"] ?? r["Produccion"] ?? 0),
  }));
}

async function cargarGas(instance: any, accounts: any[]) {
  const account = accounts[0];
  if (!account) return [];
  const rows = await fetchExcelXLSX(
    SHAREPOINT_FILES.gasConsolidado.site,
    SHAREPOINT_FILES.gasConsolidado.path,
    SHAREPOINT_FILES.gasConsolidado.table,
    instance, account
  );
  return rows.map((r: any) => ({
    Fecha: excelDateToISO(r["Fecha"]),
    Produccion: Number(r["Producción"] ?? r["Produccion"] ?? 0),
  }));
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({ label, value, delta, color, icon: Icon, sub }: {
  label: string; value: string; delta?: string; color: string; icon: any; sub?: string;
}) {
  return (
    <div className="kpi-card" style={{ borderTop: `3px solid ${color}` }}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ color }}>{value}</div>
      {delta && <div className="kpi-delta">{delta}</div>}
      {sub && <div className="kpi-delta" style={{ opacity: 0.7, fontSize: '0.75rem' }}>{sub}</div>}
      <span className="kpi-icon"><Icon size={24} strokeWidth={2.5} /></span>
    </div>
  );
}

// ─── Panel de un indicador ────────────────────────────────────────────────────
function PanelIndicador({ tipo, tab }: { tipo: TabKey; tab: typeof TABS[0] }) {
  const { instance, accounts } = useMsal();

  // ── Estado filtros ──
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [filtroAnio, setFiltroAnio] = useState<string[]>([]);
  const [filtroDpto, setFiltroDpto] = useState<string[]>([]);

  const filtrosActivos = [filtroAnio, filtroDpto].filter(v => v.length > 0).length;

  // ── Estilos panel lateral ──
  const overlay: React.CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000,
    opacity: filtrosAbiertos ? 1 : 0,
    pointerEvents: filtrosAbiertos ? "auto" : "none",
    transition: "opacity 0.25s ease",
  };
  const panelStyle: React.CSSProperties = {
    position: "fixed", top: 0, right: 0, bottom: 0, width: 300,
    background: "#fff", borderLeft: "1px solid #e2e8f0",
    zIndex: 1001, overflowY: "auto", padding: "24px 20px",
    transform: filtrosAbiertos ? "translateX(0)" : "translateX(100%)",
    transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
    boxShadow: filtrosAbiertos ? "-8px 0 40px rgba(0,0,0,0.20)" : "none",
    color: "#1e293b",
  };
  const tabStyle: React.CSSProperties = {
    position: "fixed", right: filtrosAbiertos ? 300 : 0, top: "50%",
    transform: "translateY(-50%)", zIndex: 1002,
    background: tab.color, color: "#fff", fontWeight: 700, fontSize: 12,
    border: "none", cursor: "pointer", padding: "10px 6px",
    borderRadius: "6px 0 0 6px", writingMode: "vertical-rl",
    textOrientation: "mixed", letterSpacing: "0.05em", textTransform: "uppercase",
    transition: "right 0.3s cubic-bezier(0.4,0,0.2,1)",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minHeight: 80,
  };

  const { data: registros = [], isLoading, error } = useQuery({
    queryKey: [`seguridad-${tipo}-v2`],
    queryFn: () => cargarDatos(tipo, instance, accounts),
    enabled: accounts.length > 0,
    staleTime: 10 * 60 * 1000,
    retry: 2,
  });

  const anios = useMemo(() =>
    Array.from(new Set(registros.map(r => r.anio).filter(Boolean))).sort().reverse(),
    [registros]);
  const dptos = useMemo(() =>
    Array.from(new Set(registros.map(r => r.departamento).filter(Boolean))).sort(),
    [registros]);

  const filtrados = useMemo(() => registros.filter(r => {
    if (filtroAnio.length > 0 && !filtroAnio.includes(r.anio)) return false;
    if (filtroDpto.length > 0 && !filtroDpto.includes(r.departamento)) return false;
    return true;
  }), [registros, filtroAnio, filtroDpto]);

  const totalCasos = useMemo(() => filtrados.reduce((s, r) => s + r.cantidad, 0), [filtrados]);
  const dptosMas   = useMemo(() => new Set(filtrados.map(r => r.departamento).filter(Boolean)).size, [filtrados]);

  const porAnio = useMemo(() => {
    const acc: Record<string, number> = {};
    filtrados.forEach(r => { if (r.anio) acc[r.anio] = (acc[r.anio] ?? 0) + r.cantidad; });
    return Object.entries(acc).sort(([a], [b]) => a.localeCompare(b));
  }, [filtrados]);

  const porDpto = useMemo(() => {
    const acc: Record<string, number> = {};
    filtrados.forEach(r => { if (r.departamento) acc[r.departamento] = (acc[r.departamento] ?? 0) + r.cantidad; });
    return Object.entries(acc).sort(([, a], [, b]) => b - a).slice(0, 10);
  }, [filtrados]);

  const { data: petroleo } = useQuery({
    queryKey: ["produccion-petroleo-basico-seguridad"],
    queryFn: () => cargarPetroleo(instance, accounts),
    enabled: accounts.length > 0,
    staleTime: 10 * 60 * 1000,
  });

  const { data: gas } = useQuery({
    queryKey: ["produccion-gas-basico-seguridad"],
    queryFn: () => cargarGas(instance, accounts),
    enabled: accounts.length > 0,
    staleTime: 10 * 60 * 1000,
  });

  const chartSeriesCruce = useMemo(() => {
    if (!petroleo || !gas || filtrados.length === 0) return null;

    const pPorAnio: Record<string, any[]> = {};
    petroleo.forEach((r: any) => {
      const y = r.Fecha?.substring(0, 4);
      if (!y || y.length < 4) return;
      if (!pPorAnio[y]) pPorAnio[y] = [];
      pPorAnio[y].push(r);
    });
    
    const gPorAnio: Record<string, any[]> = {};
    gas.forEach((r: any) => {
      const y = r.Fecha?.substring(0, 4);
      if (!y || y.length < 4) return;
      if (!gPorAnio[y]) gPorAnio[y] = [];
      gPorAnio[y].push(r);
    });

    const eventosPorAnio: Record<string, number> = {};
    filtrados.forEach(r => { 
      if (r.anio) eventosPorAnio[r.anio] = (eventosPorAnio[r.anio] ?? 0) + r.cantidad; 
    });

    const allYears = new Set<string>();
    Object.keys(pPorAnio).forEach(y => allYears.add(y));
    Object.keys(gPorAnio).forEach(y => allYears.add(y));
    Object.keys(eventosPorAnio).forEach(y => allYears.add(y));

    const yearsSorted = Array.from(allYears).sort((a, b) => a.localeCompare(b)).filter(y => y !== 'null');

    const dataPetroleo = yearsSorted.map(y => pPorAnio[y] ? calcularPromedioMensual(pPorAnio[y], 'Produccion') : 0);
    const dataGas = yearsSorted.map(y => gPorAnio[y] ? calcularPromedioMensual(gPorAnio[y], 'Produccion') : 0);
    const dataEventos = yearsSorted.map(y => eventosPorAnio[y] || 0);

    return {
      categories: yearsSorted,
      petroleo: dataPetroleo,
      gas: dataGas,
      eventos: dataEventos
    };
  }, [petroleo, gas, filtrados]);

  const varYoY = useMemo(() => {
    if (porAnio.length < 2) return null;
    const [, prev] = porAnio[porAnio.length - 2];
    const [, curr] = porAnio[porAnio.length - 1];
    if (!prev) return null;
    return ((curr - prev) / prev * 100).toFixed(1);
  }, [porAnio]);

  const chartBase = {
    chart: { background: "transparent", toolbar: { show: false }, fontFamily: "var(--font-main)" },
    theme: { mode: "light" as const },
    grid: { borderColor: "var(--color-border)" },
  };

  if (isLoading) return <Loading message={`Sincronizando datos de ${tab.label.toLowerCase()}...`} />;

  if (error) return (
    <div style={{ padding: "48px 0", textAlign: "center" }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
      <div style={{ color: "var(--color-danger)", fontWeight: 800, marginBottom: 8 }}>Error al cargar {tab.label}</div>
      <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 16 }}>{String(error)}</div>
    </div>
  );

  if (registros.length === 0) return (
    <div style={{ padding: "48px 0", textAlign: "center", color: "var(--color-text-muted)" }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>📂</div>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Archivo no disponible</div>
      <div style={{ fontSize: 13 }}>Verifique la configuración de SharePoint para {tab.label.toLowerCase()}.</div>
    </div>
  );

  return (
    <>
      {/* ── Panel de Filtros (Drawer) ── */}
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, opacity: filtrosAbiertos ? 1 : 0, pointerEvents: filtrosAbiertos ? "auto" : "none", transition: "opacity 0.25s" }} onClick={() => setFiltrosAbiertos(false)} />
      
      <button 
        style={{ position: "fixed", right: filtrosAbiertos ? 320 : 0, top: "50%", transform: "translateY(-50%)", zIndex: 1002, background: tab.color, color: "#fff", border: "none", cursor: "pointer", padding: "12px 6px", borderRadius: "8px 0 0 8px", writingMode: "vertical-rl", transition: "right 0.3s", fontWeight: 700, display: "flex", gap: "8px", alignItems: "center", minHeight: 120 }} 
        onClick={() => setFiltrosAbiertos(!filtrosAbiertos)}
      >
        {filtrosActivos > 0 && <span style={{ background: "#fff", color: tab.color, borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, writingMode: "horizontal-tb", marginBottom: 4, fontWeight: 900 }}>{filtrosActivos}</span>}
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {filtrosAbiertos ? <X size={18} /> : <Search size={18} />}
          {filtrosAbiertos ? " CERRAR" : " FILTRAR"}
        </span>
      </button>

      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 320, background: "#fff", zIndex: 1001, padding: "24px", transform: filtrosAbiertos ? "translateX(0)" : "translateX(100%)", transition: "transform 0.3s", boxShadow: "-8px 0 30px rgba(0,0,0,0.15)", overflowY: "auto" }}>
        <h3 style={{ marginBottom: 24, fontSize: '1.2rem', fontWeight: 900, color: 'var(--color-secondary)' }}>Filtros</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[
            { label: "Año", value: filtroAnio, icon: <Calendar size={14} />, onChange: setFiltroAnio, options: anios },
            { label: "Departamento", value: filtroDpto, icon: <MapPin size={14} />, onChange: setFiltroDpto, options: dptos },
          ].map(f => (
            <div key={f.label}>
              <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {f.icon} {f.label}
              </label>
              <MultiSelect options={f.options} selected={f.value} onChange={f.onChange} />
            </div>
          ))}
          <button 
            onClick={() => { setFiltroAnio([]); setFiltroDpto([]); }} 
            style={{ padding: 12, background: "var(--color-bg-elevated)", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, marginTop: 12, fontSize: 13, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <RotateCcw size={14} /> Limpiar Filtros
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        <KPICard label={tipo === "voladuras" ? "Total Voladuras" : tipo === "extorsion" ? "Casos Extorsión" : "Secuestros"} value={totalCasos.toLocaleString("es-CO")} color="primary" icon={tab.icon} delta={varYoY !== null ? `${Number(varYoY) > 0 ? "▲" : "▼"} ${Math.abs(Number(varYoY))}% YoY` : undefined} />
        <KPICard label="Departamentos" value={String(dptosMas)} color="secondary" icon={Map} sub="Afectados en periodo" />
        <KPICard label="Registros" value={filtrados.length.toLocaleString("es-CO")} color="info" icon={FileText} />
        {porAnio.length > 0 && <KPICard label={`Reporte ${porAnio[porAnio.length - 1]?.[0]}`} value={porAnio[porAnio.length - 1]?.[1].toLocaleString("es-CO") ?? "0"} color="success" icon={Calendar} />}
      </div>

      <div className="charts-grid">
        <div className="panel" id={`panel-seguridad-hist-${tipo}`} style={{ gridColumn: '1 / -1' }}>
          <div className="panel-header">
            <span className="panel-title">Evolución de Eventos vs Producción</span>
            <ExportButton targetId={`panel-seguridad-hist-${tipo}`} fileName={`Evolucion_Historica_${tipo}`} />
          </div>
          <div className="panel-body">
            {typeof window !== "undefined" && chartSeriesCruce ? (
              <Chart
                type="line"
                height={450}
                series={[
                  { name: tab.label, type: "column", data: chartSeriesCruce.eventos },
                  { name: "Producción Petróleo (BPDC)", type: "line", data: chartSeriesCruce.petroleo.map(v => Math.round(v)) },
                  { name: "Producción Gas (MPCD)", type: "line", data: chartSeriesCruce.gas.map(v => Math.round(v)) },
                ]}
                options={{
                  ...chartBase,
                  chart: { ...chartBase.chart, stacked: true },
                  stroke: { width: [0, 4, 4], curve: 'smooth' },
                  xaxis: { categories: chartSeriesCruce.categories },
                  colors: [tab.color, "#D44D03", "#003745"],
                  dataLabels: { enabled: false },
                  yaxis: [
                    {
                      title: { text: "Casos", style: { color: tab.color, fontWeight: 700 } },
                      labels: { style: { colors: tab.color }, formatter: (v: number) => formatNum(v) },
                    },
                    {
                      opposite: true,
                      title: { text: "BPDC / MPCD", style: { color: "#D44D03", fontWeight: 700 } },
                      labels: { style: { colors: "#D44D03" }, formatter: (v: number) => formatAbbr(v) },
                    },
                    { show: false, opposite: true, seriesName: "Producción Petróleo (BPDC)" }
                  ],
                  tooltip: {
                    shared: true,
                    intersect: false,
                    y: {
                      formatter: function (y, { seriesIndex }) {
                        if (typeof y !== "undefined") {
                          if (seriesIndex === 0) return formatNum(y) + " casos";
                          if (seriesIndex === 1) return formatAbbr(y) + " BPDC";
                          if (seriesIndex === 2) return formatAbbr(y) + " MPCD";
                        }
                        return y;
                      }
                    }
                  },
                  legend: { position: 'top', horizontalAlign: 'center', itemMargin: { horizontal: 15, vertical: 5 } }
                }}
              />
            ) : (
              <div style={{height:450, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--color-text-muted)'}}>Cargando cruce de datos y producción...</div>
            )}
          </div>
        </div>
        <div className="panel" id={`panel-seguridad-top-${tipo}`}>
          <div className="panel-header">
            <span className="panel-title">Top 10 Departamentos</span>
            <ExportButton targetId={`panel-seguridad-top-${tipo}`} fileName={`Top_Dptos_${tipo}`} />
          </div>
          <div className="panel-body">
            {typeof window !== "undefined" && porDpto.length > 0 && (
              <Chart type="bar" height={380}
                series={[{ name: "Casos", data: porDpto.map(([, v]) => v) }]}
                options={{
                  ...chartBase,
                  plotOptions: { 
                    bar: { horizontal: true, borderRadius: 4, barHeight: "95%", dataLabels: { position: 'center' } } 
                  },
                  xaxis: { categories: porDpto.map(([d]) => d), labels: { style: { colors: "var(--color-text-muted)" } } },
                  colors: [tab.color],
                  dataLabels: { 
                    enabled: true, 
                    formatter: (v: number) => formatNum(v),
                    style: { fontSize: "11px", fontWeight: 700 } 
                  }
                }}
              />
            )}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Detalle: Seguridad</span>
          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Mostrando {Math.min(filtrados.length, 100)} de {filtrados.length}</span>
        </div>
        <DataTable
          data={filtrados}
          columns={[
            { key: "anio", label: "Año", width: "70px", render: (v) => <span style={{ fontWeight: 700, color: "var(--color-primary)" }}>{v}</span> },
            { key: "mes", label: "Mes", render: (v) => <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>{v}</span> },
            { key: "departamento", label: "Departamento", render: (v) => <span style={{ fontWeight: 600 }}>{v}</span> },
            { key: "municipio", label: "Municipio" },
            { key: "descripcion", label: "Descripción", render: (v) => <span style={{ fontSize: 12 }}>{v || "—"}</span> },
            { key: "cantidad", label: "Cantidad", align: "right", render: (v) => <span style={{ fontWeight: 800, color: tab.color }}>{Number(v).toLocaleString("es-CO")}</span> },
          ]}
          pageSize={100}
        />
      </div>
    </>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────
export default function SeguridadPage() {
  const [tabActivo, setTabActivo] = useState<TabKey>("voladuras");
  const tab = TABS.find(t => t.key === tabActivo)!;

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 style={{ color: "var(--color-primary)", fontWeight: 900, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Shield size={32} strokeWidth={2.5} />
          Seguridad – MinDefensa
        </h1>
        <p>Indicadores oficiales de seguridad para el sector energía y minas en Colombia.</p>
      </div>

      {/* ── Tabs Estilo Premium ACP ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 32, overflowX: "auto", paddingBottom: 8 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTabActivo(t.key)}
            style={{
              flex: "0 0 auto", padding: "12px 24px", border: "none", cursor: "pointer",
              fontSize: 14, fontWeight: tabActivo === t.key ? 800 : 600,
              borderRadius: 12, transition: "all 0.2s",
              background: tabActivo === t.key ? t.color : "var(--color-bg-elevated)",
              color: tabActivo === t.key ? "#fff" : "var(--color-text-muted)",
              boxShadow: tabActivo === t.key ? "0 4px 15px rgba(0,0,0,0.1)" : "none",
              display: "flex", alignItems: "center", gap: 12, minWidth: 200, justifyContent: "center"
            }}
          >
            <t.icon size={20} strokeWidth={tabActivo === t.key ? 3 : 2} />
            {t.label}
          </button>
        ))}
      </div>

      <PanelIndicador key={tabActivo} tipo={tabActivo} tab={tab} />
    </div>
  );
}

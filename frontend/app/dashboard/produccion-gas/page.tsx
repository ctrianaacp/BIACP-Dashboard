"use client";
import { useMsal } from "@azure/msal-react";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useState, useMemo } from "react";
import MapaGasPage from "./MapaGas";
import { fetchExcelXLSX, SHAREPOINT_FILES } from "@/lib/graphClient";
import { normalizarDepartamento, normalizarMunicipio, normalizarOperadora } from "@/lib/normalizacion";
import Loading from "@/components/Loading";
import { formatNum, formatAbbr, formatCurrency } from "@/lib/formatters";
import ExportButton from "@/components/ExportButton";
import DataTable from "@/components/DataTable";
import MultiSelect from "@/components/MultiSelect";
import ReservasChart from "@/components/produccion/ReservasChart";
import { CheckCircle2 } from "lucide-react";
import { 
  Flame, 
  MapPin, 
  Building2, 
  Map, 
  Search, 
  X, 
  RotateCcw, 
  Calendar, 
  CalendarDays,
  Home 
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface RegistroGas {
  Campo: string;
  Contrato: string;
  Operadora: string;
  Departamento: string;
  Municipio: string;
  Produccion: number;
  Fecha: string;
  MunicipioDepartamento: string;
  AfiliadaACP: string;
}

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

// ─── Helper: convierte fecha de Excel → ISO string (YYYY-MM-DD) ───────────────
// xlsx con cellDates:true → devuelve objetos Date de JS
// xlsx con raw:true       → devuelve número serial de Excel
function excelDateToISO(serial: unknown): string {
  if (serial === null || serial === undefined || serial === "") return "";

  // Caso 1: objeto Date de JavaScript (cuando cellDates:true en xlsx)
  if (serial instanceof Date) {
    if (isNaN(serial.getTime())) return "";
    const y = serial.getUTCFullYear();
    const m = String(serial.getUTCMonth() + 1).padStart(2, "0");
    const d = String(serial.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // Caso 2: string con fecha legible
  if (typeof serial === "string") {
    if (serial.trim() === "") return "";
    if (serial.includes("-") && serial.length >= 7) return serial.substring(0, 10);
    const parsed = new Date(serial);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().substring(0, 10);
    return serial;
  }

  // Caso 3: número serial de Excel (cuando raw:true)
  const num = Number(serial);
  if (isNaN(num) || num < 1 || num > 100000) return "";
  try {
    const date = new Date(Math.round((num - 25569) * 86400 * 1000));
    if (isNaN(date.getTime())) return "";
    return date.toISOString().substring(0, 10);
  } catch {
    return "";
  }
}

// Eliminamos formatters locales en favor de lib/formatters

// ─── Cálculo MPGD Promedio = AVERAGEX(SUMMARIZE por Año+Mes, SUM(Producción)) ─
// La columna Producción ya está en MPCD/día por campo → sumamos por mes, promediamos meses
function calcularMPGDPromedio(registros: RegistroGas[]): number {
  if (registros.length === 0) return 0;
  const porMes: Record<string, number> = {};
  for (const r of registros) {
    const key = r.Fecha.substring(0, 7);
    if (!key || key.length < 7) continue;
    porMes[key] = (porMes[key] ?? 0) + r.Produccion;
  }
  const valores = Object.values(porMes);
  if (valores.length === 0) return 0;
  return valores.reduce((s, v) => s + v, 0) / valores.length;
}

// ─── Carga de datos vía API PostgreSQL ───────────────────────────────────────────
async function cargarGas(): Promise<RegistroGas[]> {
  const res = await fetch("/api/produccion?tipo=gas");
  if (!res.ok) throw new Error("Error cargando datos de gas");
  const data = await res.json();
  
  return data.map((r: any) => ({
    ...r,
    Departamento: normalizarDepartamento(r.Departamento || ""),
    Municipio: normalizarMunicipio(r.Municipio || ""),
    Operadora: normalizarOperadora(r.Operadora || ""),
    MunicipioDepartamento: `${normalizarMunicipio(r.Municipio || "")} / ${normalizarDepartamento(r.Departamento || "")}`,
    Produccion: Number(r.Produccion) || 0
  }));
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({ label, value, unit, color, icon: Icon }: {
  label: string; value: string; unit?: string; color: string; icon: any;
}) {
  return (
    <div className={`kpi-card ${color}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">
        {value}
        {unit && <span className="kpi-unit">{unit}</span>}
      </div>
      <span className="kpi-icon"><Icon size={24} strokeWidth={2.5} /></span>
    </div>
  );
}

const MESES = [
  "Todos","Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ProduccionGasPage() {
  const { instance, accounts } = useMsal();
  const [activeTab, setActiveTab] = useState<'indicadores' | 'mapa'>('indicadores');

  // Filtros en cascada
  const [filtroAnio, setFiltroAnio] = useState<string[]>([]);
  const [filtroMes, setFiltroMes] = useState<string[]>([]);
  const [filtroDpto, setFiltroDpto] = useState<string[]>([]);
  const [filtroMunicipio, setFiltroMunicipio] = useState<string[]>([]);
  const [filtroOperadora, setFiltroOperadora] = useState<string[]>([]);
  const [filtroCampo, setFiltroCampo] = useState<string[]>([]);
  const [filtroAfiliada, setFiltroAfiliada] = useState<string[]>([]);

  // Panel lateral
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

  // Contador de filtros activos
  const filtrosActivos = [
    filtroAnio, filtroMes, filtroDpto, filtroMunicipio, filtroOperadora, filtroCampo, filtroAfiliada
  ].filter(v => v.length > 0).length;

  const limpiarFiltros = () => {
    setFiltroAnio([]); setFiltroMes([]);
    setFiltroDpto([]); setFiltroMunicipio([]);
    setFiltroOperadora([]); setFiltroCampo([]);
    setFiltroAfiliada([]);
  };

  const { data: registros = [], isLoading, error } = useQuery({
    queryKey: ["produccion-gas-pg"],
    queryFn: cargarGas,
    staleTime: 10 * 60 * 1000,
    retry: 0,
  });

  // ── Opciones de filtros en cascada ────────────────────────────────────────
  const anios = useMemo(() => {
    const set = new Set(registros.map((r) => r.Fecha.substring(0, 4)).filter(Boolean));
    return Array.from(set).sort().reverse();
  }, [registros]);

  const mesesDisponibles = useMemo(() => {
    const base = filtroAnio.length === 0 ? registros : registros.filter((r) => filtroAnio.some(a => r.Fecha.startsWith(a)));
    const nums = new Set(base.map((r) => parseInt(r.Fecha.substring(5, 7))).filter((n) => !isNaN(n)));
    return Array.from(nums).sort((a, b) => a - b).map((n) => MESES[n]);
  }, [registros, filtroAnio]);

  const baseAnioMes = useMemo(() => registros.filter((r) => {
    if (filtroAnio.length > 0 && !filtroAnio.some(a => r.Fecha.startsWith(a))) return false;
    if (filtroMes.length > 0) {
      const numsMes = filtroMes.map(m => MESES.indexOf(m));
      if (!numsMes.includes(parseInt(r.Fecha.substring(5, 7)))) return false;
    }
    return true;
  }), [registros, filtroAnio, filtroMes]);

  const departamentos = useMemo(
    () => Array.from(new Set(baseAnioMes.map((r) => r.Departamento))).sort(), [baseAnioMes]
  );

  const municipios = useMemo(() => {
    const base = filtroDpto.length === 0 ? baseAnioMes : baseAnioMes.filter((r) => filtroDpto.includes(r.Departamento));
    return Array.from(new Set(base.map((r) => r.Municipio))).sort();
  }, [baseAnioMes, filtroDpto]);

  const operadoras = useMemo(() => {
    let base = baseAnioMes;
    if (filtroDpto.length > 0) base = base.filter((r) => filtroDpto.includes(r.Departamento));
    if (filtroMunicipio.length > 0) base = base.filter((r) => filtroMunicipio.includes(r.Municipio));
    return Array.from(new Set(base.map((r) => r.Operadora))).sort();
  }, [baseAnioMes, filtroDpto, filtroMunicipio]);

  const campos = useMemo(() => {
    let base = baseAnioMes;
    if (filtroDpto.length > 0) base = base.filter((r) => filtroDpto.includes(r.Departamento));
    if (filtroMunicipio.length > 0) base = base.filter((r) => filtroMunicipio.includes(r.Municipio));
    if (filtroOperadora.length > 0) base = base.filter((r) => filtroOperadora.includes(r.Operadora));
    return Array.from(new Set(base.map((r) => r.Campo))).sort();
  }, [baseAnioMes, filtroDpto, filtroMunicipio, filtroOperadora]);

  // ── Datos filtrados ────────────────────────────────────────────────────────
  const filtrados = useMemo(() => {
    return registros.filter((r) => {
      if (filtroAnio.length > 0 && !filtroAnio.some(a => r.Fecha.startsWith(a))) return false;
      if (filtroMes.length > 0) {
        const numsMes = filtroMes.map(m => MESES.indexOf(m));
        if (!numsMes.includes(parseInt(r.Fecha.substring(5, 7)))) return false;
      }
      if (filtroDpto.length > 0 && !filtroDpto.includes(r.Departamento)) return false;
      if (filtroMunicipio.length > 0 && !filtroMunicipio.includes(r.Municipio)) return false;
      if (filtroOperadora.length > 0 && !filtroOperadora.includes(r.Operadora)) return false;
      if (filtroCampo.length > 0 && !filtroCampo.includes(r.Campo)) return false;
      if (filtroAfiliada.length > 0 && !filtroAfiliada.includes(r.AfiliadaACP)) return false;
      return true;
    });
  }, [registros, filtroAnio, filtroMes, filtroDpto, filtroMunicipio, filtroOperadora, filtroCampo, filtroAfiliada]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const mpgdPromedio = calcularMPGDPromedio(filtrados);
    const camposSet = new Set(filtrados.map((r) => r.Campo)).size;
    const ops = new Set(filtrados.map((r) => r.Operadora)).size;
    const municipiosSet = new Set(filtrados.map((r) => r.Municipio)).size;
    const porFecha: Record<string, number> = {};
    filtrados.forEach((r) => {
      const key = r.Fecha.substring(0, 7);
      porFecha[key] = (porFecha[key] ?? 0) + r.Produccion;
    });
    return { mpgdPromedio, camposSet, ops, municipiosSet, porFecha };
  }, [filtrados]);

  // ── Series mensuales ──────────────────────────────────────────────────────
  const seriesMensuales = useMemo(() => {
    const sorted = Object.entries(kpis.porFecha).sort(([a], [b]) => a.localeCompare(b));
    return {
      categorias: sorted.map(([k]) => k),
      valores: sorted.map(([, v]) => parseFloat(v.toFixed(2))),
    };
  }, [kpis.porFecha]);

  const topOperadoras = useMemo(() => {
    const acc: Record<string, typeof filtrados> = {};
    filtrados.forEach((r) => {
      if (!acc[r.Operadora]) acc[r.Operadora] = [];
      acc[r.Operadora].push(r);
    });
    return Object.entries(acc)
      .map(([op, regs]) => [op, calcularMPGDPromedio(regs)] as [string, number])
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);
  }, [filtrados]);

  const topDptos = useMemo(() => {
    const acc: Record<string, typeof filtrados> = {};
    filtrados.forEach((r) => {
      if (!acc[r.Departamento]) acc[r.Departamento] = [];
      acc[r.Departamento].push(r);
    });
    return Object.entries(acc)
      .map(([dpto, regs]) => [dpto, calcularMPGDPromedio(regs)] as [string, number])
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8);
  }, [filtrados]);

  const porAnio = useMemo(() => {
    const acc: Record<string, typeof filtrados> = {};
    filtrados.forEach((r) => {
      const y = r.Fecha.substring(0, 4);
      if (y) {
        if (!acc[y]) acc[y] = [];
        acc[y].push(r);
      }
    });
    return Object.entries(acc)
      .map(([y, regs]) => [y, calcularMPGDPromedio(regs)] as [string, number])
      .sort(([a], [b]) => a.localeCompare(b));
  }, [filtrados]);

  const chartBase = {
    chart: { background: "transparent", toolbar: { show: false }, fontFamily: "var(--font-main)" },
    theme: { mode: "light" as const },
    grid: { borderColor: "var(--color-border)" },
  };

  // ── Estilos del panel lateral ─────────────────────────────────────────────
  const panelStyles: Record<string, React.CSSProperties> = {
    overlay: {
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
      zIndex: 1000, opacity: filtrosAbiertos ? 1 : 0,
      pointerEvents: filtrosAbiertos ? "auto" : "none",
      transition: "opacity 0.25s ease",
    },
    panel: {
      position: "fixed", top: 0, right: 0, bottom: 0, width: 300,
      background: "#ffffff",
      borderLeft: "1px solid #e2e8f0",
      zIndex: 1001, overflowY: "auto", padding: "24px 20px",
      transform: filtrosAbiertos ? "translateX(0)" : "translateX(100%)",
      transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
      boxShadow: filtrosAbiertos ? "-8px 0 40px rgba(0,0,0,0.25)" : "none",
      color: "#1e293b",
    },
    tab: {
      position: "fixed", right: filtrosAbiertos ? 300 : 0, top: "50%",
      transform: "translateY(-50%)",
      zIndex: 1002,
      background: "var(--color-secondary, #3D4F5C)",
      color: "#ffffff", fontWeight: 700, fontSize: 12,
      border: "none", cursor: "pointer",
      padding: "10px 6px", borderRadius: "6px 0 0 6px",
      writingMode: "vertical-rl", textOrientation: "mixed",
      letterSpacing: "0.05em", textTransform: "uppercase",
      transition: "right 0.3s cubic-bezier(0.4,0,0.2,1)",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
      minHeight: 80,
    } as React.CSSProperties,
  };

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return <Loading message="Cargando producción de gas natural..." />;
  }

  if (error) {
    return (
      <div className="page-content">
        <div className="page-header"><h1>⛽ Producción Gas</h1></div>
        <div className="panel">
          <div className="panel-body" style={{ textAlign: "center", padding: 48 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <div style={{ color: "var(--color-danger)", fontWeight: 700, marginBottom: 8 }}>Error al cargar datos</div>
            <div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>{String(error)}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ padding: '24px 24px 0', display: 'flex', gap: 8, borderBottom: '1px solid var(--color-border)', background: '#fff' }}>
        <button 
          onClick={() => setActiveTab('indicadores')}
          style={{ padding: '12px 24px', fontWeight: 800, color: activeTab === 'indicadores' ? 'var(--color-secondary)' : 'var(--color-text-muted)', borderBottom: activeTab === 'indicadores' ? '3px solid var(--color-secondary)' : '3px solid transparent', background: 'transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer', fontSize: 14 }}
        >
          Indicadores y Tablas
        </button>
        <button 
          onClick={() => setActiveTab('mapa')}
          style={{ padding: '12px 24px', fontWeight: 800, color: activeTab === 'mapa' ? 'var(--color-secondary)' : 'var(--color-text-muted)', borderBottom: activeTab === 'mapa' ? '3px solid var(--color-secondary)' : '3px solid transparent', background: 'transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer', fontSize: 14 }}
        >
          Mapa Georreferenciado
        </button>
      </div>

      {activeTab === 'indicadores' ? (
        <div className="page-content">
      {/* ── Panel de Filtros (Drawer) ── */}
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, opacity: filtrosAbiertos ? 1 : 0, pointerEvents: filtrosAbiertos ? "auto" : "none", transition: "opacity 0.25s" }} onClick={() => setFiltrosAbiertos(false)} />
      
      <button 
        style={{ position: "fixed", right: filtrosAbiertos ? 320 : 0, top: "50%", transform: "translateY(-50%)", zIndex: 1002, background: "var(--color-secondary)", color: "#fff", border: "none", cursor: "pointer", padding: "12px 6px", borderRadius: "8px 0 0 8px", writingMode: "vertical-rl", transition: "right 0.3s", fontWeight: 700, display: "flex", gap: "8px", alignItems: "center", minHeight: 120 }} 
        onClick={() => setFiltrosAbiertos(!filtrosAbiertos)}
      >
        {filtrosActivos > 0 && <span style={{ background: "#fff", color: "var(--color-secondary)", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, writingMode: "horizontal-tb", marginBottom: 4, fontWeight: 900 }}>{filtrosActivos}</span>}
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {filtrosAbiertos ? <X size={18} /> : <Search size={18} />}
          {filtrosAbiertos ? " CERRAR" : " FILTRAR"}
        </span>
      </button>

      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 320, background: "#fff", zIndex: 1001, padding: "24px", transform: filtrosAbiertos ? "translateX(0)" : "translateX(100%)", transition: "transform 0.3s", boxShadow: "-8px 0 30px rgba(0,0,0,0.15)", overflowY: "auto" }}>
        <h3 style={{ marginBottom: 24, fontSize: '1.2rem', fontWeight: 900, color: 'var(--color-secondary)' }}>Filtros</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[
            { label: "Año", value: filtroAnio, icon: <Calendar size={14} />, onChange: (v:string[])=> {setFiltroAnio(v); setFiltroMes([]); setFiltroDpto([]); setFiltroMunicipio([]); setFiltroOperadora([]); setFiltroCampo([]);}, options: anios },
            { label: "Mes", value: filtroMes, icon: <CalendarDays size={14} />, onChange: (v:string[])=> {setFiltroMes(v); setFiltroDpto([]); setFiltroMunicipio([]); setFiltroOperadora([]); setFiltroCampo([]);}, options: mesesDisponibles },
            { label: "Departamento", value: filtroDpto, icon: <Map size={14} />, onChange: (v:string[])=>{setFiltroDpto(v); setFiltroMunicipio([]); setFiltroOperadora([]); setFiltroCampo([]);}, options: departamentos },
            { label: "Municipio", value: filtroMunicipio, icon: <Home size={14} />, onChange: (v:string[])=>{setFiltroMunicipio(v); setFiltroOperadora([]); setFiltroCampo([]);}, options: municipios },
            { label: "Operadora", value: filtroOperadora, icon: <Building2 size={14} />, onChange: (v:string[])=>{setFiltroOperadora(v); setFiltroCampo([]);}, options: operadoras },
            { label: "Campo", value: filtroCampo, icon: <MapPin size={14} />, onChange: setFiltroCampo, options: campos },
          ].map(f => (
            <div key={f.label}>
              <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {f.icon} {f.label}
              </label>
              <MultiSelect options={f.options} selected={f.value} onChange={f.onChange} />
            </div>
          ))}
          <div key="Afiliada">
            <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <CheckCircle2 size={14} /> Afiliada ACP
            </label>
            <MultiSelect options={["Sí", "No"]} selected={filtroAfiliada} onChange={setFiltroAfiliada} />
          </div>
          <button 
            onClick={limpiarFiltros}
            style={{ padding: 12, background: "var(--color-bg-elevated)", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, marginTop: 12, fontSize: 13, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <RotateCcw size={14} /> Limpiar Filtros
          </button>
        </div>
      </div>

      <div className="page-header">
        <h1 style={{ color: 'var(--color-secondary)', fontWeight: 900 }}>Producción Gas Natural</h1>
        <p>
          {filtrados.length.toLocaleString("es-CO")} registros · Fuente: PostgreSQL (Producción)
          {filtrosActivos > 0 && <span style={{ marginLeft: 12, background: 'var(--color-secondary)', color: '#fff', padding: '3px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>{filtrosActivos} activos</span>}
        </p>
      </div>

      <div className="kpi-grid">
        <KPICard label="MPGD Promedio" value={formatNum(kpis.mpgdPromedio, 2)} unit="MPCD/día" color="secondary" icon={Flame} />
        <KPICard label="Campos activos" value={formatNum(kpis.camposSet)} color="primary" icon={MapPin} />
        <KPICard label="Operadoras" value={formatNum(kpis.ops)} color="success" icon={Building2} />
        <KPICard label="Municipios" value={formatNum(kpis.municipiosSet)} color="info" icon={Map} />
      </div>

      {filtroAnio.length === 0 && porAnio.length > 1 && (
        <div className="panel" id="panel-gas-anual" style={{ marginBottom: 24 }}>
          <div className="panel-header">
            <span className="panel-title">Producción Anual Histórica (MPCD)</span>
            <ExportButton targetId="panel-gas-anual" fileName="Produccion_Anual_Gas" />
          </div>
          <div className="panel-body">
            {typeof window !== "undefined" && (
              <Chart key={porAnio.map(([y]) => y).join(",")} type="bar" height={380}
                series={[{ name: "Producción MPCD", data: porAnio.map(([, v]) => parseFloat(v.toFixed(2))) }]}
                options={{
                  ...chartBase,
                  xaxis: { categories: porAnio.map(([y]) => y), labels: { style: { colors: "var(--color-text-muted)", fontSize: "11px" } } },
                  yaxis: { labels: { style: { colors: "var(--color-text-muted)" }, formatter: (v: number) => formatAbbr(v) } },
                  colors: ["#003745"],
                  plotOptions: { bar: { borderRadius: 4, columnWidth: "75%" } },
                  dataLabels: { enabled: false },
                }}
              />
            )}
          </div>
        </div>
      )}

      <div className="charts-grid">
        <div className="panel" id="panel-gas-evolucion">
          <div className="panel-header">
            <span className="panel-title">Evolución Mensual (MPCD)</span>
            <ExportButton targetId="panel-gas-evolucion" fileName="Evolucion_Mensual_Gas" />
          </div>
          <div className="panel-body">
            {typeof window !== "undefined" && seriesMensuales.categorias.length > 0 && (
              <Chart key={seriesMensuales.categorias.join(",")} type="area" height={380}
                series={[{ name: "Producción MPCD", data: seriesMensuales.valores }]}
                options={{
                  ...chartBase,
                  xaxis: { 
                    categories: seriesMensuales.categorias, 
                    tickAmount: 12,
                    labels: { style: { colors: "var(--color-text-muted)", fontSize: "9px" }, rotate: -45 } 
                  },
                  yaxis: { labels: { style: { colors: "var(--color-text-muted)" }, formatter: (v: number) => formatAbbr(v) } },
                  fill: { type: "gradient", gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.02 } },
                  stroke: { curve: "smooth", width: 2 },
                  colors: ["#003745"],
                  dataLabels: { enabled: false },
                }}
              />
            )}
          </div>
        </div>
        <div className="panel" id="panel-gas-top10">
          <div className="panel-header">
            <span className="panel-title">Top 10 Operadoras</span>
            <ExportButton targetId="panel-gas-top10" fileName="Top_10_Operadoras_Gas" />
          </div>
          <div className="panel-body">
            {typeof window !== "undefined" && topOperadoras.length > 0 && (
              <Chart key={topOperadoras.map(([op]) => op).join(",")} type="bar" height={380}
                series={[{ name: "MPCD", data: topOperadoras.map(([, v]) => parseFloat(v.toFixed(2))) }]}
                options={{
                  ...chartBase,
                  plotOptions: { 
                    bar: { 
                      horizontal: true, 
                      borderRadius: 4, 
                      barHeight: "95%",
                      dataLabels: { position: 'center' }
                    } 
                  },
                  xaxis: { categories: topOperadoras.map(([op]) => op), labels: { style: { colors: "var(--color-text-muted)" }, formatter: (v: string) => formatAbbr(Number(v)) } },
                  colors: ["#D44D03"],
                  dataLabels: { 
                    enabled: true, 
                    formatter: (v: number) => formatNum(v, 2),
                    style: { fontSize: "11px", fontWeight: 700 }
                  },
                }}
              />
            )}
          </div>
        </div>
      </div>

      <ReservasChart producto="Gas" />

      <div className="panel" id="panel-gas-dpto" style={{ marginBottom: 24 }}>
        <div className="panel-header">
          <span className="panel-title">Producción por Departamento</span>
          <ExportButton targetId="panel-gas-dpto" fileName="Produccion_Departamento_Gas" />
        </div>
        <div className="panel-body">
          {typeof window !== "undefined" && topDptos.length > 0 && (
            <Chart type="treemap" height={380}
              series={[{ data: topDptos.map(([n,v]) => ({ x: n, y: parseFloat(v.toFixed(2)) })) }]}
              options={{
                ...chartBase,
                colors: ["#003745", "#D44D03", "#008054", "#0277BD", "#C68400", "#C62828", "#0097A7", "#558B2F"],
                plotOptions: { treemap: { distributed: true, enableShades: false } },
                dataLabels: {
                  enabled: true,
                  formatter: (text: string, op: any) => [text, formatNum(op.value, 2)]
                }
              }}
            />
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Detalle: Producción Gas</span>
          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{filtrados.length} registros</span>
        </div>
        <DataTable
          data={filtrados}
          columns={[
            { key: "Fecha", label: "Fecha", width: "110px", render: (v) => <span style={{ fontFamily: "monospace", fontSize: 12 }}>{v}</span> },
            { key: "Departamento", label: "Departamento" },
            { key: "Municipio", label: "Municipio" },
            { key: "Operadora", label: "Operadora", render: (v, row: any) => <span style={{ fontWeight: 600 }}>{v} {row.AfiliadaACP === 'Sí' && <span title="Afiliada ACP" style={{ color: '#008054', marginLeft: 4 }}>✓</span>}</span> },
            { key: "Campo", label: "Campo" },
            { key: "Produccion", label: "MPCD", align: "right", render: (v) => <span style={{ fontWeight: 700, color: "var(--color-secondary)" }}>{Number(v).toLocaleString("es-CO", { maximumFractionDigits: 2 })}</span> },
          ]}
          pageSize={100}
        />
      </div>
    </div>
    ) : (
      <MapaGasPage />
    )}
    </>
  );
}

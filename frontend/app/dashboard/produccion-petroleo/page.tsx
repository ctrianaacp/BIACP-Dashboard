"use client";
import { useMsal } from "@azure/msal-react";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useState, useMemo } from "react";
import { fetchExcelXLSX, SHAREPOINT_FILES } from "@/lib/graphClient";
import { 
  Droplets, 
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
import { 
  normalizarOperadora, 
  normalizarDepartamento, 
  normalizarMunicipio 
} from "@/lib/normalizacion";
import Loading from "@/components/Loading";
import { formatNum, formatAbbr, formatCurrency } from "@/lib/formatters";
import MultiSelect from "@/components/MultiSelect";
import ExportButton from "@/components/ExportButton";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface RegistroPetroleo {
  Departamento: string;
  Municipio: string;
  Operadora: string;
  Campo: string;
  Contrato: string;
  Mes: string;
  Produccion: number;
  Fecha: string;
  MunicipioDepartamento: string;
}

// Importar ApexCharts solo en cliente (no SSR)
const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

// ─── Helper: convierte fecha de Excel → ISO string (YYYY-MM-DD) ──────────────
// xlsx con cellDates:true → devuelve objetos Date de JS
// xlsx con raw:true → devuelve número serial de Excel
// También maneja strings con formato de fecha
function excelDateToISO(serial: unknown): string {
  if (serial === null || serial === undefined || serial === "") return "";

  // Caso 1: objeto Date de JavaScript (cuando cellDates:true en xlsx)
  if (serial instanceof Date) {
    if (isNaN(serial.getTime())) return "";
    // Usar UTC para evitar desfase de zona horaria (Colombia = UTC-5)
    const y = serial.getUTCFullYear();
    const m = String(serial.getUTCMonth() + 1).padStart(2, "0");
    const d = String(serial.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // Caso 2: string con fecha legible
  if (typeof serial === "string") {
    if (serial.trim() === "") return "";
    // Formato YYYY-MM-DD o similar con guion
    if (serial.includes("-") && serial.length >= 7) return serial.substring(0, 10);
    // Intentar parsear como fecha
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

// Eliminamos formatters locales

// ─── Helper: días en el mes de una fecha ISO (YYYY-MM-DD) ────────────────────
function diasEnMes(fechaISO: string): number {
  if (!fechaISO || fechaISO.length < 7) return 30;
  const [y, m] = fechaISO.split("-").map(Number);
  return new Date(y, m, 0).getDate(); // getDate() del día 0 del mes siguiente = último día del mes actual
}

// ─── Cálculo BPDC = AVERAGEX(SUMMARIZE por Año+Mes, SUM(Producción)) ────────────
// NOTA: La columna Producción en el Excel YA está en unidades Bbl/día (BPDC)
// por campo y por mes. La fórmula DAX equivalente en JS:
// 1. Por cada (Año, Mes): suma todos los BPDC de cada campo  → totalBPDC_mes
// 2. Promedia esos totalBPDC_mes a través de todos los meses  → BPDC Promedio
function calcularBPDC(registros: RegistroPetroleo[]): number {
  if (registros.length === 0) return 0;
  const porMes: Record<string, number> = {};
  for (const r of registros) {
    const key = r.Fecha.substring(0, 7); // "YYYY-MM"
    if (!key || key.length < 7) continue;
    // Produccion ya es BPDC (tasa diaria) — solo sumar por mes
    porMes[key] = (porMes[key] ?? 0) + r.Produccion;
  }
  const valores = Object.values(porMes);
  if (valores.length === 0) return 0;
  return valores.reduce((s, v) => s + v, 0) / valores.length;
}

// ─── Loader de datos vía Graph API ───────────────────────────────────────────
async function cargarPetroleo(
  instance: ReturnType<typeof useMsal>["instance"],
  accounts: ReturnType<typeof useMsal>["accounts"]
): Promise<RegistroPetroleo[]> {
  const account = accounts[0];
  if (!account) throw new Error("No hay sesión activa");

  const rows = await fetchExcelXLSX(
    SHAREPOINT_FILES.petroleoConsolidado.site,
    SHAREPOINT_FILES.petroleoConsolidado.path,
    SHAREPOINT_FILES.petroleoConsolidado.table,
    instance,
    account
  );

  return rows.map((r: Record<string, unknown>) => ({
    Departamento: normalizarDepartamento(r["Departamento"] as string),
    Municipio: normalizarMunicipio(r["Municipio"] as string),
    Operadora: normalizarOperadora(r["Operadora"] as string),
    Campo: String(r["Campo"] ?? ""),
    Contrato: String(r["Contrato"] ?? ""),
    Mes: String(r["Mes"] ?? ""),
    Produccion: Number(r["Producción"] ?? r["Produccion"] ?? 0),
    Fecha: excelDateToISO(r["Fecha"]),
    MunicipioDepartamento: `${normalizarMunicipio(r["Municipio"] as string)} / ${normalizarDepartamento(r["Departamento"] as string)}`,
  }));
}

// ─── Componente KPI ───────────────────────────────────────────────────────────
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

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ProduccionPetroleoPage() {
  const { instance, accounts } = useMsal();

  // Filtros — uno por cada columna de la tabla
  const [filtroAnios, setFiltroAnios] = useState<string[]>([]);
  const [filtroMeses, setFiltroMeses] = useState<string[]>([]);
  const [filtroDptos, setFiltroDptos] = useState<string[]>([]);
  const [filtroMunicipios, setFiltroMunicipios] = useState<string[]>([]);
  const [filtroOperadoras, setFiltroOperadoras] = useState<string[]>([]);
  const [filtroCampos, setFiltroCampos] = useState<string[]>([]);
  // Panel de filtros
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

  // Contador de filtros activos
  const filtrosActivos = [
    filtroAnios.length > 0,
    filtroMeses.length > 0,
    filtroDptos.length > 0,
    filtroMunicipios.length > 0,
    filtroOperadoras.length > 0,
    filtroCampos.length > 0,
  ].filter(Boolean).length;

  const limpiarFiltros = () => {
    setFiltroAnios([]); setFiltroMeses([]);
    setFiltroDptos([]); setFiltroMunicipios([]);
    setFiltroOperadoras([]); setFiltroCampos([]);
  };

  // Carga de datos
  const { data: registros = [], isLoading, error } = useQuery({
    queryKey: ["produccion-petroleo"],
    queryFn: () => cargarPetroleo(instance, accounts),
    enabled: accounts.length > 0,
    staleTime: 10 * 60 * 1000,
    retry: 0,
  });

  // ── Opciones de filtros en cascada: cada select muestra solo los valores
  //    presentes dado lo ya seleccionado en los filtros anteriores.
  const MESES = [
    "Todos","Enero","Febrero","Marzo","Abril","Mayo","Junio",
    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
  ];

  // Años — sobre todos los registros
  const anios = useMemo(() => {
    const set = new Set(registros.map((r) => r.Fecha.substring(0, 4)).filter(Boolean));
    return ["Todos", ...Array.from(set).sort().reverse()];
  }, [registros]);

  // Meses — filtrado por año
  const mesesDisponibles = useMemo(() => {
    const base = filtroAnios.length === 0 ? registros : registros.filter((r) => filtroAnios.some(a => r.Fecha.startsWith(a)));
    const nums = new Set(base.map((r) => parseInt(r.Fecha.substring(5, 7))).filter((n) => !isNaN(n)));
    return ["Todos", ...Array.from(nums).sort((a, b) => a - b).map((n) => MESES[n])];
  }, [registros, filtroAnios]);

  // Base parcial: año + mes aplicados (para los selects de abajo)
  const baseAnioMes = useMemo(() => registros.filter((r) => {
    if (filtroAnios.length > 0 && !filtroAnios.some(a => r.Fecha.startsWith(a))) return false;
    if (filtroMeses.length > 0) {
      const numsMeses = filtroMeses.map(m => MESES.indexOf(m));
      if (!numsMeses.includes(parseInt(r.Fecha.substring(5, 7)))) return false;
    }
    return true;
  }), [registros, filtroAnios, filtroMeses]);

  // Departamentos — filtrado por año+mes
  const departamentos = useMemo(
    () => ["Todos", ...Array.from(new Set(baseAnioMes.map((r) => r.Departamento))).sort()],
    [baseAnioMes]
  );

  // Municipios — filtrado por año+mes+dpto
  const municipios = useMemo(() => {
    const base = filtroDptos.length === 0 ? baseAnioMes : baseAnioMes.filter((r) => filtroDptos.includes(r.Departamento));
    return ["Todos", ...Array.from(new Set(base.map((r) => r.Municipio))).sort()];
  }, [baseAnioMes, filtroDptos]);

  // Operadoras — filtrado por año+mes+dpto+municipio
  const operadoras = useMemo(() => {
    let base = baseAnioMes;
    if (filtroDptos.length > 0) base = base.filter((r) => filtroDptos.includes(r.Departamento));
    if (filtroMunicipios.length > 0) base = base.filter((r) => filtroMunicipios.includes(r.Municipio));
    return ["Todas", ...Array.from(new Set(base.map((r) => r.Operadora))).sort()];
  }, [baseAnioMes, filtroDptos, filtroMunicipios]);

  // Campos — filtrado por año+mes+dpto+municipio+operadora
  const campos = useMemo(() => {
    let base = baseAnioMes;
    if (filtroDptos.length > 0) base = base.filter((r) => filtroDptos.includes(r.Departamento));
    if (filtroMunicipios.length > 0) base = base.filter((r) => filtroMunicipios.includes(r.Municipio));
    if (filtroOperadoras.length > 0) base = base.filter((r) => filtroOperadoras.includes(r.Operadora));
    return ["Todos", ...Array.from(new Set(base.map((r) => r.Campo))).sort()];
  }, [baseAnioMes, filtroDptos, filtroMunicipios, filtroOperadoras]);

  // Datos filtrados — aplica todos los filtros activos
  const filtrados = useMemo(() => {
    return registros.filter((r) => {
      if (filtroAnios.length > 0 && !filtroAnios.some(a => r.Fecha.startsWith(a))) return false;
      if (filtroMeses.length > 0) {
        const numsMeses = filtroMeses.map(m => MESES.indexOf(m));
        if (!numsMeses.includes(parseInt(r.Fecha.substring(5, 7)))) return false;
      }
      if (filtroDptos.length > 0 && !filtroDptos.includes(r.Departamento)) return false;
      if (filtroMunicipios.length > 0 && !filtroMunicipios.includes(r.Municipio)) return false;
      if (filtroOperadoras.length > 0 && !filtroOperadoras.includes(r.Operadora)) return false;
      if (filtroCampos.length > 0 && !filtroCampos.includes(r.Campo)) return false;
      return true;
    });
  }, [registros, filtroAnios, filtroMeses, filtroDptos, filtroMunicipios, filtroOperadoras, filtroCampos]);

  // KPIs agregados
  const kpis = useMemo(() => {
    // BPDC = AVERAGEX(SUMMARIZE(tabla, Año, Mes, SUM(Producción)), [ProduccionMensual])
    // Agrupa por Año+Mes, suma cada grupo, luego promedia
    const bpdc = calcularBPDC(filtrados);

    const campos = new Set(filtrados.map((r) => r.Campo)).size;
    const operadorasSet = new Set(filtrados.map((r) => r.Operadora)).size;
    const municipios = new Set(filtrados.map((r) => r.Municipio)).size;

    // Producción mensual total (para el gráfico de series temporales)
    const porFecha: Record<string, number> = {};
    filtrados.forEach((r) => {
      const key = r.Fecha.substring(0, 7);
      porFecha[key] = (porFecha[key] ?? 0) + r.Produccion;
    });

    return { bpdc, camposSet: campos, operadorasSet, municipiosSet: municipios, porFecha };
  }, [filtrados]);

  // Series para gráfico producción por mes
  const seriesMensuales = useMemo(() => {
    const sorted = Object.entries(kpis.porFecha).sort(([a], [b]) => a.localeCompare(b));
    return {
      categorias: sorted.map(([k]) => k),
      valores: sorted.map(([, v]) => Math.round(v)),
    };
  }, [kpis.porFecha]);

  // Top 10 operadoras por producción
  const topOperadoras = useMemo(() => {
    const acc: Record<string, number> = {};
    filtrados.forEach((r) => { acc[r.Operadora] = (acc[r.Operadora] ?? 0) + r.Produccion; });
    return Object.entries(acc)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([op, val]) => ({ op, val: Math.round(val) }));
  }, [filtrados]);

  // Top departamentos
  const topDptos = useMemo(() => {
    const acc: Record<string, number> = {};
    filtrados.forEach((r) => { acc[r.Departamento] = (acc[r.Departamento] ?? 0) + r.Produccion; });
    return Object.entries(acc).sort(([, a], [, b]) => b - a).slice(0, 8);
  }, [filtrados]);

  // ─── Opciones de gráficos ──────────────────────────────────────────────────
  const chartOpts = {
    baseTheme: {
      chart: { background: "transparent", toolbar: { show: false }, fontFamily: "var(--font-main)" },
      theme: { mode: "light" as const },
      colors: ["#003745", "#D44D03", "#008054"], // HEX explícito para exportación de imagen HTML2Canvas
      grid: { borderColor: "#DDE3E8" },
      tooltip: {
        theme: "light",
        y: { formatter: (v: number) => `${formatNum(v)} Bbl/día` },
      },
      dataLabels: {
        enabled: true,
        formatter: (v: number) => formatAbbr(v),
        style: { fontSize: '10px' }
      }
    },
  };

  // ─── Estilos del panel lateral ─────────────────────────────────────────────
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
      transform: "translateY(-50%) rotate(0deg)",
      zIndex: 1002,
      background: "var(--color-primary, #f59e0b)",
      color: "#0f172a", fontWeight: 700, fontSize: 12,
      border: "none", cursor: "pointer",
      padding: "10px 6px", borderRadius: filtrosAbiertos ? "6px 0 0 6px" : "6px 0 0 6px",
      writingMode: "vertical-rl", textOrientation: "mixed",
      letterSpacing: "0.05em", textTransform: "uppercase",
      transition: "right 0.3s cubic-bezier(0.4,0,0.2,1)",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
      minHeight: 80,
    } as React.CSSProperties,
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return <Loading message="Cargando producción de petróleo..." />;
  }

  if (error) {
    return (
      <div className="page-content">
      <div className="page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Droplets size={32} strokeWidth={2.5} style={{ color: "var(--color-primary)" }} />
          Producción Petróleo
        </h1>
      </div>
        <div className="panel">
          <div className="panel-body" style={{ textAlign: "center", padding: 48 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <div style={{ color: "var(--color-danger)", fontWeight: 700, marginBottom: 8 }}>
              Error al cargar datos
            </div>
            <div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
              {String(error)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      {/* ── Panel de Filtros (Drawer) ── */}
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, opacity: filtrosAbiertos ? 1 : 0, pointerEvents: filtrosAbiertos ? "auto" : "none", transition: "opacity 0.25s" }} onClick={() => setFiltrosAbiertos(false)} />
      
      <button 
        style={{ position: "fixed", right: filtrosAbiertos ? 320 : 0, top: "50%", transform: "translateY(-50%)", zIndex: 1002, background: "var(--color-primary)", color: "#fff", border: "none", cursor: "pointer", padding: "12px 6px", borderRadius: "8px 0 0 8px", writingMode: "vertical-rl", transition: "right 0.3s", fontWeight: 700, display: "flex", gap: "8px", alignItems: "center", minHeight: 120 }} 
        onClick={() => setFiltrosAbiertos(!filtrosAbiertos)}
      >
        {filtrosActivos > 0 && <span style={{ background: "#fff", color: "var(--color-primary)", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, writingMode: "horizontal-tb", marginBottom: 4, fontWeight: 900 }}>{filtrosActivos}</span>}
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {filtrosAbiertos ? <X size={18} /> : <Search size={18} />}
          {filtrosAbiertos ? " CERRAR" : " FILTRAR"}
        </span>
      </button>

      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 320, background: "#fff", zIndex: 1001, padding: "24px", transform: filtrosAbiertos ? "translateX(0)" : "translateX(100%)", transition: "transform 0.3s", boxShadow: "-8px 0 30px rgba(0,0,0,0.15)", overflowY: "auto" }}>
        <h3 style={{ marginBottom: 24, fontSize: '1.2rem', fontWeight: 900, color: 'var(--color-secondary)' }}>Filtros</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div key="Año">
            <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <Calendar size={14} /> Año
            </label>
            <MultiSelect 
              options={anios} 
              selected={filtroAnios} 
              onChange={(selected) => {
                setFiltroAnios(selected);
                setFiltroMeses([]); setFiltroDptos([]); setFiltroMunicipios([]); setFiltroOperadoras([]); setFiltroCampos([]);
              }} 
            />
          </div>
          <div key="Mes">
            <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <CalendarDays size={14} /> Mes
            </label>
            <MultiSelect 
              options={mesesDisponibles} 
              selected={filtroMeses} 
              onChange={(selected) => {
                setFiltroMeses(selected);
                setFiltroDptos([]); setFiltroMunicipios([]); setFiltroOperadoras([]); setFiltroCampos([]);
              }} 
            />
          </div>
          <div key="Departamento">
            <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <Map size={14} /> Departamento
            </label>
            <MultiSelect options={departamentos} selected={filtroDptos} onChange={(s) => { setFiltroDptos(s); setFiltroMunicipios([]); setFiltroOperadoras([]); setFiltroCampos([]); }} />
          </div>
          <div key="Municipio">
            <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <Home size={14} /> Municipio
            </label>
            <MultiSelect options={municipios} selected={filtroMunicipios} onChange={(s) => { setFiltroMunicipios(s); setFiltroOperadoras([]); setFiltroCampos([]); }} />
          </div>
          <div key="Operadora">
            <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <Building2 size={14} /> Operadora
            </label>
            <MultiSelect options={operadoras} selected={filtroOperadoras} onChange={(s) => { setFiltroOperadoras(s); setFiltroCampos([]); }} />
          </div>
          <div key="Campo">
            <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <MapPin size={14} /> Campo
            </label>
            <MultiSelect options={campos} selected={filtroCampos} onChange={setFiltroCampos} />
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
        <h1 style={{ color: 'var(--color-primary)', fontWeight: 900 }}>Producción Petróleo</h1>
        <p>
          {filtrados.length.toLocaleString("es-CO")} registros · Fuente: Fiscalización SharePoint
          {filtrosActivos > 0 && <span style={{ marginLeft: 12, background: 'var(--color-primary)', color: '#fff', padding: '3px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>{filtrosActivos} activos</span>}
        </p>
      </div>

      <div className="kpi-grid">
        <KPICard label="BPDC Promedio" value={formatAbbr(Math.round(kpis.bpdc))} unit="Bbl/día" color="primary" icon={Droplets} />
        <KPICard label="Campos activos" value={formatNum(kpis.camposSet)} color="secondary" icon={MapPin} />
        <KPICard label="Operadoras" value={formatNum(kpis.operadorasSet)} color="success" icon={Building2} />
        <KPICard label="Municipios" value={formatNum(kpis.municipiosSet)} color="info" icon={Map} />
      </div>

      <div className="charts-grid">
        <div className="panel" id="panel-evolucion">
          <div className="panel-header">
            <span className="panel-title">Evolución de Producción (BPDC)</span>
            <ExportButton targetId="panel-evolucion" fileName="Evolucion_Produccion_BPDC" />
          </div>
          <div className="panel-body">
            {typeof window !== "undefined" && seriesMensuales.categorias.length > 0 && (
              <Chart key={seriesMensuales.categorias.join(",")} type="area" height={380}
                series={[{ name: "Producción BPDC", data: seriesMensuales.valores }]}
                options={{
                  ...chartOpts.baseTheme,
                  xaxis: { 
                    categories: seriesMensuales.categorias, 
                    tickAmount: 12,
                    labels: { 
                      style: { colors: "var(--color-text-muted)", fontSize: "9px" }, 
                      rotate: -45,
                      hideOverlappingLabels: true
                    } 
                  },
                  yaxis: { labels: { style: { colors: "var(--color-text-muted)" }, formatter: (v: number) => formatAbbr(v) } },
                  fill: { type: "gradient", gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.02 } },
                  stroke: { curve: "smooth", width: 2 },
                  colors: ["#D44D03"], // Usar HEX directo para exportación SVG/PNG
                  dataLabels: { enabled: false },
                  responsive: [{
                    breakpoint: 640,
                    options: {
                      xaxis: { labels: { show: false } }, // Ocultar etiquetas si es muy pequeño
                      chart: { height: 230 }
                    }
                  }]
                }}
              />
            )}
          </div>
        </div>
        <div className="panel" id="panel-top10">
          <div className="panel-header">
            <span className="panel-title">Top 10 Operadoras</span>
            <ExportButton targetId="panel-top10" fileName="Top_10_Operadoras" />
          </div>
          <div className="panel-body">
            {typeof window !== "undefined" && topOperadoras.length > 0 && (
              <Chart type="bar" height={380}
                series={[{ name: "BPDC", data: topOperadoras.map((o) => o.val) }]}
                options={{
                  ...chartOpts.baseTheme,
                  plotOptions: { 
                    bar: { 
                      horizontal: true, 
                      borderRadius: 4, 
                      barHeight: "95%",
                      dataLabels: { position: 'center' }
                    } 
                  },
                  xaxis: { 
                    categories: topOperadoras.map((o) => o.op), 
                    labels: { 
                      style: { colors: "var(--color-text-muted)", fontSize: "9px" }, 
                      formatter: (v: string) => formatAbbr(Number(v)) 
                    } 
                  },
                  colors: ["#003745"], // HEX explícito para exportación
                  dataLabels: { 
                    enabled: true, 
                    style: { fontSize: "11px", fontWeight: 700 },
                    formatter: (val: number) => formatNum(val)
                  },
                  responsive: [{
                    breakpoint: 640,
                    options: {
                      plotOptions: { bar: { barHeight: "80%" } },
                      dataLabels: { enabled: false }
                    }
                  }]
                }}
              />
            )}
          </div>
        </div>
      </div>

      <div className="panel" id="panel-dpto" style={{ marginBottom: 24 }}>
        <div className="panel-header">
          <span className="panel-title">Producción por Departamento</span>
          <ExportButton targetId="panel-dpto" fileName="Produccion_Departamento" />
        </div>
        <div className="panel-body">
          {typeof window !== "undefined" && topDptos.length > 0 && (
            <Chart type="treemap" height={380}
              series={[{ data: topDptos.map(([n,v]) => ({ x: n, y: Math.round(v) })) }]}
              options={{
                ...chartOpts.baseTheme,
                colors: ["#D44D03", "#003745", "#008054", "#0277BD", "#C68400", "#C62828", "#0097A7", "#558B2F"],
                plotOptions: { treemap: { distributed: true, enableShades: false } },
                dataLabels: {
                  enabled: true,
                  formatter: (text: string, op: any) => [text, formatNum(op.value)]
                }
              }}
            />
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Detalle de Producción</span>
          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{filtrados.length} registros</span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Departamento</th>
                <th>Municipio</th>
                <th>Operadora</th>
                <th>Campo</th>
                <th style={{ textAlign: "right" }}>BPDC</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.slice(0, 100).map((r, i) => (
                <tr key={i}>
                  <td data-label="Fecha" className="font-mono" style={{ fontSize: 12 }}>{r.Fecha}</td>
                  <td data-label="Departamento">{r.Departamento}</td>
                  <td data-label="Municipio">{r.Municipio}</td>
                  <td data-label="Operadora" style={{ fontWeight: 600 }}>{r.Operadora}</td>
                  <td data-label="Campo">{r.Campo}</td>
                  <td data-label="BPDC" style={{ textAlign: "right", fontWeight: 700, color: "var(--color-primary)" }}>
                    {r.Produccion.toLocaleString("es-CO")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

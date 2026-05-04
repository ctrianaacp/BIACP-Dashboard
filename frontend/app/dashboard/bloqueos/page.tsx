"use client";
import { useMsal } from "@azure/msal-react";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useState, useMemo } from "react";
import { fetchExcelXLSX, SHAREPOINT_FILES } from "@/lib/graphClient";
import {
  normalizarDepartamento,
  normalizarMunicipio,
  normalizarOperadora,
  normalizarAlarmaBloqueo
} from "@/lib/normalizacion";
import { 
  AlertCircle, 
  TriangleAlert, 
  Ban, 
  Calendar, 
  Search, 
  X, 
  RotateCcw,
  CalendarDays,
  MapPin, 
  Home, 
  Building2 
} from "lucide-react";
import Loading from "@/components/Loading";
import { formatNum, formatAbbr } from "@/lib/formatters";
import ExportButton from "@/components/ExportButton";
import MultiSelect from "@/components/MultiSelect";
import DataTable from "@/components/DataTable";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface RegistroBloqueo {
  Fecha: string;
  Anio: string;
  Mes: string;
  Departamento: string;
  Municipio: string;
  Operadora: string;
  TipoEvento: string;
  DuracionDias: number;
  Estado: string;
  Causa: string;
}

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

// ─── Helpers de Mapeo Dinámico ────────────────────────────────────────────────
// Busca un valor en el objeto r basado en una lista de posibles nombres de columna
function getVal(r: Record<string, unknown>, keys: string[]): any {
  if (!r) return null;
  const rKeys = Object.keys(r);
  
  // 1. Intento por coincidencia exacta (normalizada)
  for (const k of keys) {
    const target = k.trim().toUpperCase();
    const found = rKeys.find(rk => rk.trim().toUpperCase() === target);
    if (found) return r[found];
  }
  
  // 2. Intento por sub-string si es para fechas (buscar algo que tenga 'FECHA' o 'DATE')
  if (keys.some(k => k.toUpperCase().includes("FECHA"))) {
    const found = rKeys.find(rk => {
      const normalized = rk.trim().toUpperCase();
      return normalized.includes("FECHA") || normalized.includes("DATE");
    });
    if (found) return r[found];
  }

  // 3. Intento por sub-string general para otros campos (Dpto, Mpio, etc)
  const firstKey = keys[0].toUpperCase();
  if (firstKey === "DEPARTAMENTO") {
    const found = rKeys.find(rk => rk.trim().toUpperCase().includes("DPTO") || rk.trim().toUpperCase().includes("DEPARTA"));
    if (found) return r[found];
  }
  
  if (firstKey === "OPERADORA") {
    const found = rKeys.find(rk => {
      const norm = rk.trim().toUpperCase();
      return norm.includes("OPERADOR") || norm.includes("EMPRESA") || norm.includes("COMPAÑ") || norm.includes("COMPAN") || norm.includes("CIA");
    });
    if (found) return r[found];
  }
  
  return null;
}

function excelDateToISO(serial: unknown): string {
  if (serial === null || serial === undefined || String(serial).trim() === "") return "";
  
  // Caso Objeto Date
  if (serial instanceof Date) {
    if (isNaN(serial.getTime())) return "";
    const y = serial.getUTCFullYear();
    const m = String(serial.getUTCMonth() + 1).padStart(2, "0");
    const d = String(serial.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  
  // Caso String
  if (typeof serial === "string") {
    const s = serial.trim();
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
    // DD/MM/YYYY
    if (s.includes("/")) {
      const pts = s.split("/");
      if (pts.length === 3) {
        const [d, m, a] = pts;
        const year = a.length === 2 ? `20${a}` : a;
        if (year.length === 4) return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      }
    }
    // Caso "08-Apr-2024" o similares
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().substring(0, 10);
    return "";
  }
  
  // Caso Número Serial Excel
  const num = Number(serial);
  if (!isNaN(num) && num > 30000 && num < 80000) {
    const date = new Date(Math.round((num - 25569) * 86400 * 1000));
    return isNaN(date.getTime()) ? "" : date.toISOString().substring(0, 10);
  }
  
  return "";
}

const MESES = [
  "Todos", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

// ─── Data Fetchers (Gas y Petroleo) ───────────────────────────────────────────
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

// ─── Loader Bloqueos ──────────────────────────────────────────────────────────
async function cargarBloqueos(
  instance: ReturnType<typeof useMsal>["instance"],
  accounts: ReturnType<typeof useMsal>["accounts"]
): Promise<RegistroBloqueo[]> {
  const account = accounts[0];
  if (!account) throw new Error("No hay sesión activa");

  const [rowsHist, rowsSim] = await Promise.all([
    fetchExcelXLSX(
      SHAREPOINT_FILES.bloqueosHistorico.site,
      SHAREPOINT_FILES.bloqueosHistorico.path,
      SHAREPOINT_FILES.bloqueosHistorico.table,
      instance, account
    ).catch(e => { console.error("Error histórico:", e); return []; }),
    fetchExcelXLSX(
      SHAREPOINT_FILES.bloqueosSIM.site,
      SHAREPOINT_FILES.bloqueosSIM.path,
      SHAREPOINT_FILES.bloqueosSIM.table,
      instance, account
    ).catch(e => { console.error("Error SIM vigente:", e); return []; })
  ]);

  const allRows = [...rowsHist, ...rowsSim];
  if (allRows.length === 0) return [];

  const resultData = allRows.map((r: Record<string, unknown>, idx) => {
    // 🔍 Mapping dinámico mejorado
    if (idx === 0) console.log("[BIACP] Inspeccionando fila Excel Bloqueos:", Object.keys(r));
    const fRaw = getVal(r, ["FECHA HECHO", "Fecha", "FECHA", "fecha_inicio", "FECHA_INICIO"]);
    const fecha = excelDateToISO(fRaw);
    
    const dRaw = getVal(r, ["Departamento", "DEPARTAMENTO", "Dpto", "DPTO"]);
    const mRaw = getVal(r, ["Municipio", "MUNICIPIO", "Mpio", "MUN"]);
    const oRaw = getVal(r, ["Operadora", "OPERADOR", "Empresa", "OPERADORA", "COMPAÑÍA", "COMPAÑIA", "COMPANIA", "CIA", "Cia", "EMPRESA_OPERADORA", "Operador Registro"]);
    const tRaw = getVal(r, ["Alarma / Bloqueo", "Alarma/Bloqueo", "Tipo", "TIPO", "TIPO DE EVENTO", "Tipo_Evento", "TIPO_EVENTO", "EVENTO", "Clase"]);
    const uRaw = getVal(r, ["Duracion", "DURACION", "duracion_dias", "Dias", "Días"]);
    const sRaw = getVal(r, ["Estado", "ESTADO", "ESTADO_ACTUAL", "ESTADO_DEL_BLOQUEO", "ESTADO_SIM", "SITUACION", "Situacion", "Situación", "SituacionActual"]);
    const cRaw = getVal(r, ["Causa", "CAUSA", "Causa Principal", "Resumen", "MOTIVO"]);

    const anio = fecha ? fecha.substring(0, 4) : "";
    const mesNum = fecha ? parseInt(fecha.substring(5, 7)) : 0;

    return {
      Fecha: fecha,
      Anio: anio,
      Mes: mesNum > 0 ? MESES[mesNum] : "",
      Departamento: normalizarDepartamento(dRaw ? String(dRaw) : ""),
      Municipio: normalizarMunicipio(mRaw ? String(mRaw) : ""),
      Operadora: normalizarOperadora(oRaw ? String(oRaw) : ""),
      TipoEvento: normalizarAlarmaBloqueo(tRaw ? String(tRaw) : ""),
      DuracionDias: Number(uRaw) || 0,
      Estado: String(sRaw ?? ""),
      Causa: String(cRaw ?? ""),
    };
  }).filter(r => r.Fecha !== "" && r.Anio.length === 4);

  // De-duplicación
  const seen = new Set<string>();
  return resultData.filter(r => {
    const sig = `${r.Fecha}|${r.Municipio}|${r.Operadora}|${r.TipoEvento}|${r.DuracionDias}`;
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
}

// ─── UI Components ────────────────────────────────────────────────────────────
function KPICard({ label, value, unit, color, icon: Icon }: { label: string; value: string; unit?: string; color: string; icon: any }) {
  return (
    <div className={`kpi-card ${color}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}{unit && <span className="kpi-unit"> {unit}</span>}</div>
      <span className="kpi-icon"><Icon size={24} strokeWidth={2.5} /></span>
    </div>
  );
}

export default function BloqueosPage() {
  const { instance, accounts } = useMsal();
  const [filtroAnio, setFiltroAnio] = useState<string[]>([]);
  const [filtroMes, setFiltroMes] = useState<string[]>([]);
  const [filtroDpto, setFiltroDpto] = useState<string[]>([]);
  const [filtroMunicipio, setFiltroMunicipio] = useState<string[]>([]);
  const [filtroOperadora, setFiltroOperadora] = useState<string[]>([]);
  const [filtroTipo, setFiltroTipo] = useState<string[]>([]);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

  const { data: registros = [], isLoading, error } = useQuery({
    queryKey: ["bloqueos"],
    queryFn: () => cargarBloqueos(instance, accounts),
    enabled: accounts.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const anios = useMemo(() => Array.from(new Set(registros.map(r => r.Anio))).sort().reverse(), [registros]);
  const baseAnio = useMemo(() => filtroAnio.length === 0 ? registros : registros.filter(r => filtroAnio.includes(r.Anio)), [registros, filtroAnio]);
  const mesesDisponibles = useMemo(() => Array.from(new Set(baseAnio.map(r => r.Mes))).filter(Boolean).sort((a,b) => MESES.indexOf(a) - MESES.indexOf(b)), [baseAnio]);
  const baseAnioMes = useMemo(() => filtroMes.length === 0 ? baseAnio : baseAnio.filter(r => filtroMes.includes(r.Mes)), [baseAnio, filtroMes]);
  const departamentos = useMemo(() => Array.from(new Set(baseAnioMes.map(r => r.Departamento))).sort(), [baseAnioMes]);
  const baseUbicacion = useMemo(() => filtroDpto.length === 0 ? baseAnioMes : baseAnioMes.filter(r => filtroDpto.includes(r.Departamento)), [baseAnioMes, filtroDpto]);
  const municipios = useMemo(() => Array.from(new Set(baseUbicacion.map(r => r.Municipio))).sort(), [baseUbicacion]);
  const baseOperacion = useMemo(() => filtroMunicipio.length === 0 ? baseUbicacion : baseUbicacion.filter(r => filtroMunicipio.includes(r.Municipio)), [baseUbicacion, filtroMunicipio]);
  const operadoras = useMemo(() => Array.from(new Set(baseOperacion.map(r => r.Operadora))).sort(), [baseOperacion]);

  const filtrados = useMemo(() => {
    return baseOperacion.filter(r => {
      if (filtroOperadora.length > 0 && !filtroOperadora.includes(r.Operadora)) return false;
      if (filtroTipo.length > 0 && !filtroTipo.includes(r.TipoEvento)) return false;
      return true;
    });
  }, [baseOperacion, filtroOperadora, filtroTipo]);

  const kpis = useMemo(() => ({
    total: filtrados.length,
    alarmas: filtrados.filter(r => r.TipoEvento.includes("Alarma")).length,
    bloqueos: filtrados.filter(r => r.TipoEvento.includes("Bloqueo")).length,
    dias: filtrados.reduce((s, r) => s + r.DuracionDias, 0),
    dptos: new Set(filtrados.map(r => r.Departamento)).size,
  }), [filtrados]);

  const porAnio = useMemo(() => {
    const acc: Record<string, number> = {};
    filtrados.forEach(r => { acc[r.Anio] = (acc[r.Anio] ?? 0) + 1; });
    return Object.entries(acc).sort(([a], [b]) => a.localeCompare(b));
  }, [filtrados]);

  const { data: petroleo } = useQuery({
    queryKey: ["produccion-petroleo-basico-bloq"],
    queryFn: () => cargarPetroleo(instance, accounts),
    enabled: accounts.length > 0,
    staleTime: 10 * 60 * 1000,
  });

  const { data: gas } = useQuery({
    queryKey: ["produccion-gas-basico-bloq"],
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

    const alarmasPorAnio: Record<string, number> = {};
    const bloqueosPorAnio: Record<string, number> = {};
    
    filtrados.forEach((r: any) => {
      const y = r.Anio;
      if (!y) return;
      if (r.TipoEvento.includes("Alarma")) {
        alarmasPorAnio[y] = (alarmasPorAnio[y] ?? 0) + 1;
      } else if (r.TipoEvento.includes("Bloqueo")) {
        bloqueosPorAnio[y] = (bloqueosPorAnio[y] ?? 0) + 1;
      }
    });

    const allYears = new Set<string>();
    Object.keys(pPorAnio).forEach(y => allYears.add(y));
    Object.keys(gPorAnio).forEach(y => allYears.add(y));
    Object.keys(alarmasPorAnio).forEach(y => allYears.add(y));
    Object.keys(bloqueosPorAnio).forEach(y => allYears.add(y));

    const yearsSorted = Array.from(allYears).sort((a, b) => a.localeCompare(b)).filter(y => y !== 'null');

    const dataPetroleo = yearsSorted.map(y => pPorAnio[y] ? calcularPromedioMensual(pPorAnio[y], 'Produccion') : 0);
    const dataGas = yearsSorted.map(y => gPorAnio[y] ? calcularPromedioMensual(gPorAnio[y], 'Produccion') : 0);
    const dataAlarmas = yearsSorted.map(y => alarmasPorAnio[y] || 0);
    const dataBloqueos = yearsSorted.map(y => bloqueosPorAnio[y] || 0);

    return {
      categories: yearsSorted,
      petroleo: dataPetroleo,
      gas: dataGas,
      alarmas: dataAlarmas,
      bloqueos: dataBloqueos
    };
  }, [petroleo, gas, filtrados]);

  const porDpto = useMemo(() => {
    const acc: Record<string, number> = {};
    filtrados.forEach(r => { acc[r.Departamento] = (acc[r.Departamento] ?? 0) + 1; });
    return Object.entries(acc).sort(([, a], [, b]) => b - a).slice(0, 10);
  }, [filtrados]);

  const chartBase = {
    chart: { background: "transparent", toolbar: { show: false }, fontFamily: "var(--font-main)" },
    grid: { borderColor: "var(--color-border)" },
    theme: { mode: "light" as const },
  };

  const filtrosActivos = [filtroAnio, filtroMes, filtroDpto, filtroMunicipio, filtroOperadora, filtroTipo].filter(a => a.length > 0).length;

  if (isLoading) return <Loading message="Analizando historial de alarmas y bloqueos (SIM)..." />;
  if (error) return <div className="page-content" style={{padding:48, textAlign:"center", color:"var(--color-danger)"}}>⚠️ Error: {String(error)}</div>;

  return (
    <div className="page-content">
      {/* ── Panel de Filtros (Drawer) ── */}
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, opacity: filtrosAbiertos ? 1 : 0, pointerEvents: filtrosAbiertos ? "auto" : "none", transition: "opacity 0.25s" }} onClick={() => setFiltrosAbiertos(false)} />
      
      <button 
        style={{ position: "fixed", right: filtrosAbiertos ? 320 : 0, top: "50%", transform: "translateY(-50%)", zIndex: 1002, background: "var(--color-danger)", color: "#fff", border: "none", cursor: "pointer", padding: "12px 6px", borderRadius: "8px 0 0 8px", writingMode: "vertical-rl", transition: "right 0.3s", fontWeight: 700, display: "flex", gap: "8px", alignItems: "center", minHeight: 120 }} 
        onClick={() => setFiltrosAbiertos(!filtrosAbiertos)}
      >
        {filtrosActivos > 0 && <span style={{ background: "#fff", color: "var(--color-danger)", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, writingMode: "horizontal-tb", marginBottom: 4, fontWeight: 900 }}>{filtrosActivos}</span>}
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {filtrosAbiertos ? <X size={18} /> : <Search size={18} />}
          {filtrosAbiertos ? " CERRAR" : " FILTRAR"}
        </span>
      </button>

      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 320, background: "#fff", zIndex: 1001, padding: "24px", transform: filtrosAbiertos ? "translateX(0)" : "translateX(100%)", transition: "transform 0.3s", boxShadow: "-8px 0 30px rgba(0,0,0,0.15)", overflowY: "auto" }}>
        <h3 style={{ marginBottom: 24, fontSize: '1.2rem', fontWeight: 900, color: 'var(--color-secondary)' }}>Filtros</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[
            { label: "Año", value: filtroAnio, icon: <Calendar size={14} />, onChange: (v: string[]) => { setFiltroAnio(v); setFiltroMes([]); }, options: anios },
            { label: "Mes", value: filtroMes, icon: <CalendarDays size={14} />, onChange: setFiltroMes, options: mesesDisponibles },
            { label: "Departamento", value: filtroDpto, icon: <MapPin size={14} />, onChange: (v: string[]) => { setFiltroDpto(v); setFiltroMunicipio([]); }, options: departamentos },
            { label: "Municipio", value: filtroMunicipio, icon: <Home size={14} />, onChange: setFiltroMunicipio, options: municipios },
            { label: "Operadora", value: filtroOperadora, icon: <Building2 size={14} />, onChange: setFiltroOperadora, options: operadoras },
          ].map(f => (
            <div key={f.label}>
              <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {f.icon} {f.label}
              </label>
              <MultiSelect options={f.options} selected={f.value} onChange={f.onChange} />
            </div>
          ))}
          <button 
            onClick={() => { setFiltroAnio([]); setFiltroMes([]); setFiltroDpto([]); setFiltroMunicipio([]); setFiltroOperadora([]); setFiltroTipo([]); }} 
            style={{ padding: 12, background: "var(--color-bg-elevated)", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, marginTop: 12, fontSize: 13, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <RotateCcw size={14} /> Limpiar Filtros
          </button>
        </div>
      </div>

      <div className="page-header">
        <h1 style={{ color: 'var(--color-danger)', fontWeight: 900 }}>SIM Bloqueos Upstream</h1>
        <p>
          {kpis.total.toLocaleString("es-CO")} eventos · Reporte Consolidado
          {filtrosActivos > 0 && <span style={{ marginLeft: 12, background: 'var(--color-danger)', color: '#fff', padding: '3px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>{filtrosActivos} activos</span>}
        </p>
      </div>

      <div className="kpi-grid">
        <KPICard label="Total Eventos" value={kpis.total.toLocaleString("es-CO")} color="danger" icon={AlertCircle} />
        <KPICard label="Alarmas" value={kpis.alarmas.toLocaleString("es-CO")} color="warning" icon={TriangleAlert} />
        <KPICard label="Bloqueos" value={kpis.bloqueos.toLocaleString("es-CO")} color="danger" icon={Ban} />
        <KPICard label="Días perdidos" value={kpis.dias.toLocaleString("es-CO")} unit="días" color="secondary" icon={Calendar} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '24px', marginBottom: '24px' }}>
        <div className="panel" id="panel-bloq-hist" style={{ gridColumn: '1 / -1' }}>
          <div className="panel-header">
            <span className="panel-title">Evolución de Eventos vs Producción</span>
            <ExportButton targetId="panel-bloq-hist" fileName="Cruce_Bloqueos_Produccion" />
          </div>
          <div className="panel-body">
            {typeof window !== "undefined" && chartSeriesCruce ? (
              <Chart
                type="line"
                height={450}
                series={[
                  { name: "Alarmas", type: "column", data: chartSeriesCruce.alarmas },
                  { name: "Bloqueos", type: "column", data: chartSeriesCruce.bloqueos },
                  { name: "Producción Petróleo (BPDC)", type: "line", data: chartSeriesCruce.petroleo.map(v => Math.round(v)) },
                  { name: "Producción Gas (MPCD)", type: "line", data: chartSeriesCruce.gas.map(v => Math.round(v)) },
                ]}
                options={{
                  ...chartBase,
                  chart: { ...chartBase.chart, stacked: true },
                  stroke: { width: [0, 0, 4, 4], curve: 'smooth' },
                  xaxis: { categories: chartSeriesCruce.categories },
                  colors: ["#F59E0B", "#DC2626", "#D44D03", "#003745"],
                  dataLabels: { enabled: false },
                  yaxis: [
                    {
                      title: { text: "Eventos", style: { color: "#DC2626", fontWeight: 700 } },
                      labels: { style: { colors: "#DC2626" }, formatter: (v: number) => formatNum(v) },
                    },
                    { show: false, seriesName: "Alarmas" },
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
                          if (seriesIndex === 0) return formatNum(y) + " alarmas";
                          if (seriesIndex === 1) return formatNum(y) + " bloqueos";
                          if (seriesIndex === 2) return formatAbbr(y) + " BPDC";
                          if (seriesIndex === 3) return formatAbbr(y) + " MPCD";
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
        <div className="panel" id="panel-bloq-dpto">
          <div className="panel-header">
            <span className="panel-title">Top Departamentos Afectados</span>
            <ExportButton targetId="panel-bloq-dpto" fileName="Top_Dptos_Bloqueos" />
          </div>
          <div className="panel-body">
            {typeof window !== "undefined" && porDpto.length > 0 && (
              <Chart type="bar" height={380} 
                series={[{ name: "Eventos", data: porDpto.map(([, v]) => v) }]} 
                options={{ 
                  ...chartBase, 
                  plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: "95%", dataLabels: { position: 'center' } } }, 
                  xaxis: { 
                    categories: porDpto.map(([d]) => d), 
                    labels: { style: { colors: 'var(--color-text-muted)', fontSize: '10px' } } 
                  }, 
                  colors: ["#E65100"],
                  dataLabels: { 
                    enabled: true, 
                    formatter: (v: number) => formatNum(v),
                    style: { fontSize: "11px", fontWeight: 700 } 
                  },
                  responsive: [{
                    breakpoint: 640,
                    options: {
                      chart: { height: 260 },
                      dataLabels: { enabled: false }
                    }
                  }]
                }} 
              />
            )}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Detalle: Alarmas y Bloqueos</span>
          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{filtrados.length} registros</span>
        </div>
        <DataTable
          data={filtrados}
          columns={[
            { key: "Fecha", label: "Fecha", width: "100px", render: (v) => <span style={{ fontFamily: "monospace", fontSize: 11, opacity: 0.7 }}>{v}</span> },
            { key: "TipoEvento", label: "Tipo", render: (v) => <span className={`badge ${String(v).includes("Bloqueo") ? "badge-bloqueo" : "badge-alarma"}`}>{v}</span> },
            { key: "Departamento", label: "Departamento" },
            { key: "Municipio", label: "Municipio" },
            { key: "Operadora", label: "Operadora", render: (v) => <span style={{ fontWeight: 700, color: "var(--color-secondary)" }}>{v}</span> },
            { key: "DuracionDias", label: "Días", align: "right", render: (v) => <span style={{ fontWeight: 700 }}>{v}</span> },
            { key: "Estado", label: "Estado" },
          ]}
          pageSize={100}
        />
      </div>
    </div>
  );
}

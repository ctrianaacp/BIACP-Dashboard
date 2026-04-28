"use client";
import dynamic from "next/dynamic";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Droplets, 
  Building2, 
  Map, 
  FileText, 
  Search, 
  X, 
  RotateCcw, 
  Calendar, 
  Factory, 
  MapPin 
} from "lucide-react";
import Loading from "@/components/Loading";
import { formatNum, formatAbbr, formatCurrency } from "@/lib/formatters";
import ExportButton from "@/components/ExportButton";
import MultiSelect from "@/components/MultiSelect";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

// ─── API ANLA ─────────────────────────────────────────────────────────────────
const BASE = "https://services5.arcgis.com/liN1hRR4thdzBW4F/arcgis/rest/services/Seguimiento_Inversion_1_por_ciento/FeatureServer/0";
const FIELDS = "EXPEDIENTE,TITULAR_DE_LA_LICENCIA,SECTOR_ANLA_AL_CUAL_PERTENECE,DEPARTAMENTO_EN_EL_QUE_SE_REALI,MUNICIPIO_EN_EL_QUE_SE_REALIZA_,CAR_EN_EL_QUE_SE_REALIZA_EL_PRO,REGIONAL,PROYECTO,FECHA_DEL_ACTO_ADMINISTRATIVO_E";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Registro1Pct {
  expediente: string;
  titular: string;
  sector: string;
  departamento: string;
  municipio: string;
  car: string;
  regional: string;
  proyecto: string;
  anio: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function safeStr(v: unknown): string {
  return v != null ? String(v).trim() : "";
}
function fmt(v: number) {
  return new Intl.NumberFormat("es-CO").format(v);
}

// ─── Fetch paginado secuencial ─────────────────────────────────────────────────
async function cargarInversion1Pct(): Promise<Registro1Pct[]> {
  const baseParams = `where=1%3D1&outFields=${encodeURIComponent(FIELDS)}&returnGeometry=false&f=json`;

  // Obtener conteo total
  const countRes = await fetch(`${BASE}/query?${baseParams}&returnCountOnly=true`);
  if (!countRes.ok) throw new Error(`HTTP ${countRes.status}`);
  const countData = await countRes.json();
  if (countData.error) throw new Error(countData.error.message);
  const total: number = countData.count ?? 0;

  // Paginar de 2000 en 2000
  const PAGE = 2000;
  const all: Record<string, unknown>[] = [];
  for (let offset = 0; offset < total; offset += PAGE) {
    const res = await fetch(`${BASE}/query?${baseParams}&resultOffset=${offset}&resultRecordCount=${PAGE}`);
    if (!res.ok) throw new Error(`HTTP ${res.status} (offset ${offset})`);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    const features: { attributes: Record<string, unknown> }[] = data.features ?? [];
    all.push(...features.map(f => f.attributes));
    if (features.length < PAGE) break;
  }

  return all.map(r => {
    const fechaStr = safeStr(r["FECHA_DEL_ACTO_ADMINISTRATIVO_E"]);
    const anio = fechaStr ? fechaStr.substring(0, 4) : "";
    return {
      expediente: safeStr(r["EXPEDIENTE"]),
      titular: safeStr(r["TITULAR_DE_LA_LICENCIA"]) || "Sin titular",
      sector: safeStr(r["SECTOR_ANLA_AL_CUAL_PERTENECE"]) || "Sin sector",
      departamento: safeStr(r["DEPARTAMENTO_EN_EL_QUE_SE_REALI"]) || "Sin departamento",
      municipio: safeStr(r["MUNICIPIO_EN_EL_QUE_SE_REALIZA_"]) || "Sin municipio",
      car: safeStr(r["CAR_EN_EL_QUE_SE_REALIZA_EL_PRO"]) || "Sin CAR",
      regional: safeStr(r["REGIONAL"]) || "Sin regional",
      proyecto: safeStr(r["PROYECTO"]),
      anio,
    };
  });
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({ label, value, color, icon: Icon, sub }: {
  label: string; value: string; color: string; icon: any; sub?: string;
}) {
  return (
    <div className={`kpi-card ${color}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-delta">{sub}</div>}
      <span className="kpi-icon"><Icon size={24} strokeWidth={2.5} /></span>
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────
export default function Inversion1PctPage() {
  const [filtroSector, setFiltroSector] = useState<string[]>([]);
  const [filtroDpto, setFiltroDpto] = useState<string[]>([]);
  const [filtroAnio, setFiltroAnio] = useState<string[]>([]);
  const [filtroRegional, setFiltroRegional] = useState<string[]>([]);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

  const filtrosActivos = [filtroSector, filtroDpto, filtroAnio, filtroRegional].filter(v => v.length > 0).length;

  const limpiar = () => {
    setFiltroSector([]); setFiltroDpto([]);
    setFiltroAnio([]); setFiltroRegional([]);
  };

  const { data: registros = [], isLoading, error } = useQuery({
    queryKey: ["inversion-1pct-anla"],
    queryFn: cargarInversion1Pct,
    staleTime: 30 * 60 * 1000,
    retry: 2,
  });

  // Opciones de filtros
  const sectores = useMemo(() => Array.from(new Set(registros.map(r => r.sector))).filter(Boolean).sort(), [registros]);
  const departamentos = useMemo(() => Array.from(new Set(registros.map(r => r.departamento))).filter(Boolean).sort(), [registros]);
  const anios = useMemo(() => Array.from(new Set(registros.map(r => r.anio))).filter(Boolean).sort().reverse(), [registros]);
  const regionales = useMemo(() => Array.from(new Set(registros.map(r => r.regional))).filter(Boolean).sort(), [registros]);

  // Filtrado
  const filtrados = useMemo(() => registros.filter(r => {
    if (filtroSector.length > 0 && !filtroSector.includes(r.sector)) return false;
    if (filtroDpto.length > 0 && !filtroDpto.includes(r.departamento)) return false;
    if (filtroAnio.length > 0 && !filtroAnio.includes(r.anio)) return false;
    if (filtroRegional.length > 0 && !filtroRegional.includes(r.regional)) return false;
    return true;
  }), [registros, filtroSector, filtroDpto, filtroAnio, filtroRegional]);

  // KPIs — usando expedientes únicos para contar proyectos reales
  const kpis = useMemo(() => {
    const expedientesUnicos = new Set(filtrados.map(r => r.expediente));
    const titularesUnicos = new Set(filtrados.map(r => r.titular));
    const dptosUnicos = new Set(filtrados.map(r => r.departamento));
    const municipiosUnicos = new Set(filtrados.map(r => r.municipio));
    const sectoresUnicos = new Set(filtrados.map(r => r.sector));
    return {
      proyectos: expedientesUnicos.size,
      titulares: titularesUnicos.size,
      dptos: dptosUnicos.size,
      municipios: municipiosUnicos.size,
      sectores: sectoresUnicos.size,
      registros: filtrados.length,
    };
  }, [filtrados]);

  // Top 10 titulares por número de proyectos únicos
  const topTitulares = useMemo(() => {
    const acc: Record<string, Set<string>> = {};
    filtrados.forEach(r => {
      if (!acc[r.titular]) acc[r.titular] = new Set();
      acc[r.titular].add(r.expediente);
    });
    return Object.entries(acc)
      .map(([t, s]) => [t, s.size] as [string, number])
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);
  }, [filtrados]);

  // Por sector
  const porSector = useMemo(() => {
    const acc: Record<string, Set<string>> = {};
    filtrados.forEach(r => {
      if (!acc[r.sector]) acc[r.sector] = new Set();
      acc[r.sector].add(r.expediente);
    });
    return Object.entries(acc).map(([s, exp]) => ({ x: s, y: exp.size })).sort((a, b) => b.y - a.y);
  }, [filtrados]);

  // Por año (línea de tendencia)
  const porAnio = useMemo(() => {
    const acc: Record<string, Set<string>> = {};
    filtrados.forEach(r => {
      if (!r.anio) return;
      if (!acc[r.anio]) acc[r.anio] = new Set();
      acc[r.anio].add(r.expediente);
    });
    return Object.entries(acc).sort(([a], [b]) => a.localeCompare(b));
  }, [filtrados]);

  // Por departamento (top 8)
  const porDpto = useMemo(() => {
    const acc: Record<string, Set<string>> = {};
    filtrados.forEach(r => {
      if (!acc[r.departamento]) acc[r.departamento] = new Set();
      acc[r.departamento].add(r.expediente);
    });
    return Object.entries(acc)
      .map(([d, s]) => [d, s.size] as [string, number])
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8);
  }, [filtrados]);

  const chartBase = {
    chart: { background: "transparent", toolbar: { show: false }, fontFamily: "var(--font-main)" },
    theme: { mode: "light" as const },
    grid: { borderColor: "var(--color-border)" },
  };


  if (isLoading) return <Loading message="Consultando datos ambientales (ANLA)..." />;

  if (error) return (
    <div className="page-content">
      <div className="page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Droplets size={32} strokeWidth={2.5} style={{ color: "var(--color-primary)" }} />
          Inversión 1% Ambiental
        </h1>
      </div>
      <div className="panel">
        <div className="panel-body" style={{ textAlign: "center", padding: 48 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <RotateCcw size={40} style={{ color: "var(--color-danger)" }} />
          </div>
          <div style={{ color: "var(--color-danger)", fontWeight: 800 }}>Error al conectar con ANLA</div>
          <div style={{ color: "var(--color-text-muted)", marginTop: 8 }}>{String(error)}</div>
        </div>
      </div>
    </div>
  );

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
          {[
            { label: "Sector", value: filtroSector, icon: <Factory size={14} />, onChange: setFiltroSector, options: sectores },
            { label: "Departamento", value: filtroDpto, icon: <MapPin size={14} />, onChange: setFiltroDpto, options: departamentos },
            { label: "Regional ANLA", value: filtroRegional, icon: <Map size={14} />, onChange: setFiltroRegional, options: regionales },
            { label: "Año", value: filtroAnio, icon: <Calendar size={14} />, onChange: setFiltroAnio, options: anios },
          ].map(f => (
            <div key={f.label}>
              <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {f.icon} {f.label}
              </label>
              <MultiSelect options={f.options} selected={f.value} onChange={f.onChange} />
            </div>
          ))}
          <button 
            onClick={limpiar} 
            style={{ padding: 12, background: "var(--color-bg-elevated)", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, marginTop: 12, fontSize: 13, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <RotateCcw size={14} /> Limpiar Filtros
          </button>
        </div>
      </div>

      <div className="page-header">
        <h1 style={{ color: 'var(--color-primary)', fontWeight: 900 }}>Inversión 1% Ambiental</h1>
        <p>
          {kpis.proyectos.toLocaleString("es-CO")} proyectos únicos · Fuente: ANLA
          {filtrosActivos > 0 && <span style={{ marginLeft: 12, background: 'var(--color-primary)', color: '#fff', padding: '3px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>{filtrosActivos} activos</span>}
        </p>
      </div>

      <div className="kpi-grid">
        <KPICard label="Proyectos con Oblig. 1%" value={fmt(kpis.proyectos)} color="primary" icon={Droplets} sub="Expedientes únicos" />
        <KPICard label="Titulares de Licencia" value={fmt(kpis.titulares)} color="secondary" icon={Building2} />
        <KPICard label="Departamentos" value={fmt(kpis.dptos)} color="success" icon={Map} />
        <KPICard label="Registros Totales" value={fmt(kpis.registros)} color="info" icon={FileText} sub={`${kpis.sectores} sectores`} />
      </div>

      <div className="charts-grid">
        <div className="panel" id="panel-inv1pct-titulares">
          <div className="panel-header">
            <span className="panel-title">Top 10 Titulares (Proyectos)</span>
            <ExportButton targetId="panel-inv1pct-titulares" fileName="Top_Titulares_1Pct" />
          </div>
          <div className="panel-body">
            {typeof window !== "undefined" && topTitulares.length > 0 && (
              <Chart key={topTitulares.map(([t]) => t).join(",")} type="bar" height={380}
                series={[{ name: "Proyectos", data: topTitulares.map(([, v]) => v) }]}
                options={{
                  ...chartBase,
                  plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: "95%", dataLabels: { position: 'center' } } },
                  xaxis: { categories: topTitulares.map(([t]) => t), labels: { style: { colors: "var(--color-text-muted)" } } },
                  colors: ["#D44D03"],
                  dataLabels: { enabled: true, formatter: (v: number) => formatNum(v), style: { fontSize: "11px", fontWeight: 700 } }
                }}
              />
            )}
          </div>
        </div>
        <div className="panel" id="panel-inv1pct-sector">
          <div className="panel-header">
            <span className="panel-title">Distribución por Sector ANLA</span>
            <ExportButton targetId="panel-inv1pct-sector" fileName="Distribucion_Sector_1Pct" />
          </div>
          <div className="panel-body">
            {typeof window !== "undefined" && porSector.length > 0 && (
              <Chart key={porSector.map(s => s.x).join(",")} type="donut" height={380}
                series={porSector.map(s => s.y)}
                options={{
                  ...chartBase,
                  labels: porSector.map(s => s.x),
                  colors: ["#D44D03", "#003745", "#008054", "#C68400", "#29B6F6", "#4FC3F7"],
                  legend: { position: "bottom", fontSize: "12px" },
                  tooltip: { theme: "light", y: { formatter: (v: number) => `${formatNum(v)} proyectos` } }
                }}
              />
            )}
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="panel" id="panel-inv1pct-anio">
          <div className="panel-header">
            <span className="panel-title">Evolución Anual (Actos Admin)</span>
            <ExportButton targetId="panel-inv1pct-anio" fileName="Evolucion_Anual_1Pct" />
          </div>
          <div className="panel-body">
            {typeof window !== "undefined" && porAnio.length > 0 && (
              <Chart key={porAnio.map(([a]) => a).join(",")} type="area" height={380}
                series={[{ name: "Proyectos", data: porAnio.map(([, s]) => (s as Set<string>).size) }]}
                options={{
                  ...chartBase,
                  xaxis: { categories: porAnio.map(([a]) => a), labels: { style: { colors: "var(--color-text-muted)" } } },
                  colors: ["#003745"],
                  fill: { type: "linear", opacity: 0.1 },
                  stroke: { curve: "smooth", width: 3 },
                  dataLabels: { enabled: false }
                }}
              />
            )}
          </div>
        </div>
        <div className="panel" id="panel-inv1pct-dpto">
          <div className="panel-header">
            <span className="panel-title">Top 8 Departamentos</span>
            <ExportButton targetId="panel-inv1pct-dpto" fileName="Top_Dptos_1Pct" />
          </div>
          <div className="panel-body">
            {typeof window !== "undefined" && porDpto.length > 0 && (
              <Chart key={porDpto.map(([d]) => d).join(",")} type="bar" height={380}
                series={[{ name: "Proyectos", data: porDpto.map(([, v]) => v) }]}
                options={{
                  ...chartBase,
                  xaxis: { categories: porDpto.map(([d]) => d), labels: { style: { colors: "var(--color-text-muted)" } } },
                  colors: ["#008054"],
                  plotOptions: { bar: { borderRadius: 4, columnWidth: "80%" } },
                  dataLabels: { enabled: true, formatter: (v: number) => formatNum(v), style: { fontSize: "11px", fontWeight: 700 } }
                }}
              />
            )}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Detalle: Inversión 1%</span>
          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{filtrados.length} registros</span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Expediente</th>
                <th>Titular</th>
                <th>Sector</th>
                <th>Departamento</th>
                <th>Municipio</th>
                <th>Año</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.slice(0, 100).map((r, i) => (
                <tr key={i}>
                  <td data-label="Expediente" className="font-mono" style={{ fontSize: 11 }}>{r.expediente || "—"}</td>
                  <td data-label="Titular" style={{ fontWeight: 600 }}>{r.titular}</td>
                  <td data-label="Sector"><span className="badge info">{r.sector}</span></td>
                  <td data-label="Departamento">{r.departamento}</td>
                  <td data-label="Municipio">{r.municipio}</td>
                  <td data-label="Año" style={{ fontWeight: 700, color: "var(--color-primary)" }}>{r.anio || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

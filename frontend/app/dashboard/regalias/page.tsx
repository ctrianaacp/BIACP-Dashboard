"use client";
import dynamic from "next/dynamic";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  DollarSign, 
  BarChart3, 
  Banknote, 
  TrendingUp, 
  Search, 
  X, 
  RotateCcw, 
  Map, 
  ClipboardList 
} from "lucide-react";
import Loading from "@/components/Loading";
import ExportButton from "@/components/ExportButton";
import MultiSelect from "@/components/MultiSelect";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface FilaSGR {
  departamento: string;
  region: string;
  seccion: string;
  entidad: string;
  proyecto: string;
  fuente: string;
  vigencia: string;
  apropiacion_inicial: number;
  apropiacion_definitiva: number;
  compromisos: number;
  obligaciones: number;
  pagos: number;
}

interface ApiResponse {
  registros: FilaSGR[];
  total: number;
  columnas_originales: string[];
  fuente: string;
  vigencia_archivo: string;
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtCOP(v: number): string {
  if (v >= 1_000_000_000_000) return `$${(v / 1_000_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000_000)     return `$${(v / 1_000_000_000).toFixed(1)}MM`;
  if (v >= 1_000_000)         return `$${(v / 1_000_000).toFixed(0)}M`;
  return `$${Math.round(v).toLocaleString("es-CO")}`;
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

// ─── Fetch MinHacienda ────────────────────────────────────────────────────────
async function cargarSGR(): Promise<ApiResponse> {
  const res = await fetch("/api/sgr-minhacienda");
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Error ${res.status} consultando SGR MinHacienda`);
  }
  return res.json();
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function RegaliasPage() {
  const [filtroRegion, setFiltroRegion]   = useState<string[]>([]);
  const [filtroSeccion, setFiltroSeccion] = useState<string[]>([]);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

  const filtrosActivos = [filtroRegion, filtroSeccion].filter(v => v.length > 0).length;

  const { data: apiData, isLoading, error } = useQuery({
    queryKey: ["sgr-minhacienda-v1"],
    queryFn: cargarSGR,
    staleTime: 4 * 60 * 60 * 1000, // 4h
    retry: 2,
  });

  const registros = apiData?.registros ?? [];

  // ── Opciones de filtros ──
  const regiones  = useMemo(() => Array.from(new Set(registros.map(r => r.region).filter(v => v && v !== "N/A"))).sort(), [registros]);
  const secciones = useMemo(() => Array.from(new Set(registros.map(r => r.seccion).filter(v => v && v !== "N/A"))).sort(), [registros]);

  // ── Filtros aplicados ──
  const filtrados = useMemo(() => registros.filter(r => {
    if (filtroRegion.length > 0 && !filtroRegion.includes(r.region)) return false;
    if (filtroSeccion.length > 0 && !filtroSeccion.includes(r.seccion)) return false;
    return true;
  }), [registros, filtroRegion, filtroSeccion]);

  // ── KPIs ──
  const kpis = useMemo(() => {
    const ini = filtrados.reduce((s, r) => s + r.apropiacion_inicial, 0);
    const def = filtrados.reduce((s, r) => s + r.apropiacion_definitiva, 0);
    const com = filtrados.reduce((s, r) => s + r.compromisos, 0);
    const obl = filtrados.reduce((s, r) => s + r.obligaciones, 0);
    const pag = filtrados.reduce((s, r) => s + r.pagos, 0);
    const var_ = ini > 0 ? ((def - ini) / ini) * 100 : 0;
    const ejec = def > 0 ? (com / def) * 100 : 0;
    return { ini, def, com, obl, pag, var_, ejec };
  }, [filtrados]);

  const porConcepto = useMemo(() => {
    const acc: Record<string, number> = {};
    filtrados.forEach(r => { if (r.proyecto && r.proyecto !== "N/A") acc[r.proyecto] = (acc[r.proyecto] ?? 0) + r.apropiacion_definitiva; });
    return Object.entries(acc).sort(([, a], [, b]) => b - a).slice(0, 10);
  }, [filtrados]);

  const topEntidades = useMemo(() => {
    const acc: Record<string, number> = {};
    filtrados.forEach(r => { if (r.entidad && r.entidad !== "N/A") acc[r.entidad] = (acc[r.entidad] ?? 0) + r.apropiacion_definitiva; });
    return Object.entries(acc).sort(([, a], [, b]) => b - a).slice(0, 10);
  }, [filtrados]);

  const chartBase = {
    chart: { background: "transparent", toolbar: { show: false }, fontFamily: "var(--font-main)" },
    theme: { mode: "light" as const },
    grid: { borderColor: "var(--color-border)" },
  };

  if (isLoading) return <Loading message="Descargando datos del Sistema General de Regalías (MinHacienda)..." />;

  if (error || apiData?.error) return (
    <div className="page-content">
      <div className="page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <DollarSign size={32} strokeWidth={2.5} style={{ color: "var(--color-primary)" }} />
          Regalías (SGR)
        </h1>
      </div>
      <div className="panel">
        <div className="panel-body" style={{ textAlign: "center", padding: 48 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <RotateCcw size={40} style={{ color: "var(--color-danger)" }} />
          </div>
          <div style={{ color: "var(--color-danger)", fontWeight: 800 }}>Error al consultar SGR</div>
          <div style={{ color: "var(--color-text-muted)", marginTop: 8 }}>{apiData?.error ?? String(error)}</div>
        </div>
      </div>
    </div>
  );

  const totalEntidades = new Set(filtrados.map(r => r.entidad).filter(Boolean)).size;

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
            { label: "Región", value: filtroRegion, icon: <Map size={14} />, onChange: setFiltroRegion, options: regiones },
            { label: "Sección", value: filtroSeccion, icon: <ClipboardList size={14} />, onChange: setFiltroSeccion, options: secciones },
          ].map(f => (
            <div key={f.label}>
              <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {f.icon} {f.label}
              </label>
              <MultiSelect options={f.options} selected={f.value} onChange={f.onChange} />
            </div>
          ))}
          <button 
            onClick={() => { setFiltroRegion([]); setFiltroSeccion([]); }} 
            style={{ padding: 12, background: "var(--color-bg-elevated)", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, marginTop: 12, fontSize: 13, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <RotateCcw size={14} /> Limpiar Filtros
          </button>
        </div>
      </div>

      <div className="page-header">
        <h1 style={{ color: 'var(--color-primary)', fontWeight: 900 }}>Regalías (SGR)</h1>
        <p>
          Presupuesto Bienio 2025-2026 · {filtrados.length.toLocaleString("es-CO")} registros
          {filtrosActivos > 0 && <span style={{ marginLeft: 12, background: 'var(--color-primary)', color: '#fff', padding: '3px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>{filtrosActivos} activos</span>}
        </p>
      </div>

      <div className="kpi-grid">
        <KPICard label="Aprop. Definitiva" value={fmtCOP(kpis.def)} color="primary" icon={DollarSign} sub={`Inicial: ${fmtCOP(kpis.ini)}`} />
        <KPICard label="Ejecución (Compromisos)" value={`${kpis.ejec.toFixed(1)}%`} color={kpis.ejec >= 50 ? "success" : "warning"} icon={BarChart3} sub={`Comprometido: ${fmtCOP(kpis.com)}`} />
        <KPICard label="Pagos Realizados" value={fmtCOP(kpis.pag)} color="info" icon={Banknote} sub={`Total Entidades: ${totalEntidades}`} />
        <KPICard label="Variación Presupuesto" value={`${kpis.var_ >= 0 ? "+" : ""}${kpis.var_.toFixed(1)}%`} color={kpis.var_ >= 0 ? "success" : "danger"} icon={TrendingUp} sub="Definitiva vs Inicial" />
      </div>

      <div className="charts-grid">
        <div className="panel" id="panel-regalias-concepto">
          <div className="panel-header">
            <span className="panel-title">Apropiación por Concepto</span>
            <ExportButton targetId="panel-regalias-concepto" fileName="Apropiacion_Concepto" />
          </div>
          <div className="panel-body">
            {typeof window !== "undefined" && porConcepto.length > 0 && (
              <Chart type="bar" height={380}
                series={[{ name: "Aprop. Definitiva (MM)", data: porConcepto.map(([, v]) => Math.round(v / 1_000_000_000)) }]}
                options={{
                  ...chartBase,
                  plotOptions: { 
                    bar: { horizontal: true, borderRadius: 4, barHeight: "95%", dataLabels: { position: 'center' } } 
                  },
                  xaxis: { categories: porConcepto.map(([k]) => k.length > 30 ? k.slice(0, 30) + "…" : k), labels: { style: { colors: "var(--color-text-muted)" } } },
                  colors: ["#D44D03"],
                  dataLabels: { 
                    enabled: true, 
                    style: { fontSize: "11px", fontWeight: 700 }, 
                    formatter: (v: number) => `$${v.toLocaleString("es-CO")}MM` 
                  }
                }}
              />
            )}
          </div>
        </div>
        <div className="panel" id="panel-regalias-cadena">
          <div className="panel-header">
            <span className="panel-title">Estado de la Cadena Presupuestal</span>
            <ExportButton targetId="panel-regalias-cadena" fileName="Cadena_Presupuestal" />
          </div>
          <div className="panel-body">
            {typeof window !== "undefined" && (
              <Chart type="bar" height={380}
                series={[{
                  name: "Miles de millones COP",
                  data: [
                    Math.round(kpis.def / 1_000_000_000),
                    Math.round(kpis.com / 1_000_000_000),
                    Math.round(kpis.obl / 1_000_000_000),
                    Math.round(kpis.pag / 1_000_000_000),
                  ]
                }]}
                options={{
                  ...chartBase,
                  plotOptions: { bar: { distributed: true, borderRadius: 4, columnWidth: "80%" } },
                  xaxis: { categories: ["Aprop. Definitiva", "Compromisos", "Obligaciones", "Pagos"], labels: { style: { colors: "var(--color-text-muted)" } } },
                  colors: ["#D44D03", "#003745", "#008054", "#C68400"],
                  dataLabels: { enabled: true, style: { fontSize: "11px", fontWeight: 700 }, formatter: (v: number) => `$${v.toLocaleString("es-CO")}MM` },
                  legend: { show: false }
                }}
              />
            )}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Distribución por Entidad (Top 10)</span>
          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{topEntidades.length} entidades totales</span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Entidad / Asignación</th>
                <th style={{ textAlign: "right" }}>Aprop. Definitiva</th>
                <th style={{ textAlign: "right" }}>Compromisos</th>
                <th style={{ textAlign: "right" }}>Pagos</th>
                <th style={{ textAlign: "right" }}>% Ejec.</th>
              </tr>
            </thead>
            <tbody>
              {topEntidades.map(([entidad, val], i) => {
                const r = filtrados.find(f => f.entidad === entidad);
                const ejec = val > 0 ? ((r?.compromisos ?? 0) / val) * 100 : 0;
                return (
                  <tr key={i}>
                    <td data-label="Entidad" style={{ fontWeight: 600 }}>{entidad}</td>
                    <td data-label="Aprop. Definitiva" style={{ textAlign: "right", fontWeight: 700, color: "var(--color-primary)" }}>{fmtCOP(val)}</td>
                    <td data-label="Compromisos" style={{ textAlign: "right" }}>{fmtCOP(r?.compromisos ?? 0)}</td>
                    <td data-label="Pagos" style={{ textAlign: "right" }}>{fmtCOP(r?.pagos ?? 0)}</td>
                    <td data-label="% Ejec." style={{ textAlign: "right" }}>
                      <span className={`badge ${ejec >= 50 ? "success" : "warning"}`}>
                        {ejec.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

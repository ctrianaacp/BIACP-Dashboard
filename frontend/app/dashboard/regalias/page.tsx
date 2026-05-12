"use client";
import dynamic from "next/dynamic";
import { useState, useMemo, useEffect } from "react";
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
  ClipboardList,
  Calendar
} from "lucide-react";
import Loading from "@/components/Loading";
import ExportButton from "@/components/ExportButton";
import MultiSelect from "@/components/MultiSelect";
import DataTable from "@/components/DataTable";
import PBCLineCharts from "@/components/regalias/PBCLineCharts";
import PBCBarCharts from "@/components/regalias/PBCBarCharts";
import RecaudoAvanceCharts from "@/components/regalias/RecaudoAvanceCharts";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

// ─── Tipos SICODIS ─────────────────────────────────────────────────────────────
interface FilaSicodis {
  departamento: string;
  region: string;
  entidad: string;
  proyecto: string; // concepto
  municipio: string;
  presupuesto_total: string | number;
  presupuesto_corriente: string | number;
  rendimientos_financieros: string | number;
  recaudo_total: string | number;
  recaudo_corriente: string | number;
  avance_recaudo_total: string | number;
}

interface HistoricoItem {
  vigencia: string;
  presupuesto_total: string | number;
}

interface ApiResponse {
  registros: FilaSicodis[];
  historico: HistoricoItem[];
  vigencias: string[];
  vigencia_activa: string;
  total: number;
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtCOP(v: number): string {
  if (v >= 1_000_000_000_000) return `$${(v / 1_000_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000_000)     return `$${(v / 1_000_000_000).toFixed(1)}MM`;
  if (v >= 1_000_000)         return `$${(v / 1_000_000).toFixed(0)}M`;
  return `$${Math.round(v).toLocaleString("es-CO")}`;
}

function parseNum(val: string | number): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  return Number(val) || 0;
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

// ─── Fetch Postgres ───────────────────────────────────────────────────────────
async function cargarSGR(vigencia: string): Promise<ApiResponse> {
  const params = new URLSearchParams();
  if (vigencia) params.append("vigencia", vigencia);
  const res = await fetch(`/api/regalias-sicodis?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Error ${res.status} consultando base de datos SICODIS`);
  }
  return res.json();
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function RegaliasPage() {
  const [vigencia, setVigencia] = useState("2025 - 2026");
  const [pbcData, setPbcData] = useState<any>(null);
  const [filtroRegion, setFiltroRegion]   = useState<string[]>([]);
  const [filtroDepto, setFiltroDepto] = useState<string[]>([]);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

  const filtrosActivos = [filtroRegion, filtroDepto].filter(v => v.length > 0).length;

  const { data: apiData, isLoading, error } = useQuery({
    queryKey: ["regalias-sicodis", vigencia],
    queryFn: () => cargarSGR(vigencia),
    staleTime: 4 * 60 * 60 * 1000, // 4h
    retry: 1,
  });

  // Fetch PBC Data
  useEffect(() => {
    fetch(`/api/regalias-pbc?vigencia=${encodeURIComponent(vigencia)}`)
      .then(res => res.json())
      .then(data => setPbcData(data))
      .catch(console.error);
  }, [vigencia]);

  const registros = apiData?.registros ?? [];
  const historico = apiData?.historico ?? [];
  const vigenciasDisponibles = apiData?.vigencias ?? ["2025 - 2026"];

  // ── Opciones de filtros ──
  const regiones  = useMemo(() => Array.from(new Set(registros.map(r => r.region).filter(v => v && v !== "N/A"))).sort(), [registros]);
  const departamentos = useMemo(() => Array.from(new Set(registros.map(r => r.departamento).filter(v => v && v !== "N/A"))).sort(), [registros]);

  // ── Filtros aplicados ──
  const filtrados = useMemo(() => registros.filter(r => {
    if (filtroRegion.length > 0 && !filtroRegion.includes(r.region)) return false;
    if (filtroDepto.length > 0 && !filtroDepto.includes(r.departamento)) return false;
    return true;
  }), [registros, filtroRegion, filtroDepto]);

  // ── KPIs ──
  const kpis = useMemo(() => {
    // El presupuesto oficial es Corriente + Rendimientos
    const pOficial = filtrados.reduce((s, r) => s + parseNum(r.presupuesto_corriente) + parseNum(r.rendimientos_financieros), 0);
    const pCorriente = filtrados.reduce((s, r) => s + parseNum(r.presupuesto_corriente), 0);
    const rCorriente = filtrados.reduce((s, r) => s + parseNum(r.recaudo_corriente), 0);
    const rTotal = filtrados.reduce((s, r) => s + parseNum(r.recaudo_total), 0);
    const avance = pOficial > 0 ? (rTotal / pOficial) * 100 : 0;
    return { pOficial, pCorriente, rTotal, rCorriente, avance };
  }, [filtrados]);

  const porConcepto = useMemo(() => {
    const acc: Record<string, number> = {};
    filtrados.forEach(r => { if (r.proyecto) acc[r.proyecto] = (acc[r.proyecto] ?? 0) + parseNum(r.presupuesto_total); });
    return Object.entries(acc).sort(([, a], [, b]) => b - a).slice(0, 10);
  }, [filtrados]);

  const chartBase = {
    chart: { background: "transparent", toolbar: { show: false }, fontFamily: "var(--font-main)" },
    theme: { mode: "light" as const },
    grid: { borderColor: "var(--color-border)" },
  };

  if (isLoading && !apiData) return <Loading message="Conectando a base de datos analítica SICODIS..." />;

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
          <div style={{ color: "var(--color-danger)", fontWeight: 800 }}>Error al consultar Base de Datos</div>
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
          
          <div>
            <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <Calendar size={14} /> Vigencia (Bienio)
            </label>
            <select 
              value={vigencia} 
              onChange={e => setVigencia(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', fontWeight: 600, color: 'var(--color-primary)' }}
            >
              {vigenciasDisponibles.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          {[
            { label: "Región", value: filtroRegion, icon: <Map size={14} />, onChange: setFiltroRegion, options: regiones },
            { label: "Departamento", value: filtroDepto, icon: <ClipboardList size={14} />, onChange: setFiltroDepto, options: departamentos },
          ].map(f => (
            <div key={f.label}>
              <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {f.icon} {f.label}
              </label>
              <MultiSelect options={f.options} selected={f.value} onChange={f.onChange} />
            </div>
          ))}
          <button 
            onClick={() => { setFiltroRegion([]); setFiltroDepto([]); }} 
            style={{ padding: 12, background: "var(--color-bg-elevated)", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, marginTop: 12, fontSize: 13, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <RotateCcw size={14} /> Limpiar Filtros
          </button>
        </div>
      </div>

      <div className="page-header">
        <h1 style={{ color: 'var(--color-primary)', fontWeight: 900 }}>Regalías (SGR) - SICODIS</h1>
        <p>
          Presupuesto vs Recaudo · Bienio {vigencia} · {filtrados.length.toLocaleString("es-CO")} registros
          {filtrosActivos > 0 && <span style={{ marginLeft: 12, background: 'var(--color-primary)', color: '#fff', padding: '3px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>{filtrosActivos} activos</span>}
        </p>
      </div>

      <div className="kpi-grid">
        <KPICard label="Presupuesto Oficial (SGR)" value={fmtCOP(kpis.pOficial)} color="primary" icon={DollarSign} sub={`Entidades: ${totalEntidades}`} />
        <KPICard label="Recaudo Total" value={fmtCOP(kpis.rTotal)} color="info" icon={Banknote} sub="Recursos efectivamente ingresados" />
        <KPICard label="Avance de Recaudo" value={`${kpis.avance.toFixed(1)}%`} color={kpis.avance >= 50 ? "success" : "warning"} icon={BarChart3} sub="Recaudo vs Presupuesto Total" />
        <KPICard label="Presupuesto Corriente" value={fmtCOP(kpis.pCorriente)} color="default" icon={TrendingUp} sub="Presupuesto sin recursos del balance" />
      </div>

      <RecaudoAvanceCharts 
        presupuestoTotal={kpis.pOficial}
        recaudoTotal={kpis.rTotal}
        presupuestoCorriente={kpis.pCorriente}
        recaudoCorriente={kpis.rCorriente}
      />

      {pbcData && (
        <>
          <PBCLineCharts data={pbcData} />
          <PBCBarCharts data={pbcData} />
        </>
      )}

      <div className="charts-grid">
        <div className="panel" id="panel-regalias-historico">
          <div className="panel-header">
            <span className="panel-title">Regalías presupuestadas por bienio (Billones COP)</span>
            <ExportButton targetId="panel-regalias-historico" fileName="Regalias_Historico_Bienios" />
          </div>
          <div className="panel-body">
            {typeof window !== "undefined" && historico.length > 0 && (
              <Chart type="bar" height={380}
                series={[{ 
                  name: "Presupuesto (Billones COP)", 
                  data: historico.map(h => Number((parseNum(h.presupuesto_total) / 1_000_000_000_000).toFixed(1)))
                }]}
                options={{
                  ...chartBase,
                  plotOptions: { 
                    bar: { horizontal: false, borderRadius: 4, columnWidth: "55%", dataLabels: { position: 'top' } } 
                  },
                  xaxis: { 
                    categories: historico.map(h => h.vigencia),
                    labels: { style: { colors: "var(--color-text-muted)", fontWeight: 600 } } 
                  },
                  yaxis: {
                    labels: { formatter: (v: number) => `$${v}B` }
                  },
                  colors: [({ dataPointIndex, w }: any) => {
                    // Si es el último, color aqua claro, si no teal oscuro (como en la imagen del PDF)
                    return dataPointIndex === w.config.series[0].data.length - 1 ? "#84e2c8" : "#009988";
                  }],
                  dataLabels: { 
                    enabled: true, 
                    offsetY: -20,
                    style: { fontSize: "12px", fontWeight: 800, colors: ["#009988"] }, 
                    formatter: (v: number) => `$ ${v.toLocaleString("es-CO")}` 
                  }
                }}
              />
            )}
          </div>
        </div>

        <div className="panel" id="panel-regalias-concepto">
          <div className="panel-header">
            <span className="panel-title">Presupuesto Total por Concepto</span>
            <ExportButton targetId="panel-regalias-concepto" fileName="Presupuesto_Concepto" />
          </div>
          <div className="panel-body">
            {typeof window !== "undefined" && porConcepto.length > 0 && (
              <Chart type="bar" height={380}
                series={[{ name: "Presupuesto (MM)", data: porConcepto.map(([, v]) => Math.round(v / 1_000_000_000)) }]}
                options={{
                  ...chartBase,
                  plotOptions: { 
                    bar: { horizontal: true, borderRadius: 4, barHeight: "80%", dataLabels: { position: 'center' } } 
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
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Detalle: Presupuesto y Recaudo (SICODIS)</span>
          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{filtrados.length} registros detallados</span>
        </div>
        <DataTable
          data={filtrados}
          columns={[
            { key: "region", label: "Región", render: (v) => <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)" }}>{v}</span> },
            { key: "departamento", label: "Departamento", render: (v) => <span style={{ fontWeight: 600 }}>{v}</span> },
            { key: "municipio", label: "Municipio" },
            { key: "entidad", label: "Entidad", render: (v) => <span style={{ fontSize: 11 }}>{v}</span> },
            { key: "proyecto", label: "Concepto de Gasto", width: "200px", render: (v) => <span style={{ fontSize: 11 }}>{v}</span> },
            { key: "presupuesto_total", label: "Presupuesto", align: "right", render: (v) => <span style={{ fontWeight: 700, color: "var(--color-primary)" }}>{fmtCOP(parseNum(v))}</span> },
            { key: "recaudo_total", label: "Recaudo", align: "right", render: (v) => fmtCOP(parseNum(v)) },
            { key: "avance_recaudo_total", label: "Avance %", align: "right", render: (v) => <span style={{ fontWeight: 600, color: parseNum(v) >= 0.5 ? 'var(--color-success)' : 'var(--color-warning)' }}>{(parseNum(v) * 100).toFixed(1)}%</span> },
          ]}
          pageSize={50}
        />
      </div>
    </div>
  );
}


"use client";
import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { 
  FileText, 
  Factory, 
  Map, 
  Building2, 
  Search, 
  X, 
  RotateCcw, 
  RefreshCw, 
  Calendar,
  MapPin
} from "lucide-react";
import Loading from "@/components/Loading";
import { formatNum } from "@/lib/formatters";
import ExportButton from "@/components/ExportButton";
import MultiSelect from "@/components/MultiSelect";
import DataTable from "@/components/DataTable";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface RegistroCP {
  radicado: string;
  proyecto: string;
  sector: string;
  subsector: string;
  empresa: string;
  departamento: string;
  municipio: string;
  comunidad: string;
  tipo_proceso: string;
  estado: string;
  anio_inicio: string;
  anio_radicacion: string;
  protocolizado: string;
}

// ─── Fetch desde proxy local ───────────────────────────────────────────────────
async function cargarCP(): Promise<{ registros: RegistroCP[]; fuente: string; columnas: string[] }> {
  const res = await fetch("/api/consulta-previa");
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return { registros: data.registros ?? [], fuente: data.fuente ?? "", columnas: data.columnas_originales ?? [] };
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
export default function ConsultaPreviaPage() {
  const [filtroSector, setFiltroSector] = useState<string[]>([]);
  const [filtroDpto, setFiltroDpto] = useState<string[]>([]);
  const [filtroEstado, setFiltroEstado] = useState<string[]>([]);
  const [filtroAnio, setFiltroAnio] = useState<string[]>([]);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

  const filtrosActivos = [filtroSector, filtroDpto, filtroEstado, filtroAnio]
    .filter(v => v.length > 0).length;

  const { data, isLoading, error } = useQuery({
    queryKey: ["consulta-previa-mininterior-v2"],
    queryFn: cargarCP,
    staleTime: 24 * 60 * 60 * 1000, // 24h
    retry: 2,
  });

  const registros = data?.registros ?? [];

  // Opciones filtros
  const sectores = useMemo(() => Array.from(new Set(registros.map(r => r.sector))).filter(Boolean).sort(), [registros]);
  const dptos = useMemo(() => Array.from(new Set(registros.map(r => r.departamento))).filter(Boolean).sort(), [registros]);
  const estados = useMemo(() => Array.from(new Set(registros.map(r => r.estado))).filter(Boolean).sort(), [registros]);
  const anios = useMemo(() => {
    const vals = registros.map(r => r.anio_inicio || r.anio_radicacion).filter(Boolean);
    return Array.from(new Set(vals)).sort().reverse();
  }, [registros]);

  const filtrados = useMemo(() => registros.filter(r => {
    if (filtroSector.length > 0 && !filtroSector.includes(r.sector)) return false;
    if (filtroDpto.length > 0 && !filtroDpto.includes(r.departamento)) return false;
    if (filtroEstado.length > 0 && !filtroEstado.includes(r.estado)) return false;
    if (filtroAnio.length > 0) {
      const anio = r.anio_inicio || r.anio_radicacion;
      if (!filtroAnio.includes(anio)) return false;
    }
    return true;
  }), [registros, filtroSector, filtroDpto, filtroEstado, filtroAnio]);

  const kpis = useMemo(() => ({
    total: filtrados.length,
    sectoresUnicos: new Set(filtrados.map(r => r.sector)).size,
    dptosUnicos: new Set(filtrados.map(r => r.departamento)).size,
    empresasUnicas: new Set(filtrados.map(r => r.empresa)).size,
  }), [filtrados]);

  // Por sector
  const porSector = useMemo(() => {
    const acc: Record<string, number> = {};
    filtrados.forEach(r => { if (r.sector) acc[r.sector] = (acc[r.sector] ?? 0) + 1; });
    return Object.entries(acc).sort(([, a], [, b]) => b - a).slice(0, 10);
  }, [filtrados]);

  // Por departamento
  const porDpto = useMemo(() => {
    const acc: Record<string, number> = {};
    filtrados.forEach(r => { if (r.departamento) acc[r.departamento] = (acc[r.departamento] ?? 0) + 1; });
    return Object.entries(acc).sort(([, a], [, b]) => b - a).slice(0, 10);
  }, [filtrados]);

  const chartBase = {
    chart: { background: "transparent", toolbar: { show: false }, fontFamily: "var(--font-main)" },
    theme: { mode: "light" as const },
    grid: { borderColor: "var(--color-border)" },
  };

  // Estilos panel lateral
  const panelStyle: React.CSSProperties = {
    position: "fixed", top: 0, right: 0, bottom: 0, width: 300,
    background: "#ffffff", borderLeft: "1px solid #e2e8f0",
    zIndex: 1001, overflowY: "auto", padding: "24px 20px", color: "#1e293b",
    transform: filtrosAbiertos ? "translateX(0)" : "translateX(100%)",
    transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
    boxShadow: filtrosAbiertos ? "-8px 0 40px rgba(0,0,0,0.20)" : "none",
  };
  const tabStyle: React.CSSProperties = {
    position: "fixed", right: filtrosAbiertos ? 300 : 0, top: "50%",
    transform: "translateY(-50%)", zIndex: 1002,
    background: "#E65100", color: "#fff", fontWeight: 700, fontSize: 12,
    border: "none", cursor: "pointer", padding: "10px 6px",
    borderRadius: "6px 0 0 6px", writingMode: "vertical-rl",
    textOrientation: "mixed", letterSpacing: "0.05em", textTransform: "uppercase",
    transition: "right 0.3s cubic-bezier(0.4,0,0.2,1)",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minHeight: 80,
  };

  if (isLoading) return <Loading message="Sincronizando registros de consulta previa (MinInterior)..." />;

  if (error) return (
    <div className="page-content">
      <div className="page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <FileText size={32} strokeWidth={2.5} style={{ color: "var(--color-warning)" }} />
          Consulta Previa
        </h1>
      </div>
      <div className="panel">
        <div className="panel-body" style={{ textAlign: "center", padding: 48 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <RotateCcw size={40} style={{ color: "var(--color-danger)" }} />
          </div>
          <div style={{ color: "var(--color-danger)", fontWeight: 800 }}>Error al descargar datos</div>
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
        style={{ position: "fixed", right: filtrosAbiertos ? 320 : 0, top: "50%", transform: "translateY(-50%)", zIndex: 1002, background: "var(--color-warning)", color: "#fff", border: "none", cursor: "pointer", padding: "12px 6px", borderRadius: "8px 0 0 8px", writingMode: "vertical-rl", transition: "right 0.3s", fontWeight: 700, display: "flex", gap: "8px", alignItems: "center", minHeight: 120 }} 
        onClick={() => setFiltrosAbiertos(!filtrosAbiertos)}
      >
        {filtrosActivos > 0 && <span style={{ background: "#fff", color: "var(--color-warning)", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, writingMode: "horizontal-tb", marginBottom: 4, fontWeight: 900 }}>{filtrosActivos}</span>}
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
            { label: "Departamento", value: filtroDpto, icon: <Map size={14} />, onChange: setFiltroDpto, options: dptos },
            { label: "Estado", value: filtroEstado, icon: <RefreshCw size={14} />, onChange: setFiltroEstado, options: estados },
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
            onClick={() => { setFiltroSector([]); setFiltroDpto([]); setFiltroEstado([]); setFiltroAnio([]); }}
            style={{ padding: 12, background: "var(--color-bg-elevated)", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, marginTop: 12, fontSize: 13, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <RotateCcw size={14} /> Limpiar Filtros
          </button>
        </div>
      </div>

      <div className="page-header">
        <h1 style={{ color: 'var(--color-warning)', fontWeight: 900 }}>Consulta Previa</h1>
        <p>
          {filtrados.length.toLocaleString("es-CO")} procesos · Fuente: MinInterior DANCP
          {filtrosActivos > 0 && <span style={{ marginLeft: 12, background: 'var(--color-warning)', color: '#fff', padding: '3px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>{filtrosActivos} activos</span>}
        </p>
      </div>

      <div className="kpi-grid">
        <KPICard label="Procesos Totales" value={kpis.total.toLocaleString("es-CO")} color="warning" icon={FileText} />
        <KPICard label="Sectores" value={String(kpis.sectoresUnicos)} color="info" icon={Factory} />
        <KPICard label="Departamentos" value={String(kpis.dptosUnicos)} color="success" icon={Map} />
        <KPICard label="Empresas Titulares" value={String(kpis.empresasUnicas)} color="secondary" icon={Building2} />
      </div>

      <div className="charts-grid">
        <div className="panel" id="panel-cp-sector">
          <div className="panel-header">
            <span className="panel-title">Procesos por Sector</span>
            <ExportButton targetId="panel-cp-sector" fileName="Procesos_Sector_CP" />
          </div>
          <div className="panel-body">
            {typeof window !== "undefined" && porSector.length > 0 && (
              <Chart type="bar" height={380}
                series={[{ name: "Procesos", data: porSector.map(([, v]) => v) }]}
                options={{
                  ...chartBase,
                  plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: "95%", dataLabels: { position: 'center' } } },
                  xaxis: { categories: porSector.map(([s]) => s), labels: { style: { colors: "var(--color-text-muted)" } } },
                  colors: ["#DDA63A"],
                  dataLabels: { 
                    enabled: true, 
                    formatter: (v: number) => formatNum(v),
                    style: { fontSize: "11px", fontWeight: 700 } 
                  },
                }}
              />
            )}
          </div>
        </div>
        <div className="panel" id="panel-cp-dpto">
          <div className="panel-header">
            <span className="panel-title">Procesos por Departamento</span>
            <ExportButton targetId="panel-cp-dpto" fileName="Procesos_Dpto_CP" />
          </div>
          <div className="panel-body">
            {typeof window !== "undefined" && porDpto.length > 0 && (
              <Chart type="bar" height={380}
                series={[{ name: "Procesos", data: porDpto.map(([, v]) => v) }]}
                options={{
                  ...chartBase,
                  plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: "95%", dataLabels: { position: 'center' } } },
                  xaxis: { categories: porDpto.map(([d]) => d), labels: { style: { colors: "var(--color-text-muted)" } } },
                  colors: ["#003745"],
                  dataLabels: { 
                    enabled: true, 
                    formatter: (v: number) => formatNum(v),
                    style: { fontSize: "11px", fontWeight: 700 } 
                  },
                }}
              />
            )}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Detalle: Consulta Previa</span>
          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{filtrados.length} registros</span>
        </div>
        <DataTable
          data={filtrados}
          columns={[
            { key: "radicado", label: "Código", width: "110px", render: (v) => <span style={{ fontFamily: "monospace", fontSize: 11 }}>{v || "—"}</span> },
            { key: "proyecto", label: "Proyecto", render: (v) => <span style={{ fontWeight: 600 }}>{v || "—"}</span> },
            { key: "empresa", label: "Operador" },
            { key: "sector", label: "Sector", render: (v) => <span className="badge info">{v || "—"}</span> },
            { key: "departamento", label: "Departamento" },
            { key: "municipio", label: "Municipio" },
            { key: "estado", label: "Estado", render: (v) => <span className={`badge ${v?.toLowerCase().includes("finalizado") ? "success" : "warning"}`}>{v || "En trámite"}</span> },
          ]}
          pageSize={100}
        />
      </div>
    </div>
  );
}

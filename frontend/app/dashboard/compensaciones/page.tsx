"use client";
import dynamic from "next/dynamic";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Leaf, 
  MapPin, 
  Building2, 
  ClipboardList, 
  FileText, 
  Target, 
  BarChart3, 
  Hourglass, 
  Search, 
  X, 
  RotateCcw, 
  RefreshCw,
  Wind
} from "lucide-react";
import Loading from "@/components/Loading";
import ExportButton from "@/components/ExportButton";
import MultiSelect from "@/components/MultiSelect";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface RegistroComp {
  expediente: string;
  operador: string;
  proyecto: string;
  marco: string;             // Escenario normativo
  areaComp: number;          // Ha comprometidas
  areaEjec: number;          // Ha ejecutadas
  estado: number;            // 0=pendiente, 1=en ejecución, 2=cumplida, etc.
  fechaIni: string;
  valorEcom: number;         // valor ejecutado compensación
  valorAct: number;          // valor comprometido
}

interface RegistroEstudio {
  expediente: string;
  porcSuper: number;         // % avance superficial
  tAaComp: number;           // total Ha comprometidas (estudio)
  tAaCumpl: number;          // total Ha cumplidas (estudio)
  estado: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(v: number, dec = 1) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: dec }).format(v);
}
function fmtPct(v: number) {
  return `${v.toFixed(2)}%`;
}
function safe(v: unknown): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}
function safeStr(v: unknown): string {
  return v != null ? String(v).trim() : "";
}

async function cargarCompensaciones(): Promise<{
  registros: RegistroComp[];
  estudios: RegistroEstudio[];
}> {
  const res = await fetch("/api/anla/compensaciones");
  if (!res.ok) throw new Error(`HTTP ${res.status} al obtener compensaciones`);
  
  const data = await res.json();
  if (data.error) throw new Error(data.error);

  const registrosRaw: Record<string, unknown>[] = data.registros || [];
  const estudiosRaw: Record<string, unknown>[] = data.estudios || [];

  const registros: RegistroComp[] = registrosRaw.map(r => ({
    expediente: safeStr(r["expediente"]),
    operador: safeStr(r["operador"]) || "Sin operador",
    proyecto: safeStr(r["proyecto"]),
    marco: safeStr(r["_marco"]),
    areaComp: safe(r["area_comp"]),
    areaEjec: safe(r["area_ha"]),
    estado: safe(r["estado"]),
    fechaIni: r["fecha_ini"] ? new Date(safe(r["fecha_ini"])).getFullYear().toString() : "",
    valorEcom: safe(r["val_e_com"]),
    valorAct: safe(r["valor_act"]),
  }));

  const estudios: RegistroEstudio[] = estudiosRaw.map(r => ({
    expediente: safeStr(r["expediente"]),
    porcSuper: safe(r["porc_super"]),
    tAaComp: safe(r["t_aa_comp"]),
    tAaCumpl: safe(r["t_aa_cumpl"]),
    estado: safe(r["estado"]),
  }));

  return { registros, estudios };
}

// ─── Componente KPI ───────────────────────────────────────────────────────────
function KPICard({ label, value, unit, color, icon: Icon, sub }: {
  label: string; value: string; unit?: string; color: string; icon: any; sub?: string;
}) {
  return (
    <div className={`kpi-card ${color}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">
        {value}
        {unit && <span className="kpi-unit"> {unit}</span>}
      </div>
      {sub && <div className="kpi-delta" style={{ color: 'inherit', opacity: 0.8 }}>{sub}</div>}
      <span className="kpi-icon"><Icon size={24} strokeWidth={2.5} /></span>
    </div>
  );
}

// ─── Etiqueta estado ──────────────────────────────────────────────────────────
function labelEstado(e: number): string {
  if (e === 1) return "En ejecución";
  if (e === 2) return "Cumplida";
  if (e === 3) return "Incumplida";
  return "Sin estado";
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function CompensacionesPage() {
  // Filtros
  const [filtroMarco, setFiltroMarco] = useState<string[]>([]);
  const [filtroOp, setFiltroOp] = useState<string[]>([]);
  const [filtroEstado, setFiltroEstado] = useState<string[]>([]);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["compensaciones-anla-v3"],
    queryFn: cargarCompensaciones,
    staleTime: 30 * 60 * 1000,
    retry: 2,
  });

  const registros = data?.registros ?? [];
  const estudios = data?.estudios ?? [];

  const marcos = useMemo(() => Array.from(new Set(registros.map(r => r.marco))).sort(), [registros]);
  const operadores = useMemo(() => Array.from(new Set(registros.map(r => r.operador))).filter(Boolean).sort(), [registros]);
  const estados = ["En ejecución", "Cumplida", "Incumplida", "Sin estado"];

  const filtrados = useMemo(() => registros.filter(r => {
    if (filtroMarco.length > 0 && !filtroMarco.includes(r.marco)) return false;
    if (filtroOp.length > 0 && !filtroOp.includes(r.operador)) return false;
    if (filtroEstado.length > 0 && !filtroEstado.includes(labelEstado(r.estado))) return false;
    return true;
  }), [registros, filtroMarco, filtroOp, filtroEstado]);

  const kpis = useMemo(() => {
    const haComp = filtrados.reduce((s, r) => s + r.areaComp, 0);
    const haEjec = filtrados.reduce((s, r) => s + r.areaEjec, 0);
    const haPend = Math.max(0, haComp - haEjec);
    const pctEjecucion = haComp > 0 ? (haEjec / haComp) * 100 : 0;

    const expedientesFiltrados = new Set(filtrados.map(r => r.expediente));
    const estudiosFiltrados = estudios.filter(e => expedientesFiltrados.size === 0 || expedientesFiltrados.has(e.expediente));
    const porSuperArr = estudiosFiltrados.map(e => e.porcSuper).filter(v => !isNaN(v) && v >= 0 && v <= 100);
    const porcPromedio = porSuperArr.length > 0 ? porSuperArr.reduce((s, v) => s + v, 0) / porSuperArr.length : 0;

    const operadoresUnicos = new Set(filtrados.map(r => r.operador)).size;
    const proyectos = new Set(filtrados.map(r => r.expediente)).size;

    return { haComp, haEjec, haPend, pctEjecucion, porcPromedio, operadoresUnicos, proyectos };
  }, [filtrados, estudios]);

  const topOps = useMemo(() => {
    const acc: Record<string, { comp: number; ejec: number }> = {};
    filtrados.forEach(r => {
      if (!acc[r.operador]) acc[r.operador] = { comp: 0, ejec: 0 };
      acc[r.operador].comp += r.areaComp;
      acc[r.operador].ejec += r.areaEjec;
    });
    return Object.entries(acc).sort(([, a], [, b]) => b.comp - a.comp).slice(0, 10);
  }, [filtrados]);

  const porMarco = useMemo(() => {
    const acc: Record<string, { comp: number; ejec: number }> = {};
    filtrados.forEach(r => {
      if (!acc[r.marco]) acc[r.marco] = { comp: 0, ejec: 0 };
      acc[r.marco].comp += r.areaComp;
      acc[r.marco].ejec += r.areaEjec;
    });
    return Object.entries(acc).sort(([a], [b]) => a.localeCompare(b));
  }, [filtrados]);

  const chartBase = {
    chart: { background: "transparent", toolbar: { show: false }, fontFamily: "var(--font-main)" },
    theme: { mode: "light" as const },
    grid: { borderColor: "var(--color-border)" },
  };

  const filtrosActivos = [filtroMarco, filtroOp, filtroEstado].filter(v => v.length > 0).length;

  if (isLoading) return <Loading message="Sincronizando compensaciones bióticas locales (ANLA)..." />;

  if (error) return (
    <div className="page-content">
      <div className="page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Leaf size={32} strokeWidth={2.5} style={{ color: "var(--color-emphasis)" }} />
          Compensaciones Ambientales
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
        style={{ position: "fixed", right: filtrosAbiertos ? 320 : 0, top: "50%", transform: "translateY(-50%)", zIndex: 1002, background: "var(--color-emphasis)", color: "#fff", border: "none", cursor: "pointer", padding: "12px 6px", borderRadius: "8px 0 0 8px", writingMode: "vertical-rl", transition: "right 0.3s", fontWeight: 700, display: "flex", gap: "8px", alignItems: "center", minHeight: 120 }} 
        onClick={() => setFiltrosAbiertos(!filtrosAbiertos)}
      >
        {filtrosActivos > 0 && <span style={{ background: "#fff", color: "var(--color-emphasis)", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, writingMode: "horizontal-tb", marginBottom: 4, fontWeight: 900 }}>{filtrosActivos}</span>}
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {filtrosAbiertos ? <X size={18} /> : <Search size={18} />}
          {filtrosAbiertos ? " CERRAR" : " FILTRAR"}
        </span>
      </button>

      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 320, background: "#fff", zIndex: 1001, padding: "24px", transform: filtrosAbiertos ? "translateX(0)" : "translateX(100%)", transition: "transform 0.3s", boxShadow: "-8px 0 30px rgba(0,0,0,0.15)", overflowY: "auto" }}>
        <h3 style={{ marginBottom: 24, fontSize: '1.2rem', fontWeight: 900, color: 'var(--color-secondary)' }}>Filtros</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[
            { label: "Marco Normativo", value: filtroMarco, icon: <ClipboardList size={14} />, onChange: setFiltroMarco, options: marcos },
            { label: "Operador", value: filtroOp, icon: <Building2 size={14} />, onChange: setFiltroOp, options: operadores },
            { label: "Estado", value: filtroEstado, icon: <RefreshCw size={14} />, onChange: setFiltroEstado, options: estados },
          ].map(f => (
            <div key={f.label}>
              <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {f.icon} {f.label}
              </label>
              <MultiSelect options={f.options} selected={f.value} onChange={f.onChange} />
            </div>
          ))}
          <button 
            onClick={() => { setFiltroMarco([]); setFiltroOp([]); setFiltroEstado([]); }} 
            style={{ padding: 12, background: "var(--color-bg-elevated)", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, marginTop: 12, fontSize: 13, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <RotateCcw size={14} /> Limpiar Filtros
          </button>
        </div>
      </div>

      <div className="page-header">
        <h1 style={{ color: 'var(--color-emphasis)', fontWeight: 900 }}>Compensaciones Ambientales</h1>
        <p>
          {filtrados.length.toLocaleString("es-CO")} polígonos · Fuente: ANLA ANB (Público)
          {filtrosActivos > 0 && <span style={{ marginLeft: 12, background: 'var(--color-emphasis)', color: '#fff', padding: '3px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>{filtrosActivos} activos</span>}
        </p>
      </div>

      <div className="kpi-grid">
        <KPICard label="Ha. Pendientes" value={fmt(kpis.haPend)} unit="Ha" color="danger" icon={Hourglass} sub={`Comprometidas: ${fmt(kpis.haComp)} Ha`} />
        <KPICard label="Total Ha. Ejecutadas" value={fmt(kpis.haEjec)} unit="Ha" color="success" icon={Leaf} />
        <KPICard label="Promedio % Avance" value={fmtPct(kpis.porcPromedio)} color="primary" icon={BarChart3} sub={`${estudios.length.toLocaleString("es-CO")} estudios`} />
        <KPICard label="% Avance Ejecución" value={fmtPct(kpis.pctEjecucion)} color="info" icon={Target} sub={`${kpis.operadoresUnicos} operadores`} />
      </div>

      <div className="panel" id="panel-comp-ejecucion" style={{ marginBottom: 24 }}>
        <div className="panel-header">
          <span className="panel-title">Estado de Ejecución de Compensaciones</span>
          <ExportButton targetId="panel-comp-ejecucion" fileName="Ejecucion_Compensaciones" />
        </div>
        <div className="panel-body" style={{ display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap", justifyContent: "center" }}>
          {typeof window !== "undefined" && (
            <Chart key={`gauge-${kpis.pctEjecucion}`} type="radialBar" height={280} series={[parseFloat(kpis.pctEjecucion.toFixed(1))]}
              options={{
                ...chartBase,
                plotOptions: {
                  radialBar: {
                    hollow: { size: "65%" },
                    dataLabels: {
                      name: { show: false },
                      value: { fontSize: "32px", fontWeight: 900, color: "var(--color-emphasis)", formatter: (v: number) => `${v}%` }
                    }
                  }
                },
                colors: ["var(--color-emphasis)"]
              }}
            />
          )}
          <div style={{ flex: 1, minWidth: 280 }}>
            {[
              { label: "Ha. Comprometidas", val: kpis.haComp, color: "var(--color-secondary)", icon: <ClipboardList size={14} /> },
              { label: "Ha. Ejecutadas", val: kpis.haEjec, color: "var(--color-emphasis)", icon: <Leaf size={14} /> },
              { label: "Ha. Pendientes", val: kpis.haPend, color: "var(--color-danger)", icon: <Hourglass size={14} /> },
            ].map(item => (
              <div key={item.label} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {item.icon} {item.label}
                  </span>
                  <span style={{ fontWeight: 800, color: item.color }}>{fmt(item.val)} Ha</span>
                </div>
                <div className="progress-bar-bg" style={{ height: 6, width: "100%", background: "var(--color-border)", borderRadius: 10 }}>
                  <div style={{ width: `${Math.min(100, (item.val / kpis.haComp) * 100)}%`, height: "100%", background: item.color, borderRadius: 10 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="panel" id="panel-comp-top-ops">
          <div className="panel-header">
            <span className="panel-title">Top 10 Operadores (Ha)</span>
            <ExportButton targetId="panel-comp-top-ops" fileName="Top_Operadores_Compensaciones" />
          </div>
          <div className="panel-body">
            {typeof window !== "undefined" && topOps.length > 0 && (
              <Chart key={topOps.map(([op]) => op).join(",")} type="bar" height={380}
                series={[
                  { name: "Comprometidas", data: topOps.map(([, v]) => parseFloat(v.comp.toFixed(1))) },
                  { name: "Ejecutadas", data: topOps.map(([, v]) => parseFloat(v.ejec.toFixed(1))) }
                ]}
                options={{
                  ...chartBase,
                  plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: "95%", dataLabels: { position: 'center' } } },
                  xaxis: { categories: topOps.map(([op]) => op), labels: { style: { colors: "var(--color-text-muted)" } } },
                  colors: ["#003745", "#008054"],
                  dataLabels: { enabled: true, style: { fontSize: "11px", fontWeight: 700 } }
                }}
              />
            )}
          </div>
        </div>
        <div className="panel" id="panel-comp-dist">
          <div className="panel-header">
            <span className="panel-title">Distribución de Proyectos por % Avance</span>
            <ExportButton targetId="panel-comp-dist" fileName="Distribucion_Avance_Compensaciones" />
          </div>
          <div className="panel-body">
            {typeof window !== "undefined" && studiesDistribution(estudios, filtrados) && (
              <Chart type="bar" height={380} series={[{ name: "Proyectos", data: studiesDistribution(estudios, filtrados).counts }]}
                options={{
                  ...chartBase,
                  xaxis: { categories: studiesDistribution(estudios, filtrados).labels, labels: { style: { colors: "var(--color-text-muted)" } } },
                  colors: ["#D44D03"],
                  plotOptions: { bar: { borderRadius: 4, columnWidth: "80%" } },
                  dataLabels: { enabled: true, style: { fontSize: "11px", fontWeight: 700 } }
                }}
              />
            )}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Detalle: Compensaciones Ambientales</span>
          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{filtrados.length} registros</span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Expediente</th>
                <th>Operador</th>
                <th>Marco</th>
                <th>Estado</th>
                <th style={{ textAlign: "right" }}>Ha. Comp.</th>
                <th style={{ textAlign: "right" }}>Ha. Ejec.</th>
                <th style={{ textAlign: "right" }}>%</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.slice(0, 100).map((r, i) => {
                const pct = r.areaComp > 0 ? (r.areaEjec / r.areaComp) * 100 : 0;
                return (
                  <tr key={i}>
                    <td data-label="Expediente" className="font-mono" style={{ fontSize: 11 }}>{r.expediente || "—"}</td>
                    <td data-label="Operador">{r.operador}</td>
                    <td data-label="Marco"><span className="badge info">{r.marco}</span></td>
                    <td data-label="Estado">
                      <span className={`badge ${r.estado === 2 ? "success" : r.estado === 3 ? "danger" : "warning"}`}>
                        {labelEstado(r.estado)}
                      </span>
                    </td>
                    <td data-label="Ha. Comp." style={{ textAlign: "right" }}>{fmt(r.areaComp)}</td>
                    <td data-label="Ha. Ejec." style={{ textAlign: "right", fontWeight: 700, color: "var(--color-emphasis)" }}>{fmt(r.areaEjec)}</td>
                    <td data-label="%" style={{ textAlign: "right", fontWeight: 900 }}>{pct.toFixed(0)}%</td>
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

// Helper para gráfico de distribución
function studiesDistribution(estudios: RegistroEstudio[], filtrados: RegistroComp[]) {
  const bins = [
    { label: "0–20%", min: 0, max: 20 },
    { label: "20–40%", min: 20, max: 40 },
    { label: "40–60%", min: 40, max: 60 },
    { label: "60–80%", min: 60, max: 80 },
    { label: "80–100%", min: 80, max: 101 },
  ];
  const exps = new Set(filtrados.map(r => r.expediente));
  const estFiltrados = exps.size === 0 ? estudios : estudios.filter(e => exps.has(e.expediente));
  const counts = bins.map(b => estFiltrados.filter(e => e.porcSuper >= b.min && e.porcSuper < b.max).length);
  return { labels: bins.map(b => b.label), counts };
}

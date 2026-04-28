"use client";
import { useMsal } from "@azure/msal-react";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useState, useMemo } from "react";
import { fetchExcelXLSX, SHAREPOINT_FILES } from "@/lib/graphClient";
import { normalizarOperadora, normalizarDepartamento, normalizarMunicipio } from "@/lib/normalizacion";
import { 
  Building2, 
  MapPin, 
  Search, 
  X, 
  RotateCcw, 
  Calendar, 
  Home, 
  HardHat, 
  Globe, 
  Plane 
} from "lucide-react";
import Loading from "@/components/Loading";
import { formatNum, formatAbbr, formatCurrency } from "@/lib/formatters";
import ExportButton from "@/components/ExportButton";
import MultiSelect from "@/components/MultiSelect";
import DataTable from "@/components/DataTable";

interface RegistroEmpleo {
  Empresa: string;
  Departamento: string;
  Municipio: string;
  EmpleoLocal: number;
  EmpleoNacional: number;
  EmpleoForaneo: number;
  Anio: string;
}

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

function fmtNum(v: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(v);
}

import axios from "axios";

async function cargarEmpleo(): Promise<RegistroEmpleo[]> {
  const response = await axios.get("/api/social-impact");
  const data = response.data;
  
  return data.empleo.map((r: any) => ({
    Empresa: normalizarOperadora(r.empresa_raw),
    Departamento: normalizarDepartamento(r.departamento_raw),
    Municipio: normalizarMunicipio(r.municipio_raw),
    EmpleoLocal: r.origen_contratacion === 'Local' ? Number(r.num_empleos || 0) : 0,
    EmpleoNacional: r.origen_contratacion === 'No Local' ? Number(r.num_empleos || 0) : 0,
    EmpleoForaneo: 0,
    Anio: String(r.anio || ""),
  }));
}

function KPICard({ label, value, unit, color, icon: Icon }: { label: string; value: string; unit?: string; color: string; icon: any }) {
  return (
    <div className={`kpi-card ${color}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}{unit && <span className="kpi-unit">{unit}</span>}</div>
      <span className="kpi-icon"><Icon size={24} strokeWidth={2.5} /></span>
    </div>
  );
}

export default function EmpleoPage() {
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [filtroOp, setFiltroOp] = useState<string[]>([]);
  const [filtroDpto, setFiltroDpto] = useState<string[]>([]);
  const [filtroMpio, setFiltroMpio] = useState<string[]>([]);
  const [filtroAnio, setFiltroAnio] = useState<string[]>([]);

  const { data: registros = [], isLoading, error } = useQuery({
    queryKey: ["empleo"],
    queryFn: cargarEmpleo,
    staleTime: 10 * 60 * 1000,
  });

  const empresas = useMemo(() => Array.from(new Set(registros.map(r => r.Empresa))).sort(), [registros]);
  const departamentos = useMemo(() => Array.from(new Set(registros.map(r => r.Departamento))).sort(), [registros]);
  const municipios = useMemo(() => Array.from(new Set(registros.map(r => r.Municipio))).sort(), [registros]);
  const anios = useMemo(() => Array.from(new Set(registros.map(r => r.Anio).filter(Boolean))).sort().reverse(), [registros]);

  const filtrados = useMemo(() => registros.filter(r => {
    if (filtroOp.length > 0 && !filtroOp.includes(r.Empresa)) return false;
    if (filtroDpto.length > 0 && !filtroDpto.includes(r.Departamento)) return false;
    if (filtroMpio.length > 0 && !filtroMpio.includes(r.Municipio)) return false;
    if (filtroAnio.length > 0 && !filtroAnio.includes(r.Anio)) return false;
    return true;
  }), [registros, filtroOp, filtroDpto, filtroMpio, filtroAnio]);

  const kpis = useMemo(() => ({
    local: filtrados.reduce((s, r) => s + r.EmpleoLocal, 0),
    nacional: filtrados.reduce((s, r) => s + r.EmpleoNacional, 0),
    foraneo: filtrados.reduce((s, r) => s + r.EmpleoForaneo, 0),
    empresas: new Set(filtrados.map(r => r.Empresa)).size,
  }), [filtrados]);

  const topEmpresas = useMemo(() => {
    const acc: Record<string, { l: number; n: number; f: number }> = {};
    filtrados.forEach(r => {
      if (!acc[r.Empresa]) acc[r.Empresa] = { l: 0, n: 0, f: 0 };
      acc[r.Empresa].l += r.EmpleoLocal;
      acc[r.Empresa].n += r.EmpleoNacional;
      acc[r.Empresa].f += r.EmpleoForaneo;
    });
    return Object.entries(acc).sort(([, a], [, b]) => (b.l + b.n + b.f) - (a.l + a.n + a.f)).slice(0, 10);
  }, [filtrados]);

  const chartBase = {
    chart: { background: "transparent", toolbar: { show: false }, fontFamily: "var(--font-main)" },
    theme: { mode: "light" as const },
    grid: { borderColor: "var(--color-border)" },
  };

  const total = kpis.local + kpis.nacional + kpis.foraneo;
  const filtrosActivos = [filtroAnio, filtroOp, filtroDpto, filtroMpio].filter(v => v.length > 0).length;

  if (isLoading) return <Loading message="Cargando datos de empleo y capital humano..." />;

  if (error) return (
    <div className="page-content">
      <div className="page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <HardHat size={32} strokeWidth={2.5} style={{ color: "var(--color-emphasis)" }} />
          Empleo – Capital Humano
        </h1>
      </div>
      <div className="panel">
        <div className="panel-body" style={{ textAlign: "center", padding: 48 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <RotateCcw size={40} style={{ color: "var(--color-danger)" }} />
          </div>
          <div style={{ color: "var(--color-danger)", fontWeight: 700, marginBottom: 8 }}>Error al cargar datos</div>
          <div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>{String(error)}</div>
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
            { label: "Año", value: filtroAnio, icon: <Calendar size={14} />, onChange: setFiltroAnio, options: anios },
            { label: "Empresa", value: filtroOp, icon: <Building2 size={14} />, onChange: setFiltroOp, options: empresas },
            { label: "Departamento", value: filtroDpto, icon: <MapPin size={14} />, onChange: setFiltroDpto, options: departamentos },
            { label: "Municipio", value: filtroMpio, icon: <Home size={14} />, onChange: setFiltroMpio, options: municipios },
          ].map(f => (
            <div key={f.label}>
              <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {f.icon} {f.label}
              </label>
              <MultiSelect options={f.options} selected={f.value} onChange={f.onChange} />
            </div>
          ))}
          <button 
            onClick={() => { setFiltroAnio([]); setFiltroOp([]); setFiltroDpto([]); setFiltroMpio([]); }} 
            style={{ padding: 12, background: "var(--color-bg-elevated)", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, marginTop: 12, fontSize: 13, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <RotateCcw size={14} /> Limpiar Filtros
          </button>
        </div>
      </div>

      <div className="page-header">
        <h1 style={{ color: 'var(--color-emphasis)', fontWeight: 900 }}>Empleo – Capital Humano</h1>
        <p>
          {filtrados.length.toLocaleString("es-CO")} registros · Fuente: PostgreSQL
          {filtrosActivos > 0 && <span style={{ marginLeft: 12, background: 'var(--color-emphasis)', color: '#fff', padding: '3px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>{filtrosActivos} filtrados</span>}
        </p>
      </div>

      <div className="kpi-grid">
        <KPICard label="Total Empleos" value={fmtNum(total)} color="success" icon={HardHat} />
        <KPICard label="Empleo Local" value={fmtNum(kpis.local)} color="primary" icon={Home} />
        <KPICard label="Empleo Nacional" value={fmtNum(kpis.nacional)} color="info" icon={Globe} />
        <KPICard label="% Empleo Local" value={total > 0 ? (kpis.local / total * 100).toFixed(1) : "0"} unit="%" color="secondary" icon={MapPin} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px', marginBottom: '24px' }}>
        {/* Donut distribución */}
        <div className="panel" id="panel-empleo-origen">
          <div className="panel-header">
            <span className="panel-title">Distribución por Origen</span>
            <ExportButton targetId="panel-empleo-origen" fileName="Distribucion_Origen" />
          </div>
          <div className="panel-body" style={{ height: '380px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {typeof window !== "undefined" && total > 0 && (
              <Chart
                type="donut"
                height="100%"
                series={[kpis.local, kpis.nacional, kpis.foraneo]}
                options={{
                  ...chartBase,
                  labels: ["Local", "Nacional", "Foráneo"],
                  colors: ["#008054", "#0277BD", "#D44D03"],
                  legend: { position: "bottom", fontFamily: "var(--font-main)" },
                  dataLabels: { enabled: true, formatter: (v: number) => `${v.toFixed(1)}%` },
                  tooltip: { theme: "light", y: { formatter: (v: number) => fmtNum(v) + " empleos" } },
                }}
              />
            )}
          </div>
        </div>

        {/* Top empresas */}
        <div className="panel" id="panel-empleo-top">
          <div className="panel-header">
            <span className="panel-title">Top Empresas – Generación de Empleo</span>
            <ExportButton targetId="panel-empleo-top" fileName="Top_Empresas_Empleo" />
          </div>
          <div className="panel-body">
            {typeof window !== "undefined" && topEmpresas.length > 0 && (
              <Chart
                type="bar"
                height={380}
                series={[
                  { name: "Local", data: topEmpresas.map(([, v]) => v.l) },
                  { name: "Nacional", data: topEmpresas.map(([, v]) => v.n) },
                ]}
                options={{
                  ...chartBase,
                  chart: { ...chartBase.chart, stacked: true },
                  plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: "95%", dataLabels: { position: 'center' } } },
                  xaxis: {
                    categories: topEmpresas.map(([e]) => e),
                    labels: { style: { colors: "var(--color-text-muted)", fontSize: "11px" } },
                  },
                  yaxis: { labels: { style: { colors: "var(--color-text-muted)", fontSize: "11px" } } },
                  colors: ["#008054", "#0277BD"],
                  legend: { position: "top", horizontalAlign: "left", fontFamily: "var(--font-main)" },
                  dataLabels: { 
                    enabled: true, 
                    formatter: (v: number) => fmtNum(v),
                    style: { fontSize: '11px', fontWeight: 700 }
                  },
                  tooltip: { theme: "light", y: { formatter: (v: number) => fmtNum(v) + " empleos" } },
                }}
              />
            )}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Detalle: Empleo</span>
          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{filtrados.length} registros</span>
        </div>
        <DataTable
          data={filtrados}
          columns={[
            { key: "Anio", label: "Año", width: "80px", render: (v) => <span style={{ opacity: 0.7, fontWeight: 700 }}>{v}</span> },
            { key: "Empresa", label: "Empresa", render: (v) => <span style={{ fontWeight: 700, color: "var(--color-secondary)" }}>{v}</span> },
            { key: "Departamento", label: "Departamento" },
            { key: "Municipio", label: "Municipio" },
            { key: "EmpleoLocal", label: "Local", align: "right", render: (v) => <span style={{ color: "var(--color-emphasis)", fontWeight: 700 }}>{fmtNum(v)}</span> },
            { key: "EmpleoNacional", label: "Nacional", align: "right", render: (v) => <span style={{ color: "var(--color-info)", fontWeight: 600 }}>{fmtNum(v)}</span> },
            { key: "EmpleoLocal", label: "Total", align: "right", sortable: false, filterable: false, render: (_v, row) => <span style={{ fontWeight: 800, color: "var(--color-text-primary)" }}>{fmtNum(row.EmpleoLocal + row.EmpleoNacional)}</span> },
          ]}
          pageSize={100}
        />
      </div>
    </div>
  );
}

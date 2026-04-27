"use client";
import { useMsal } from "@azure/msal-react";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useState, useMemo } from "react";
import { fetchExcelXLSX, SHAREPOINT_FILES } from "@/lib/graphClient";
import { normalizarOperadora, normalizarDepartamento, normalizarMunicipio } from "@/lib/normalizacion";
import { 
  Building2, 
  Map, 
  MapPin, 
  Search, 
  X, 
  RotateCcw, 
  Calendar, 
  Home, 
  HardHat, 
  Package, 
  DollarSign 
} from "lucide-react";
import Loading from "@/components/Loading";
import { formatNum, formatCurrency } from "@/lib/formatters";
import ExportButton from "@/components/ExportButton";
import MultiSelect from "@/components/MultiSelect";

// Cifras Sociales – hoja BYS (Bienes y Servicios)
interface RegistroBYS {
  Empresa: string;
  Departamento: string;
  Municipio: string;
  ComprasDirectas: number;
  ComprasIndirectas: number;
  Anio: string;
}

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

// Eliminamos fmtCOP local en favor de lib/formatters

import axios from "axios";

async function cargarBYS() {
  const { data } = await axios.get("/api/stats/dashboard?type=bienes-servicios");
  return data;
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

export default function ContratacionPage() {
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [filtroAnio, setFiltroAnio] = useState<string[]>([]);
  const [filtroOp, setFiltroOp] = useState<string[]>([]);
  const [filtroDpto, setFiltroDpto] = useState<string[]>([]);
  const [filtroMun, setFiltroMun] = useState<string[]>([]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["bienes-servicios-stats", filtroAnio, filtroOp, filtroDpto, filtroMun],
    queryFn: () => axios.get(`/api/stats/dashboard?type=bienes-servicios&anio=${filtroAnio}&empresa=${filtroOp}&departamento=${filtroDpto}&municipio=${filtroMun}`).then(res => res.data),
    staleTime: 5 * 60 * 1000,
  });

  const anios = ["Todos", ...(data?.filters?.anios || [])];
  const empresas = ["Todas", ...(data?.filters?.empresas || [])];
  const departamentos = ["Todos", ...(data?.filters?.departamentos || [])];
  const municipios = ["Todos", ...(data?.filters?.municipios || [])];

  const filtrosActivos = [filtroAnio, filtroOp, filtroDpto, filtroMun].filter(v => v.length > 0).length;

  if (isLoading) return <Loading message="Cargando analítica de contratación..." />;

  if (error || !data || !data.summary) return (
    <div className="page-content">
      <div className="page-header"><h1><Package size={32} /> Bienes y Servicios</h1></div>
      <div className="panel" style={{padding:48, textAlign:'center'}}>
        <div style={{fontSize:40}}>⚠️</div>
        <p style={{color:'var(--color-danger)', fontWeight:700}}>{error ? String(error) : "No se recibieron datos del servidor"}</p>
        <button onClick={() => window.location.reload()} style={{marginTop:16, padding:'8px 16px', borderRadius:8, border:'none', background:'var(--color-primary)', color:'#fff', cursor:'pointer'}}>Reintentar</button>
      </div>
    </div>
  );

  const kpis = {
    total: data.summary.reduce((s: any, r: any) => s + Number(r.total_valor), 0),
    registros: data.summary.reduce((s: any, r: any) => s + Number(r.num_registros), 0),
    empresas: Math.max(...data.summary.map((r: any) => Number(r.num_empresas)), 0),
    municipios: Math.max(...data.summary.map((r: any) => Number(r.num_municipios)), 0),
  };

  const chartBase = {
    chart: { background: "transparent", toolbar: { show: false }, fontFamily: "var(--font-main)" },
    theme: { mode: "light" as const },
    grid: { borderColor: "var(--color-border)" },
  };

  const topDepts = data?.by_department || [];
  const stages = data?.by_etapa || [];

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
        <h3 style={{ marginBottom: 24, fontSize: '1.2rem', fontWeight: 900, color: 'var(--color-secondary)' }}>Filtros Avanzados</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[
            { label: "Año de Contratación", value: filtroAnio, icon: <Calendar size={14} />, onChange: setFiltroAnio, options: anios },
            { label: "Empresa Operadora", value: filtroOp, icon: <Building2 size={14} />, onChange: (v: string[]) => { setFiltroOp(v); setFiltroDpto([]); setFiltroMun([]); }, options: empresas },
            { label: "Departamento", value: filtroDpto, icon: <MapPin size={14} />, onChange: (v: string[]) => { setFiltroDpto(v); setFiltroMun([]); }, options: departamentos },
            { label: "Municipio", value: filtroMun, icon: <Map size={14} />, onChange: setFiltroMun, options: municipios },
          ].map(f => (
            <div key={f.label}>
              <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {f.icon} {f.label}
              </label>
              <MultiSelect options={f.options} selected={f.value} onChange={f.onChange} />
            </div>
          ))}
          <button 
            onClick={() => { setFiltroAnio([]); setFiltroOp([]); setFiltroDpto([]); setFiltroMun([]); }} 
            style={{ padding: 12, background: "var(--color-bg-elevated)", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, marginTop: 12, fontSize: 13, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <RotateCcw size={14} /> Restaurar Vista
          </button>
        </div>
      </div>

      <div className="page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 900 }}>
          <Package size={32} strokeWidth={2.5} style={{ color: "var(--color-primary)" }} />
          Bienes y Servicios (Contratación)
        </h1>
        <p>
          Impacto económico de la cadena de suministro en el sector Energía.
          {filtrosActivos > 0 && <span style={{ marginLeft: 12, background: 'var(--color-primary)', color: '#fff', padding: '3px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700 }}>{filtrosActivos} FILTROS ACTIVOS</span>}
        </p>
      </div>

      <div className="kpi-grid">
        <KPICard label="Total Contratado" value={formatCurrency(kpis.total, true)} color="success" icon={DollarSign} />
        <KPICard label="Registros Procesados" value={formatNum(kpis.registros)} color="info" icon={Package} />
        <KPICard label="Empresas Operadoras" value={formatNum(kpis.empresas)} color="primary" icon={Building2} />
        <KPICard label="Municipios Impactados" value={formatNum(kpis.municipios)} color="danger" icon={Map} />
      </div>

      <div className="grid-2">
        <div className="panel" id="panel-contrato-dpto">
          <div className="panel-header">
            <span className="panel-title">Inversión por Departamento (Top 10)</span>
            <ExportButton targetId="panel-contrato-dpto" fileName="Inversion_Dpto_Contratacion" />
          </div>
          <div className="panel-body">
            {typeof window !== "undefined" && topDepts.length > 0 ? (
              <Chart
                type="bar"
                height={380}
                series={[{ name: "Inversión", data: topDepts.map((d: any) => Math.round(Number(d.valor))) }]}
                options={{
                  ...chartBase,
                  plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: "95%", dataLabels: { position: 'center' } } },
                  xaxis: {
                    categories: topDepts.map((d: any) => d.departamento),
                    labels: { style: { colors: "var(--color-text-muted)", fontSize: "11px" }, formatter: (v: string) => formatCurrency(Number(v), true) },
                  },
                  dataLabels: { 
                    enabled: true, 
                    formatter: (v: number) => formatCurrency(v, true),
                    style: { fontSize: '11px', fontWeight: 700 }
                  },
                  colors: ["#D44D03"],
                  tooltip: { theme: "light", y: { formatter: (v: number) => formatCurrency(v, false) } },
                }}
              />
            ) : <div style={{height:380, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--color-text-muted)'}}>Sin datos para esta selección</div>}
          </div>
        </div>

        <div className="panel" id="panel-contrato-etapa">
          <div className="panel-header">
            <span className="panel-title">Inversión por Etapa del Proyecto</span>
            <ExportButton targetId="panel-contrato-etapa" fileName="Inversion_Etapa_Contratacion" />
          </div>
          <div className="panel-body" style={{ display: 'flex', justifyContent: 'center', minHeight: 400 }}>
            {typeof window !== "undefined" && stages.length > 0 ? (
              <Chart
                type="donut"
                height={380}
                series={stages.map((s: any) => Math.round(Number(s.valor)))}
                options={{
                  ...chartBase,
                  labels: stages.map((s: any) => s.etapa),
                  colors: ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f43f5e"],
                  legend: { 
                    position: "bottom",
                    fontSize: '11px',
                    offsetY: 0,
                    itemMargin: { horizontal: 10, vertical: 5 }
                  },
                  dataLabels: {
                    enabled: false
                  },
                  plotOptions: {
                    pie: {
                      donut: {
                        size: '65%',
                        labels: {
                          show: true,
                          total: {
                            show: true,
                            label: 'Total',
                            formatter: () => formatCurrency(kpis.total, true),
                            fontSize: '14px',
                            fontWeight: 900,
                            color: 'var(--color-primary)'
                          }
                        }
                      }
                    }
                  },
                  tooltip: { theme: "light", y: { formatter: (v: number) => formatCurrency(v, false) } },
                }}
              />
            ) : <div style={{height:380, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--color-text-muted)'}}>Sin datos para esta selección</div>}
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 24 }}>
        <div className="panel" id="panel-contrato-op-dpto">
          <div className="panel-header">
            <span className="panel-title">Inversión por Operadora y Departamento</span>
            <ExportButton targetId="panel-contrato-op-dpto" fileName="Inversion_Op_Dpto_Contratacion" />
          </div>
          <div className="panel-body">
            {typeof window !== "undefined" && data?.by_company_dept && (
              <Chart
                type="bar"
                height={380}
                series={(() => {
                  const companies = Array.from(new Set(data.by_company_dept.map((r: any) => r.empresa))).slice(0, 8);
                  const departs = Array.from(new Set(data.by_company_dept.map((r: any) => r.departamento))).slice(0, 6);
                  return departs.map(dept => ({
                    name: dept as string,
                    data: companies.map(comp => {
                      const entry = (data.by_company_dept as any[]).find(r => r.empresa === comp && r.departamento === dept);
                      return entry ? Math.round(Number(entry.valor)) : 0;
                    })
                  }));
                })()}
                options={{
                  ...chartBase,
                  chart: { ...chartBase.chart, stacked: true },
                  plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '70%' } },
                  xaxis: { 
                    categories: Array.from(new Set(data.by_company_dept.map((r: any) => r.empresa))).slice(0, 8),
                    labels: { style: { fontSize: '9px' }, formatter: (v: number) => formatCurrency(v, true) }
                  },
                  yaxis: { labels: { style: { fontSize: '10px' } } },
                  legend: { position: 'bottom', horizontalAlign: 'center', fontSize: '10px' },
                  dataLabels: { enabled: false },
                  colors: ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"],
                  tooltip: { theme: "light", y: { formatter: (v: number) => formatCurrency(v, false) } }
                }}
              />
            )}
          </div>
        </div>

        <div className="panel" id="panel-contrato-op-mun">
          <div className="panel-header">
            <span className="panel-title">Inversión por Operadora y Municipio</span>
            <ExportButton targetId="panel-contrato-op-mun" fileName="Inversion_Op_Mun_Contratacion" />
          </div>
          <div className="panel-body">
            {typeof window !== "undefined" && data?.by_company_mun && (
              <Chart
                type="bar"
                height={380}
                series={(() => {
                  const companies = Array.from(new Set(data.by_company_mun.map((r: any) => r.empresa))).slice(0, 8);
                  const muns = Array.from(new Set(data.by_company_mun.map((r: any) => r.municipio))).slice(0, 6);
                  return muns.map(mun => ({
                    name: mun as string,
                    data: companies.map(comp => {
                      const entry = (data.by_company_mun as any[]).find(r => r.empresa === comp && r.municipio === mun);
                      return entry ? Math.round(Number(entry.valor)) : 0;
                    })
                  }));
                })()}
                options={{
                  ...chartBase,
                  chart: { ...chartBase.chart, stacked: true },
                  plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '70%' } },
                  xaxis: { 
                    categories: Array.from(new Set(data.by_company_mun.map((r: any) => r.empresa))).slice(0, 8),
                    labels: { style: { fontSize: '9px' }, formatter: (v: number) => formatCurrency(v, true) }
                  },
                  yaxis: { labels: { style: { fontSize: '10px' } } },
                  legend: { position: 'bottom', horizontalAlign: 'center', fontSize: '10px' },
                  dataLabels: { enabled: false },
                  colors: ["#8b5cf6", "#ec4899", "#06b6d4", "#f43f5e", "#10b981", "#6366f1"],
                  tooltip: { theme: "light", y: { formatter: (v: number) => formatCurrency(v, false) } }
                }}
              />
            )}
          </div>
        </div>
      </div>

      <div className="panel" id="panel-contrato-hist" style={{ marginTop: 24 }}>
        <div className="panel-header">
          <span className="panel-title">Histórico de Inversión Anual</span>
          <ExportButton targetId="panel-contrato-hist" fileName="Historico_Inversion_Contratacion" />
        </div>
        <div className="panel-body">
          {typeof window !== "undefined" && data.summary.length > 0 && (
            <Chart
              type="area"
              height={380}
              series={[{ name: "Inversión Total", data: data.summary.map((s: any) => Math.round(Number(s.total_valor))) }]}
              options={{
                ...chartBase,
                stroke: { curve: 'smooth', width: 3 },
                xaxis: { categories: data.summary.map((s: any) => s.anio) },
                yaxis: { labels: { formatter: (v: number) => formatCurrency(v, true) } },
                dataLabels: { enabled: false },
                colors: ["#D44D03"],
                fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.7, opacityTo: 0.2 } },
                tooltip: { theme: "light", y: { formatter: (v: number) => formatCurrency(v, false) } }
              }}
            />
          )}
        </div>
      </div>
      
      <style jsx>{`
        .loading-state, .error-state { padding: 48px; text-align: center; }
        .grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 24px; margin-top: 24px; }
      `}</style>
    </div>
  );
}

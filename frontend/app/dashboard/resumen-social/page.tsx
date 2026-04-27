"use client";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useState, useMemo } from "react";
import { normalizarRegistro } from "@/lib/normalizacion";
import axios from "axios";
import { 
  DollarSign, 
  Home, 
  HardHat, 
  Users, 
  Search, 
  X, 
  RotateCcw, 
  Calendar, 
  Building2, 
  MapPin 
} from "lucide-react";
import Loading from "@/components/Loading";
import ExportButton from "@/components/ExportButton";
import MultiSelect from "@/components/MultiSelect";

// Cargamos ApexCharts dinámicamente para evitar errores de SSR
const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

// Formateadores
const fmtCOP = (v: number) => {
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  return `$${v.toLocaleString("es-CO")}`;
};

const fmtNum = (v: number) => new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(v);

// Componente KPI con estilo premium unificado
function KPICard({ label, value, color, icon: Icon, trend }: { label: string; value: string; color: string; icon: any; trend?: string }) {
  return (
    <div className={`kpi-card ${color}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {trend && <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginTop: 4 }}>{trend}</div>}
      <span className="kpi-icon"><Icon size={24} strokeWidth={2.5} /></span>
    </div>
  );
}

export default function ResumenSocialPage() {
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [filtroAnio, setFiltroAnio] = useState<string[]>([]);
  const [filtroEmpresa, setFiltroEmpresa] = useState<string[]>([]);
  const [filtroDpto, setFiltroDpto] = useState<string[]>([]);
  const [filtroMpio, setFiltroMpio] = useState<string[]>([]);

  // Fetch data
  const { data, isLoading, error } = useQuery({
    queryKey: ["social-impact-data"],
    queryFn: async () => {
      const response = await axios.get("/api/social-impact");
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Normalización y filtrado
  const processedData = useMemo(() => {
    if (!data) return null;

    const normalizeArr = (arr: any[]) => arr.map(item => 
      normalizarRegistro(item, ['departamento_raw'], ['municipio_raw'], ['empresa_raw'])
    );

    const bienes = normalizeArr(data.bienes_servicios || []);
    const inversion = normalizeArr(data.inversion_social || []);
    const empleo = normalizeArr(data.empleo || []);

    const filterFn = (item: any) => {
      if (filtroAnio.length > 0 && !filtroAnio.includes(String(item.anio))) return false;
      if (filtroEmpresa.length > 0 && !filtroEmpresa.includes(item.empresa || item.empresa_raw)) return false;
      if (filtroDpto.length > 0 && !filtroDpto.includes(item.departamento || item.departamento_raw)) return false;
      if (filtroMpio.length > 0 && !filtroMpio.includes(item.municipio || item.municipio_raw)) return false;
      return true;
    };

    return {
      bienes: bienes.filter(filterFn),
      inversion: inversion.filter(filterFn),
      empleo: empleo.filter(filterFn),
      municipios: data.municipios
    };
  }, [data, filtroAnio, filtroEmpresa, filtroDpto, filtroMpio]);

  // Selectores
  const anios = useMemo(() => {
    if (!data) return ["Todos"];
    const allAnios = new Set([...data.bienes_servicios, ...data.inversion_social, ...data.empleo].map(r => String(r.anio)));
    return Array.from(allAnios).sort().reverse();
  }, [data]);

  const empresas = useMemo(() => {
    if (!data) return ["Todas"];
    const allEmpresas = new Set([...data.bienes_servicios, ...data.inversion_social, ...data.empleo].map(r => r.empresa || r.empresa_raw));
    return Array.from(allEmpresas).map(e => String(e)).filter(e => e && e !== "undefined").sort();
  }, [data]);

  const departamentos = useMemo(() => {
    if (!data) return ["Todos"];
    const allDptos = new Set([...data.bienes_servicios, ...data.inversion_social, ...data.empleo].map(r => r.departamento || r.departamento_raw));
    return Array.from(allDptos).map(d => String(d)).filter(d => d && d !== "undefined").sort();
  }, [data]);

  const municipios = useMemo(() => {
    if (!data) return ["Todos"];
    const allMpios = new Set([...data.bienes_servicios, ...data.inversion_social, ...data.empleo].map(r => r.municipio || r.municipio_raw));
    return Array.from(allMpios).map(m => String(m)).filter(m => m && m !== "undefined").sort();
  }, [data]);

  // KPIs
  const kpis = useMemo(() => {
    if (!processedData) return { inversion: 0, empleo: 0, proveedores: 0, beneficiarios: 0, zomac: 0 };
    return {
      inversion: processedData.inversion.reduce((s, r) => s + Number(r.valor_cop || 0), 0) + 
                 processedData.bienes.reduce((s, r) => s + Number(r.valor_cop || 0), 0),
      empleo: processedData.empleo.reduce((s, r) => s + Number(r.num_empleos || 0), 0),
      proveedores: new Set(processedData.bienes.map(r => r.empresa_nit)).size,
      beneficiarios: processedData.inversion.reduce((s, r) => s + Number(r.num_beneficiarios || 0), 0),
      zomac: processedData.inversion.filter(r => r.zomac_pdet && r.zomac_pdet !== 'NA' && r.zomac_pdet !== 'NO' && r.zomac_pdet !== 'N/A').reduce((s, r) => s + Number(r.valor_cop || 0), 0)
    };
  }, [processedData]);

  const chartODS = useMemo(() => {
    if (!processedData) return { series: [], labels: [] };
    const acc: Record<string, number> = {};
    processedData.inversion.forEach(r => {
      if (r.ods_principal) {
        acc[r.ods_principal] = (acc[r.ods_principal] || 0) + Number(r.valor_cop || 0);
      }
    });
    const sorted = Object.entries(acc).sort(([, a], [, b]) => b - a).slice(0, 8);
    return {
      series: sorted.map(([, v]) => v),
      labels: sorted.map(([k]) => k)
    };
  }, [processedData]);

  const chartInversionPorAnio = useMemo(() => {
    if (!processedData) return { series: [], categories: [] };
    const acc: Record<string, number> = {};
    [...processedData.inversion, ...processedData.bienes].forEach(r => {
      if (r.anio) acc[r.anio] = (acc[r.anio] || 0) + Number(r.valor_cop || 0);
    });
    const sorted = Object.entries(acc).sort(([a], [b]) => a.localeCompare(b));
    return {
      series: [{ name: "Inversión Total", data: sorted.map(([, v]) => v) }],
      categories: sorted.map(([k]) => k)
    };
  }, [processedData]);

  const topEmpresasData = useMemo(() => {
    if (!processedData) return [];
    const combined = [...processedData.inversion, ...processedData.bienes];
    const acc: Record<string, number> = {};
    
    combined.forEach(r => {
      // Intentamos obtener el nombre de la empresa de campos conocidos tras la normalización
      const emp = r.Empresa || r.empresa || r.empresa_raw || "Desconocida";
      acc[emp] = (acc[emp] || 0) + Number(r.valor_cop || 0);
    });

    return Object.entries(acc)
      .map(([x, y]) => ({ x, y }))
      .filter(i => i.y > 0)
      .sort((a, b) => b.y - a.y)
      .slice(0, 10);
  }, [processedData]);

  const chartTheme = {
    chart: { background: 'transparent', toolbar: { show: false }, fontFamily: 'var(--font-main)' },
    theme: { mode: 'light' as 'light' },
    colors: ['#D44D03', '#003745', '#008054', '#C68400', '#0277BD', '#6A1B9A'],
    grid: { borderColor: 'rgba(0,0,0,0.05)' }
  };

  const filtrosActivos = [filtroAnio, filtroEmpresa, filtroDpto, filtroMpio].filter(v => v.length > 0).length;

  if (isLoading) return <Loading message="Generando resumen de impacto estratégico..." />;
  if (error) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-danger)' }}>Error: {String(error)}</div>;

  return (
    <div className="page-content">
      {/* ── Panel de Filtros (Drawer) ── */}
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, opacity: filtrosAbiertos ? 1 : 0, pointerEvents: filtrosAbiertos ? "auto" : "none", transition: "opacity 0.25s" }} onClick={() => setFiltrosAbiertos(false)} />
      
      <button 
        style={{ position: "fixed", right: filtrosAbiertos ? 320 : 0, top: "50%", transform: "translateY(-50%)", zIndex: 1002, background: "var(--color-primary)", color: "#fff", border: "none", cursor: "pointer", padding: "12px 8px", borderRadius: "8px 0 0 8px", writingMode: "vertical-rl", transition: "right 0.3s", fontWeight: 700, display: "flex", gap: "8px", alignItems: "center", minHeight: 120 }} 
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
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {[
            { label: "Año", value: filtroAnio, icon: <Calendar size={14} />, onChange: setFiltroAnio, options: anios },
            { label: "Empresa", value: filtroEmpresa, icon: <Building2 size={14} />, onChange: setFiltroEmpresa, options: empresas },
            { label: "Departamento", value: filtroDpto, icon: <MapPin size={14} />, onChange: setFiltroDpto, options: departamentos },
            { label: "Municipio", value: filtroMpio, icon: <Home size={14} />, onChange: setFiltroMpio, options: municipios },
          ].map(f => (
            <div key={f.label}>
              <label style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 6, display: "flex", alignItems: "center", gap: "6px", textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {f.icon} {f.label}
              </label>
              <MultiSelect options={f.options} selected={f.value} onChange={f.onChange} />
            </div>
          ))}
          <button 
            onClick={() => { setFiltroAnio([]); setFiltroEmpresa([]); setFiltroDpto([]); setFiltroMpio([]); }} 
            style={{ padding: 12, background: "var(--color-bg-elevated)", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, marginTop: 12, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <RotateCcw size={14} /> Restablecer Filtros
          </button>
        </div>
      </div>

      {/* ── Contenido Principal ── */}
      <div className="page-header" style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ color: 'var(--color-primary)', fontSize: '2.2rem', fontWeight: 900 }}>
          Impacto Social y Económico
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '1rem' }}>
          Consolidado estratégico de Inversión, Empleo y Bienes & Servicios
          {filtrosActivos > 0 && <span style={{ marginLeft: 12, background: 'var(--color-primary)', color: '#fff', padding: '3px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>{filtrosActivos} activos</span>}
        </p>
      </div>

      <div className="kpi-grid">
        <KPICard label="Presupuesto Social" value={fmtCOP(kpis.inversion)} color="primary" icon={DollarSign} />
        <KPICard label="Impacto ZOMAC/PDET" value={fmtCOP(kpis.zomac)} color="warning" icon={Home} />
        <KPICard label="Empleos Totales" value={fmtNum(kpis.empleo)} color="success" icon={HardHat} />
        <KPICard label="Beneficiarios" value={fmtNum(kpis.beneficiarios)} color="secondary" icon={Users} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px', marginBottom: '24px' }}>
        <div className="panel" id="panel-res-social-evolucion">
          <div className="panel-header">
            <span className="panel-title">Evolución de la Inversión</span>
            <ExportButton targetId="panel-res-social-evolucion" fileName="Evolucion_Inversion_Social" />
          </div>
          <div className="panel-body">
            <Chart
              options={{ ...chartTheme, xaxis: { categories: chartInversionPorAnio.categories }, stroke: { curve: 'straight', width: 3 }, tooltip: { y: { formatter: (v) => fmtCOP(Number(v)) } } }}
              series={chartInversionPorAnio.series}
              type="area" height={380}
            />
          </div>
        </div>

        <div className="panel" id="panel-res-social-ods">
          <div className="panel-header">
            <span className="panel-title">Inversión por ODS Principal</span>
            <ExportButton targetId="panel-res-social-ods" fileName="Inversion_ODS_Social" />
          </div>
          <div className="panel-body">
            <Chart
              options={{ ...chartTheme, labels: chartODS.labels, legend: { position: 'bottom', horizontalAlign: 'center' }, tooltip: { y: { formatter: (v) => fmtCOP(Number(v)) } } }}
              series={chartODS.series}
              type="pie" height={380}
            />
          </div>
        </div>
      </div>

      <div className="panel" id="panel-res-social-empresas">
        <div className="panel-header">
          <span className="panel-title">Top Empresas por Impacto Económico</span>
          <ExportButton targetId="panel-res-social-empresas" fileName="Top_Empresas_Social" />
        </div>
        <div className="panel-body">
          <Chart
            options={{
              ...chartTheme,
              plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '95%', dataLabels: { position: 'center' } } },
              dataLabels: { 
                enabled: true, 
                formatter: (v: any) => fmtCOP(v), 
                style: { fontSize: '11px', fontWeight: 700 } 
              },
              xaxis: { labels: { show: false } },
              yaxis: { labels: { style: { fontWeight: 600, fontSize: '11px' } } },
              colors: ['#008054']
            }}
            series={[{
              name: 'Inversión Total',
              data: topEmpresasData
            }]}
            type="bar"
            height={380}
          />
        </div>
      </div>
    </div>
  );
}

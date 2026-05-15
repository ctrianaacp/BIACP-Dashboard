"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Factory, ShieldCheck, Users, Globe, Building2 } from "lucide-react";
import Loading from "@/components/Loading";
import ExportButton from "@/components/ExportButton";
import DataTable from "@/components/DataTable";

function KPICard({ label, value, color, icon: Icon, sub }: any) {
  return (
    <div className={`kpi-card ${color}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-delta">{sub}</div>}
      <span className="kpi-icon"><Icon size={24} strokeWidth={2.5} /></span>
    </div>
  );
}

export default function ProveedoresPage() {
  const [filtroPais, setFiltroPais] = useState("Todos");
  const [filtroAfiliado, setFiltroAfiliado] = useState("Todos");

  const { data, isLoading, error } = useQuery({
    queryKey: ["proveedores", filtroPais, filtroAfiliado],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filtroPais !== "Todos") params.append("country", filtroPais);
      if (filtroAfiliado !== "Todos") params.append("affiliate", filtroAfiliado);
      
      const res = await fetch(`/api/proveedores?${params.toString()}`);
      if (!res.ok) throw new Error("Error consultando proveedores");
      return res.json();
    },
    staleTime: 4 * 60 * 60 * 1000,
  });

  if (isLoading) return <Loading message="Cargando directorio de proveedores..." />;
  if (error || !data) return <div style={{ padding: 48, textAlign: "center", color: "red" }}>Error cargando datos.</div>;

  const registros = data.registros || [];
  const kpis = data.kpis || {};
  const opciones = data.opciones || {};

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Factory size={32} strokeWidth={2.5} style={{ color: "var(--color-primary)" }} />
          Proveedores Oil & Gas
        </h1>
        <p>Directorio de empresas de bienes y servicios para la industria.</p>
      </div>

      {/* ── Filtros ── */}
      <div style={{ display: "flex", gap: 16, marginBottom: 24, padding: 16, background: "#fff", borderRadius: 8, boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
        <div style={{ flex: "1 1 200px" }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 6, display: "block" }}>
            <Globe size={14} style={{ display: "inline", marginRight: 4 }} /> País Sede
          </label>
          <select value={filtroPais} onChange={(e) => setFiltroPais(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 4, border: "1px solid #ccc", fontWeight: 600 }}>
            <option value="Todos">Todos</option>
            {opciones.countries?.map((c: string) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ flex: "1 1 200px" }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 6, display: "block" }}>
            <ShieldCheck size={14} style={{ display: "inline", marginRight: 4 }} /> Afiliado CCS
          </label>
          <select value={filtroAfiliado} onChange={(e) => setFiltroAfiliado(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 4, border: "1px solid #ccc", fontWeight: 600 }}>
            <option value="Todos">Todos</option>
            <option value="true">Sí</option>
            <option value="false">No</option>
          </select>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <KPICard label="Total Proveedores" value={kpis.total_companies} color="primary" icon={Building2} />
        <KPICard label="Empleados Directos" value={kpis.total_employees?.toLocaleString("es-CO") || "N/A"} color="success" icon={Users} />
        <KPICard label="Afiliados CCS" value={kpis.total_affiliates} color="info" icon={ShieldCheck} />
        <KPICard label="Promedio Experiencia (Nacional)" value={`${kpis.avg_national_exp?.toFixed(1)} Años`} color="warning" icon={Factory} />
      </div>

      {/* ── Tabla de Directorio ── */}
      <div className="panel" id="panel-proveedores">
        <div className="panel-header">
          <span className="panel-title">Directorio Oficial</span>
          <ExportButton targetId="panel-proveedores" fileName="Proveedores_OilGas" />
        </div>
        <DataTable
          data={registros}
          columns={[
            { key: "logo_url", label: "Logo", render: (v, item) => v ? <img src={v} alt={item.name} style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 4 }} /> : <div style={{ width: 40, height: 40, background: "#eee", borderRadius: 4 }} /> },
            { key: "name", label: "Empresa", width: "250px", render: (v, item) => (
              <div>
                <div style={{ fontWeight: 800, color: "var(--color-primary)" }}>{v}</div>
                <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>NIT: {item.nit}</div>
              </div>
            )},
            { key: "headquarters_country", label: "Sede" },
            { key: "total_employees", label: "Empleados", align: "right" },
            { key: "national_experience", label: "Exp. Nac. (Años)", align: "right" },
            { key: "is_security_council_affiliate", label: "CCS", align: "center", render: (v) => v ? <ShieldCheck color="green" size={18} /> : <span style={{ color: "#ccc" }}>-</span> },
            { key: "website", label: "Web", render: (v) => v ? <a href={v} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-info)", fontSize: 12 }}>Visitar</a> : "" }
          ]}
          pageSize={20}
        />
      </div>
    </div>
  );
}

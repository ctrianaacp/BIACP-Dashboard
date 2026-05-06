"use client";
import Link from "next/link";
import { 
  BarChart3, 
  Droplets, 
  Wind, 
  Leaf, 
  Waves, 
  AlertCircle, 
  Home, 
  DollarSign, 
  HardHat, 
  Users, 
  Handshake, 
  FileText,
  ArrowRight 
} from "lucide-react";

const MODULOS = [
  { href: "/dashboard/produccion-petroleo", label: "Producción Petróleo", icon: Droplets, color: "primary", kpi: "BPDC", desc: "Barriles por día calendario" },
  { href: "/dashboard/produccion-gas", label: "Producción Gas", icon: Wind, color: "secondary", kpi: "MPCD", desc: "Millones de pies cúbicos por día" },
  { href: "/dashboard/compensaciones", label: "Compensaciones Ambientales", icon: Leaf, color: "success", kpi: "Ha", desc: "Hectáreas compensadas y pendientes" },
  { href: "/dashboard/inversion-1pct", label: "Inversión 1%", icon: Waves, color: "info", kpi: "$", desc: "Ejecutado vs liquidado por municipio" },
  { href: "/dashboard/bloqueos", label: "SIM Bloqueos", icon: AlertCircle, color: "danger", kpi: "N°", desc: "Alarmas y bloqueos upstream 2010-2024" },
  { href: "/dashboard/zomac-pdet", label: "ZOMAC / PDET", icon: Home, color: "warning", kpi: "170", desc: "Municipios priorizados de paz" },
  { href: "/dashboard/regalias", label: "Regalías SGR", icon: DollarSign, color: "primary", kpi: "SGR", desc: "Presupuesto, ejecución y caja bienio" },
  { href: "/dashboard/contratacion", label: "Bienes y Servicios", icon: HardHat, color: "secondary", kpi: "$COP", desc: "Compras directas e indirectas por empresa" },
  { href: "/dashboard/empleo", label: "Empleo", icon: Users, color: "success", kpi: "Empleos", desc: "Local, nacional y foráneo por empresa" },
  { href: "/dashboard/inversion-social", label: "Inversión Social", icon: Handshake, color: "info", kpi: "$COP", desc: "Proyectos sociales y beneficiarios" },
  { href: "/dashboard/consulta-previa", label: "Consulta Previa", icon: FileText, color: "warning", kpi: "Proc.", desc: "Protocolizaciones hidrocarburos y minería" },
];

export default function DashboardHome() {
  return (
    <div className="page-content">
      <div className="page-header" style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ color: 'var(--color-secondary)', fontSize: '2.2rem', fontWeight: 900 }}>
          Centro de Inteligencia ACP
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '1rem' }}>
          Visualización estratégica y analítica de datos del sector hidrocarburos en Colombia
        </p>
      </div>

      {/* Banner bienvenida premium */}
      <div className="home-banner">
        <div className="home-banner-icon">
          <BarChart3 size={48} color="#fff" strokeWidth={1.5} />
        </div>
        <div className="home-banner-content">
          <h2 className="home-banner-title">
            Plataforma Unificada de Indicadores
          </h2>
          <p className="home-banner-text">
            Bienvenido al portal de visualización de la Asociación Colombiana del Petróleo y Gas. 
            Monitoree en tiempo real la producción, ejecución social, impacto ambiental y conflictividad 
            del sector a nivel nacional y regional.
          </p>
        </div>
        <div className="home-banner-stats">
          <div className="stats-label">Módulos de Análisis</div>
          <div className="stats-value">{MODULOS.length}</div>
        </div>
      </div>

      {/* Grid de módulos premium */}
      <div className="modules-grid">
        {MODULOS.map((mod) => (
          <Link href={mod.href} key={mod.href} style={{ textDecoration: "none" }}>
            <div className={`kpi-card ${mod.color}`} style={{ cursor: "pointer", height: "100%", display: 'flex', flexDirection: 'column', padding: '16px' }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <span style={{ color: 'var(--color-primary)', background: 'var(--color-bg)', padding: 8, borderRadius: 8, boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <mod.icon size={22} strokeWidth={2.5} />
                </span>
                <span style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  background: "var(--color-bg-elevated)",
                  color: "var(--color-text-muted)",
                  border: "1px solid var(--color-border)",
                }}>{mod.kpi}</span>
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-secondary)', marginBottom: 4 }}>{mod.label}</div>
              <p style={{ fontSize: "12px", color: "var(--color-text-muted)", lineHeight: 1.4, flex: 1, margin: 0 }}>{mod.desc}</p>
              <div style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: '1px solid var(--color-border)',
                fontSize: "11px",
                fontWeight: 700,
                color: 'var(--color-primary)',
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}>
                Explorar módulo <ArrowRight size={16} />
              </div>
            </div>
          </Link>
        ))}
    </div>
  </div>
);
}

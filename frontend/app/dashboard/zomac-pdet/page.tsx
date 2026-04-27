"use client";
import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { 
  Home, 
  Map, 
  MapPin, 
  Globe, 
  Scale, 
  Search, 
  X, 
  RotateCcw 
} from "lucide-react";
import ExportButton from "@/components/ExportButton";
import MultiSelect from "@/components/MultiSelect";
import { formatNum } from "@/lib/formatters";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

const PDET_DATA = [
  { subregion: "Sierra Nevada y Perijá", dptos: ["Cesar", "La Guajira", "Magdalena"], municipios: 11 },
  { subregion: "Bajo Cauca y Nordeste Antioqueño", dptos: ["Antioquia"], municipios: 12 },
  { subregion: "Catatumbo", dptos: ["Norte de Santander"], municipios: 9 },
  { subregion: "Chocó", dptos: ["Chocó"], municipios: 23 },
  { subregion: "Cuenca del Cagüán y Piedemonte Caqueteño", dptos: ["Caquetá", "Huila"], municipios: 9 },
  { subregion: "Macarena – Guaviare", dptos: ["Meta", "Guaviare"], municipios: 14 },
  { subregion: "Montes de María", dptos: ["Bolívar", "Sucre"], municipios: 15 },
  { subregion: "Pacífico Medio", dptos: ["Cauca", "Chocó", "Nariño"], municipios: 11 },
  { subregion: "Pacífico y Frontera Nariñense", dptos: ["Nariño"], municipios: 22 },
  { subregion: "Putumayo", dptos: ["Putumayo"], municipios: 13 },
  { subregion: "Sur de Bolívar", dptos: ["Bolívar", "Cesar"], municipios: 11 },
  { subregion: "Sur de Córdoba", dptos: ["Córdoba", "Antioquia"], municipios: 9 },
  { subregion: "Urabá Antioqueño", dptos: ["Antioquia", "Chocó"], municipios: 11 },
  { subregion: "Arauca", dptos: ["Arauca"], municipios: 7 },
  { subregion: "Alto Patía y Norte del Cauca", dptos: ["Cauca", "Nariño"], municipios: 23 },
];

const BENEFICIOS = [
  { beneficio: "Renta 0% – empresas nuevas en ZOMAC", descuento: "0% (2017–2021) → 25% (2022–2024) → 50% (2025–2027)", aplica: "Empresas nuevas radicadas en ZOMAC" },
  { beneficio: "Obras por impuestos", descuento: "Hasta 50% del impuesto de renta", aplica: "Proyectos PDET aprobados por PNUD / DNP" },
  { beneficio: "Mega-inversiones en ZOMAC", descuento: "Tarifa fija del 27% (no progresiva)", aplica: "Inversiones > 30.000 SMMLV en zona ZOMAC" },
  { beneficio: "IVA en obras civiles en zonas PDET", descuento: "IVA no genera costo para la operadora", aplica: "Contratos de obra en municipios priorizados" },
];

function KPICard({ label, value, color, icon: Icon }: { label: string; value: string; color: string; icon: any }) {
  return (
    <div className={`kpi-card ${color}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <span className="kpi-icon"><Icon size={24} strokeWidth={2.5} /></span>
    </div>
  );
}

export default function ZomacPdetPage() {
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [filtroSubregion, setFiltroSubregion] = useState<string[]>([]);
  const [filtroDpto, setFiltroDpto] = useState<string[]>([]);

  const filtrosActivos = [filtroSubregion, filtroDpto].filter(v => v.length > 0).length;

  const subregiones = PDET_DATA.map(d => d.subregion);
  const departamentos = useMemo(() =>
    Array.from(new Set(PDET_DATA.flatMap(d => d.dptos))).sort(), []
  );

  const filtrados = useMemo(() =>
    PDET_DATA.filter(d => {
      if (filtroSubregion.length > 0 && !filtroSubregion.includes(d.subregion)) return false;
      if (filtroDpto.length > 0 && !d.dptos.some(dp => filtroDpto.includes(dp))) return false;
      return true;
    }),
    [filtroSubregion, filtroDpto]
  );
  const totalMun = filtrados.reduce((s, d) => s + d.municipios, 0);
  const totalDptos = new Set(filtrados.flatMap(d => d.dptos)).size;

  // ── Estilos panel lateral ──
  const overlay: React.CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000,
    opacity: filtrosAbiertos ? 1 : 0,
    pointerEvents: filtrosAbiertos ? "auto" : "none",
    transition: "opacity 0.25s ease",
  };
  const panelStyle: React.CSSProperties = {
    position: "fixed", top: 0, right: 0, bottom: 0, width: 300,
    background: "#fff", borderLeft: "1px solid #e2e8f0",
    zIndex: 1001, overflowY: "auto", padding: "24px 20px",
    transform: filtrosAbiertos ? "translateX(0)" : "translateX(100%)",
    transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
    boxShadow: filtrosAbiertos ? "-8px 0 40px rgba(0,0,0,0.20)" : "none",
    color: "#1e293b",
  };
  const tabStyle: React.CSSProperties = {
    position: "fixed", right: filtrosAbiertos ? 300 : 0, top: "50%",
    transform: "translateY(-50%)", zIndex: 1002,
    background: "#C4501A", color: "#fff", fontWeight: 700, fontSize: 12,
    border: "none", cursor: "pointer", padding: "10px 6px",
    borderRadius: "6px 0 0 6px", writingMode: "vertical-rl",
    textOrientation: "mixed", letterSpacing: "0.05em", textTransform: "uppercase",
    transition: "right 0.3s cubic-bezier(0.4,0,0.2,1)",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minHeight: 80,
  };

  const chartBase = {
    chart: { background: "transparent", toolbar: { show: false }, fontFamily: "var(--font-main)" },
    theme: { mode: "light" as const },
    grid: { borderColor: "var(--color-border)" },
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 style={{ color: "var(--color-primary)", fontWeight: 900 }}>ZOMAC / PDET</h1>
        <p>Municipios priorizados para el desarrollo territorial y zonas más afectadas por el conflicto.</p>
      </div>

      <div style={{
        background: "var(--color-bg-elevated)", borderLeft: "4px solid var(--color-primary)",
        borderRadius: 12, padding: "24px", marginBottom: 32,
        display: "flex", gap: 20, alignItems: "flex-start", boxShadow: "var(--shadow-sm)"
      }}>
        <Scale size={32} style={{ color: "var(--color-primary)" }} />
        <div>
          <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--color-secondary)", marginBottom: 8 }}>
            Marco Legal y Beneficios Tributarios
          </div>
          <p style={{ fontSize: "0.9rem", color: "var(--color-text-muted)", lineHeight: 1.6, margin: 0 }}>
            Las empresas que operan o inviertan en municipios <strong>ZOMAC</strong> pueden acceder a incentivos fiscales 
            según la <strong>Ley 1819/2016</strong> y el <strong>Decreto 893/2017</strong>. Los beneficios incluyen obras por impuestos, 
            tarifas reducidas de renta y exclusiones de IVA para proyectos PDET.
          </p>
        </div>
      </div>

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
            { label: "Subregión PDET", value: filtroSubregion, icon: <Home size={14} />, onChange: setFiltroSubregion, options: subregiones },
            { label: "Departamento", value: filtroDpto, icon: <Map size={14} />, onChange: setFiltroDpto, options: departamentos },
          ].map(f => (
            <div key={f.label}>
              <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {f.icon} {f.label}
              </label>
              <MultiSelect options={f.options} selected={f.value} onChange={f.onChange} />
            </div>
          ))}
          <button 
            onClick={() => { setFiltroSubregion([]); setFiltroDpto([]); }} 
            style={{ padding: 12, background: "var(--color-bg-elevated)", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, marginTop: 12, fontSize: 13, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <RotateCcw size={14} /> Limpiar Filtros
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        <KPICard label="Subregiones PDET" value={String(PDET_DATA.length)} color="primary" icon={Home} />
        <KPICard label="Municipios Priorizados" value="170" color="secondary" icon={Map} />
        <KPICard label="Municipios (Filtro)" value={String(totalMun)} color="info" icon={MapPin} />
        <KPICard label="Jurisdicciones" value={String(totalDptos)} color="success" icon={Globe} />
      </div>

      <div className="charts-grid">
        <div className="panel" id="panel-zp-subreg">
          <div className="panel-header">
            <span className="panel-title">Distribución por Subregión</span>
            <ExportButton targetId="panel-zp-subreg" fileName="Distribucion_Subregion_ZP" />
          </div>
          <div className="panel-body">
            {typeof window !== "undefined" && (
              <Chart type="bar" height={380}
                series={[{ name: "Municipios", data: filtrados.map(d => d.municipios) }]}
                options={{
                  ...chartBase,
                  plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: "95%", dataLabels: { position: 'center' } } },
                  xaxis: { categories: filtrados.map(d => d.subregion), labels: { style: { colors: "var(--color-text-muted)" } } },
                  colors: ["#D44D03"],
                  dataLabels: { 
                    enabled: true, 
                    formatter: (v: number) => formatNum(v),
                    style: { fontSize: "11px", fontWeight: 700 } 
                  }
                }}
              />
            )}
          </div>
        </div>
        <div className="panel" id="panel-zp-mun">
          <div className="panel-header">
            <span className="panel-title">Impacto por Municipios</span>
            <ExportButton targetId="panel-zp-mun" fileName="Impacto_Municipios_ZP" />
          </div>
          <div className="panel-body">
            {typeof window !== "undefined" && (
              <Chart type="treemap" height={380}
                series={[{
                  data: filtrados.map(d => ({
                    x: d.subregion.length > 20 ? d.subregion.slice(0, 20) + "…" : d.subregion,
                    y: d.municipios,
                  }))
                }]}
                options={{
                  ...chartBase,
                  colors: ["#D44D03", "#003745", "#008054", "#C68400", "#29B6F6", "#4FC3F7"],
                  plotOptions: { treemap: { distributed: true, enableShades: false } },
                  dataLabels: { 
                    enabled: true, 
                    formatter: (val: string, opts: any) => {
                      const name = opts.w.globals.labels[opts.dataPointIndex];
                      return `${name}: ${formatNum(Number(val))}`;
                    },
                    style: { fontSize: "12px", fontWeight: 800 } 
                  },
                  legend: { show: false }
                }}
              />
            )}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header"><span className="panel-title">Listado de Subregiones PDET</span></div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Subregión</th>
                <th>Departamentos</th>
                <th style={{ textAlign: "right" }}>Municipios</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((d, i) => (
                <tr key={i}>
                  <td data-label="Subregión" style={{ fontWeight: 700 }}>{d.subregion}</td>
                  <td data-label="Departamentos" style={{ fontSize: "0.85rem" }}>{d.dptos.join(", ")}</td>
                  <td data-label="Municipios" style={{ textAlign: "right", fontWeight: 800, color: "var(--color-primary)" }}>{d.municipios}</td>
                  <td data-label="Estado"><span className="badge success">Activo</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header"><span className="panel-title">Detalle de Beneficios Tributarios</span></div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Beneficio</th>
                <th>Incentivo / Condición</th>
                <th>Población Objetivo</th>
              </tr>
            </thead>
            <tbody>
              {BENEFICIOS.map((b, i) => (
                <tr key={i}>
                  <td data-label="Beneficio" style={{ fontWeight: 700 }}>{b.beneficio}</td>
                  <td data-label="Incentivo">
                    <span style={{ color: "var(--color-emphasis)", fontWeight: 700 }}>{b.descuento}</span>
                  </td>
                  <td data-label="Aplica" style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>{b.aplica}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

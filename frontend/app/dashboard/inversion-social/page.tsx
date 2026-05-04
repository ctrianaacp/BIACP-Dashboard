"use client";
import { useMsal } from "@azure/msal-react";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useState, useMemo } from "react";
import MapaSocialPage from "./MapaSocial";
import { fetchExcelXLSX, SHAREPOINT_FILES } from "@/lib/graphClient";
import { normalizarOperadora, normalizarDepartamento, normalizarMunicipio } from "@/lib/normalizacion";
import { 
  Handshake, 
  Users, 
  FileText, 
  Building2, 
  Search, 
  X, 
  RotateCcw, 
  Calendar, 
  MapPin,
  Globe,
  Home 
} from "lucide-react";
import Loading from "@/components/Loading";
import { formatNum, formatCurrency, formatAbbr } from "@/lib/formatters";
import ExportButton from "@/components/ExportButton";
import MultiSelect from "@/components/MultiSelect";
import DataTable from "@/components/DataTable";

interface RegistroInvSocial {
  Empresa: string; Departamento: string; Municipio: string;
  MontoInvertido: number; Beneficiarios: number;
  TipoProyecto: string; Anio: string;
}

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

const chartBase = { 
  chart: { background: "transparent", toolbar: { show: false }, fontFamily: "var(--font-main)" }, 
  theme: { mode: "light" as const }, 
  grid: { borderColor: "var(--color-border)" } 
};
// Centralizado en lib/formatters

import axios from "axios";

function excelDateToISO(serial: unknown): string {
  if (serial === null || serial === undefined || serial === "") return "";
  if (serial instanceof Date) {
    if (isNaN(serial.getTime())) return "";
    const y = serial.getUTCFullYear();
    const m = String(serial.getUTCMonth() + 1).padStart(2, "0");
    const d = String(serial.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof serial === "string") {
    if (serial.trim() === "") return "";
    if (serial.includes("-") && serial.length >= 7) return serial.substring(0, 10);
    const parsed = new Date(serial);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().substring(0, 10);
    return serial;
  }
  const num = Number(serial);
  if (isNaN(num) || num < 1 || num > 100000) return "";
  try {
    const date = new Date(Math.round((num - 25569) * 86400 * 1000));
    if (isNaN(date.getTime())) return "";
    return date.toISOString().substring(0, 10);
  } catch {
    return "";
  }
}

function calcularPromedioMensual(registros: any[], campoValor: string): number {
  if (registros.length === 0) return 0;
  const porMes: Record<string, number> = {};
  for (const r of registros) {
    const key = r.Fecha.substring(0, 7);
    if (!key || key.length < 7) continue;
    porMes[key] = (porMes[key] ?? 0) + r[campoValor];
  }
  const valores = Object.values(porMes);
  if (valores.length === 0) return 0;
  return valores.reduce((s, v) => s + v, 0) / valores.length;
}

async function cargarPetroleo(instance: any, accounts: any[]) {
  const account = accounts[0];
  if (!account) return [];
  const rows = await fetchExcelXLSX(
    SHAREPOINT_FILES.petroleoConsolidado.site,
    SHAREPOINT_FILES.petroleoConsolidado.path,
    SHAREPOINT_FILES.petroleoConsolidado.table,
    instance,
    account
  );
  return rows.map((r: any) => ({
    Fecha: excelDateToISO(r["Fecha"]),
    Produccion: Number(r["Producción"] ?? r["Produccion"] ?? 0),
  }));
}

async function cargarGas(instance: any, accounts: any[]) {
  const account = accounts[0];
  if (!account) return [];
  const rows = await fetchExcelXLSX(
    SHAREPOINT_FILES.gasConsolidado.site,
    SHAREPOINT_FILES.gasConsolidado.path,
    SHAREPOINT_FILES.gasConsolidado.table,
    instance,
    account
  );
  return rows.map((r: any) => ({
    Fecha: excelDateToISO(r["Fecha"]),
    Produccion: Number(r["Producción"] ?? r["Produccion"] ?? 0),
  }));
}

async function cargarInvSocial(): Promise<RegistroInvSocial[]> {
  const response = await axios.get("/api/social-impact");
  const data = response.data;
  
  return data.inversion_social.map((r: any) => ({
    Empresa: normalizarOperadora(r.empresa_raw || r.empresa),
    Departamento: normalizarDepartamento(r.departamento_raw || r.departamento),
    Municipio: normalizarMunicipio(r.municipio_raw || r.municipio),
    MontoInvertido: Number(r.valor_cop || 0),
    Beneficiarios: Number(r.num_beneficiarios || r.beneficiarios_totales || 0),
    TipoProyecto: String(r.tipo_inversion || ""),
    Anio: String(r.anio || ""),
  }));
}

async function fetchOdsStats(anio: string | string[], empresa: string | string[], dpto: string | string[], mpio: string | string[]) {
  const { data } = await axios.get(`/api/stats/dashboard?type=inversion-social&anio=${[anio].flat().join(",")}&empresa=${[empresa].flat().join(",")}&departamento=${[dpto].flat().join(",")}&municipio=${[mpio].flat().join(",")}`);
  return data;
}

const ODS_MAP: Record<string, string> = {
  "fin de la pobreza": "1",
  "hambre cero": "2",
  "salud y bienestar": "3",
  "educación de calidad": "4",
  "igualdad de género": "5",
  "agua limpia y saneamiento": "6",
  "energía asequible y no contaminante": "7",
  "trabajo decente y crecimiento económico": "8",
  "industria, innovación e infraestructura": "9",
  "reducción de las desigualdades": "10",
  "ciudades y comunidades sostenibles": "11",
  "producción y consumo responsables": "12",
  "acción por el clima": "13",
  "vida submarina": "14",
  "vida de ecosistemas terrestres": "15",
  "paz, justicia e instituciones sólidas": "16",
  "alianzas para lograr los objetivos": "17"
};

const STANDARD_ODS_NAMES: Record<number, string> = {
  1: "Fin de la Pobreza",
  2: "Hambre Cero",
  3: "Salud y Bienestar",
  4: "Educación de Calidad",
  5: "Igualdad de Género",
  6: "Agua y Saneamiento",
  7: "Energía Asequible",
  8: "Trabajo Decente",
  9: "Industria e Innovación",
  10: "Reducción Desigualdades",
  11: "Ciudades Sostenibles",
  12: "Producción Responsable",
  13: "Acción por el Clima",
  14: "Vida Submarina",
  15: "Ecosistemas Terrestres",
  16: "Paz e Instituciones",
  17: "Alianzas para Objetivos"
};

function getOdsIcon(id: number | string) {
  const n = parseInt(String(id));
  if (isNaN(n) || n < 1 || n > 17) return null;
  return `/images/ods/${n}.png`;
}

function ODSImpactSection({ anio, empresa, dpto, mpio }: { anio: string[]; empresa: string[]; dpto: string[]; mpio: string[] }) {
  const { data, isLoading } = useQuery({ 
    queryKey: ["ods-stats", anio, empresa, dpto, mpio], 
    queryFn: () => fetchOdsStats(anio, empresa, dpto, mpio) 
  });
  
  if (isLoading || !data) return null;

  const rawOdsData = data.by_ods || [];
  const groupedOds: Record<number, { id: number, ods: string, cantidad: number, valor: number }> = {};
  
  rawOdsData.forEach((d: any) => {
    const label = d.ods || "";
    const cleanLabel = label.toLowerCase()
      .replace(/^objetivo \d+:\s*/i, "")
      .replace(/^ods \d+\s*-\s*/i, "")
      .replace(/^ods \d+:\s*/i, "")
      .trim();
    
    let numStr = ODS_MAP[cleanLabel];
    if (!numStr) {
      const match = label.match(/(\d+)/);
      if (match) numStr = match[1];
    }
    
    const num = parseInt(numStr);
    if (!isNaN(num) && num >= 1 && num <= 17) {
      if (!groupedOds[num]) {
        groupedOds[num] = { id: num, ods: STANDARD_ODS_NAMES[num], cantidad: 0, valor: 0 };
      }
      groupedOds[num].cantidad += Number(d.cantidad || 0);
      groupedOds[num].valor += Number(d.valor || 0);
    }
  });

  const odsData = Object.values(groupedOds).sort((a, b) => b.cantidad - a.cantidad);

  return (
    <div className="panel" id="panel-social-ods" style={{ marginBottom: 32, background: 'linear-gradient(to right, #ffffff, #f8fafc)' }}>
      <div className="panel-header" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Globe size={18} color="var(--color-primary)" /> Contribución a ODS (Objetivos de Desarrollo Sostenible)
        </span>
        <ExportButton targetId="panel-social-ods" fileName="Contribucion_ODS" />
      </div>
      <div className="panel-body">
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 32, alignItems: 'flex-start' }}>
          <div>
            <Chart 
              type="bar"
              height={Math.max(450, odsData.length * 35)}
              series={[{
                name: "Proyectos",
                data: odsData.map((d: any) => ({
                  x: d.ods,
                  y: Number(d.cantidad)
                }))
              }]}
              options={{
                ...chartBase,
                plotOptions: {
                  bar: {
                    horizontal: true,
                    distributed: true,
                    borderRadius: 4,
                    barHeight: '75%',
                    dataLabels: {
                      position: 'top',
                    },
                  }
                },
                colors: ["#E5243B", "#DDA63A", "#4C9F38", "#C5192D", "#FF3A21", "#26BDE2", "#FCC30B", "#A21942", "#FD6925", "#DD1367", "#FD9D24", "#BF8B2E", "#3F7E44", "#0A97D9", "#56C02B", "#00689D", "#19486A"],
                dataLabels: {
                  enabled: true,
                  textAnchor: 'start',
                  style: {
                    colors: ['#333'],
                    fontSize: '11px',
                    fontWeight: 700
                  },
                  formatter: function (val: number, opt: any) {
                    const total = opt.w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0);
                    const pct = total > 0 ? (val / total * 100).toFixed(1) : 0;
                    return `${val} (${pct}%)`;
                  },
                  offsetX: 5,
                },
                xaxis: {
                  categories: odsData.map((d: any) => d.ods),
                  labels: { show: false }
                },
                yaxis: {
                  labels: {
                    show: true,
                    maxWidth: 180,
                    style: { fontSize: '11px', fontWeight: 700, colors: '#475569' }
                  }
                },
                legend: { show: false },
                tooltip: { theme: "light", y: { formatter: (v: number) => formatNum(v) + " proyectos" } }
              }}
            />
          </div>
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
              {odsData.slice(0, 6).map((d: any, i: number) => {
                const iconUrl = getOdsIcon(d.id);
                return (
                  <div key={i} style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid var(--color-border)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', gap: 12 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 8, overflow: 'hidden', flexShrink: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.1)', background: 'var(--color-bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {iconUrl ? (
                        <img src={iconUrl} alt={d.ods} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Globe size={20} color="var(--color-primary)" />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {d.ods}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--color-secondary)', lineHeight: 1 }}>{formatNum(d.cantidad)}</div>
                          <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>PROYECTOS</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--color-info)' }}>{formatCurrency(d.valor, true)}</div>
                          <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>INVERSIÓN</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', marginTop: 16, opacity: 0.6, fontStyle: 'italic' }}>
              Los iconos y nombres son propiedad de las Naciones Unidas. Este dashboard es una herramienta analítica independiente de la ACP.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
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

export default function InversionSocialPage() {
  const { instance, accounts } = useMsal();
  const [activeTab, setActiveTab] = useState<'indicadores' | 'mapa'>('indicadores');
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [filtroOp, setFiltroOp] = useState<string[]>([]);
  const [filtroDpto, setFiltroDpto] = useState<string[]>([]);
  const [filtroMpio, setFiltroMpio] = useState<string[]>([]);
  const [filtroAnio, setFiltroAnio] = useState<string[]>([]);

  const { data: registros = [], isLoading, error } = useQuery({
    queryKey: ["inversion-social"],
    queryFn: cargarInvSocial,
    staleTime: 10 * 60 * 1000,
  });

  const empresas = useMemo(() => Array.from(new Set(registros.map(r=>r.Empresa))).sort(), [registros]);
  const departamentos = useMemo(() => Array.from(new Set(registros.map(r=>r.Departamento))).sort(), [registros]);
  const municipios = useMemo(() => Array.from(new Set(registros.map(r=>r.Municipio))).sort(), [registros]);
  const anios = useMemo(() => Array.from(new Set(registros.map(r=>r.Anio).filter(Boolean))).sort().reverse(), [registros]);

  const filtrados = useMemo(() => registros.filter(r => {
    if (filtroOp.length > 0 && !filtroOp.includes(r.Empresa)) return false;
    if (filtroDpto.length > 0 && !filtroDpto.includes(r.Departamento)) return false;
    if (filtroMpio.length > 0 && !filtroMpio.includes(r.Municipio)) return false;
    if (filtroAnio.length > 0 && !filtroAnio.includes(r.Anio)) return false;
    return true;
  }), [registros, filtroOp, filtroDpto, filtroMpio, filtroAnio]);

  const kpis = useMemo(() => ({
    monto: filtrados.reduce((s,r)=>s+r.MontoInvertido,0),
    beneficiarios: filtrados.reduce((s,r)=>s+r.Beneficiarios,0),
    proyectos: filtrados.length,
    empresas: new Set(filtrados.map(r=>r.Empresa)).size,
  }),[filtrados]);

  const porTipo = useMemo(() => {
    const acc: Record<string,number> = {};
    filtrados.forEach(r => { if (r.TipoProyecto) acc[r.TipoProyecto] = (acc[r.TipoProyecto]??0) + r.MontoInvertido; });
    return Object.entries(acc).sort(([,a],[,b])=>b-a).slice(0,8);
  },[filtrados]);

  const topEmpresas = useMemo(() => {
    const acc: Record<string,number> = {};
    filtrados.forEach(r => { acc[r.Empresa] = (acc[r.Empresa]??0) + r.MontoInvertido; });
    return Object.entries(acc).sort(([,a],[,b])=>b-a).slice(0,10);
  },[filtrados]);

  const { data: petroleo } = useQuery({
    queryKey: ["produccion-petroleo-basico-inv"],
    queryFn: () => cargarPetroleo(instance, accounts),
    enabled: accounts.length > 0,
    staleTime: 10 * 60 * 1000,
  });

  const { data: gas } = useQuery({
    queryKey: ["produccion-gas-basico-inv"],
    queryFn: () => cargarGas(instance, accounts),
    enabled: accounts.length > 0,
    staleTime: 10 * 60 * 1000,
  });

  const chartSeriesCruce = useMemo(() => {
    if (!petroleo || !gas || registros.length === 0) return null;

    const pPorAnio: Record<string, any[]> = {};
    petroleo.forEach((r: any) => {
      const y = r.Fecha.substring(0, 4);
      if (!y || y.length < 4) return;
      if (!pPorAnio[y]) pPorAnio[y] = [];
      pPorAnio[y].push(r);
    });
    
    const gPorAnio: Record<string, any[]> = {};
    gas.forEach((r: any) => {
      const y = r.Fecha.substring(0, 4);
      if (!y || y.length < 4) return;
      if (!gPorAnio[y]) gPorAnio[y] = [];
      gPorAnio[y].push(r);
    });

    const iPorAnio: Record<string, number> = {};
    filtrados.forEach((r: any) => {
      const y = r.Anio;
      if (!y) return;
      iPorAnio[y] = (iPorAnio[y] ?? 0) + r.MontoInvertido;
    });

    const allYears = new Set<string>();
    Object.keys(pPorAnio).forEach(y => allYears.add(y));
    Object.keys(gPorAnio).forEach(y => allYears.add(y));
    Object.keys(iPorAnio).forEach(y => allYears.add(y));

    const yearsSorted = Array.from(allYears).sort((a, b) => a.localeCompare(b)).filter(y => y !== 'null');

    const dataPetroleo = yearsSorted.map(y => pPorAnio[y] ? calcularPromedioMensual(pPorAnio[y], 'Produccion') : 0);
    const dataGas = yearsSorted.map(y => gPorAnio[y] ? calcularPromedioMensual(gPorAnio[y], 'Produccion') : 0);
    const dataInv = yearsSorted.map(y => iPorAnio[y] || 0);

    return {
      categories: yearsSorted,
      petroleo: dataPetroleo,
      gas: dataGas,
      inv: dataInv
    };
  }, [petroleo, gas, filtrados, registros]);

  const filtrosActivos = [filtroAnio, filtroOp, filtroDpto, filtroMpio].filter(v => v.length > 0).length;

  if (isLoading) return <Loading message="Cargando datos de inversión social..." />;
  if (error) return (
    <div className="page-content">
      <div className="page-header"><h1>🤝 Inversión Social</h1></div>
      <div className="panel"><div className="panel-body" style={{textAlign:"center",padding:48}}><div style={{fontSize:40,marginBottom:12}}>⚠️</div><div style={{color:"var(--color-danger)",fontWeight:700}}>{String(error)}</div></div></div>
    </div>
  );

  return (
    <>
      <div style={{ padding: '24px 24px 0', display: 'flex', gap: 8, borderBottom: '1px solid var(--color-border)', background: '#fff' }}>
        <button 
          onClick={() => setActiveTab('indicadores')}
          style={{ padding: '12px 24px', fontWeight: 800, color: activeTab === 'indicadores' ? 'var(--color-info)' : 'var(--color-text-muted)', borderBottom: activeTab === 'indicadores' ? '3px solid var(--color-info)' : '3px solid transparent', background: 'transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer', fontSize: 14 }}
        >
          Indicadores y Tablas
        </button>
        <button 
          onClick={() => setActiveTab('mapa')}
          style={{ padding: '12px 24px', fontWeight: 800, color: activeTab === 'mapa' ? 'var(--color-info)' : 'var(--color-text-muted)', borderBottom: activeTab === 'mapa' ? '3px solid var(--color-info)' : '3px solid transparent', background: 'transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer', fontSize: 14 }}
        >
          Mapa Georreferenciado
        </button>
      </div>

      {activeTab === 'indicadores' ? (
        <div className="page-content">
      {/* ── Panel de Filtros (Drawer) ── */}
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, opacity: filtrosAbiertos ? 1 : 0, pointerEvents: filtrosAbiertos ? "auto" : "none", transition: "opacity 0.25s" }} onClick={() => setFiltrosAbiertos(false)} />
      
      <button 
        style={{ position: "fixed", right: filtrosAbiertos ? 320 : 0, top: "50%", transform: "translateY(-50%)", zIndex: 1002, background: "var(--color-info)", color: "#fff", border: "none", cursor: "pointer", padding: "12px 6px", borderRadius: "8px 0 0 8px", writingMode: "vertical-rl", transition: "right 0.3s", fontWeight: 700, display: "flex", gap: "8px", alignItems: "center", minHeight: 120 }} 
        onClick={() => setFiltrosAbiertos(!filtrosAbiertos)}
      >
        {filtrosActivos > 0 && <span style={{ background: "#fff", color: "var(--color-info)", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, writingMode: "horizontal-tb", marginBottom: 4, fontWeight: 900 }}>{filtrosActivos}</span>}
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
        <h1 style={{ color: 'var(--color-info)', fontWeight: 900 }}>Inversión Social</h1>
        <p>
          {filtrados.length.toLocaleString("es-CO")} registros · Fuente: PostgreSQL
          {filtrosActivos > 0 && <span style={{ marginLeft: 12, background: 'var(--color-info)', color: '#fff', padding: '3px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>{filtrosActivos} activos</span>}
        </p>
      </div>
      
      <div className="kpi-grid">
        <KPICard label="Inversión Total" value={formatCurrency(kpis.monto, true)} color="info" icon={Handshake} />
        <KPICard label="Beneficiarios" value={formatNum(kpis.beneficiarios)} color="success" icon={Users} />
        <KPICard label="Proyectos" value={formatNum(kpis.proyectos)} color="primary" icon={FileText} />
        <KPICard label="Empresas" value={formatNum(kpis.empresas)} color="secondary" icon={Building2} />
      </div>

      <div className="panel" id="panel-cruce-historico-inv" style={{ marginBottom: 32 }}>
        <div className="panel-header">
          <span className="panel-title">Evolución Inversión Social y Producción de Petróleo y Gas</span>
          <ExportButton targetId="panel-cruce-historico-inv" fileName="Cruce_InversionSocial_Produccion" />
        </div>
        <div className="panel-body">
          {typeof window !== "undefined" && chartSeriesCruce ? (
            <Chart
              type="line"
              height={450}
              series={[
                { name: "Inversión Social (COP)", type: "column", data: chartSeriesCruce.inv },
                { name: "Producción Petróleo (BPDC)", type: "line", data: chartSeriesCruce.petroleo.map(v => Math.round(v)) },
                { name: "Producción Gas (MPCD)", type: "line", data: chartSeriesCruce.gas.map(v => Math.round(v)) },
              ]}
              options={{
                ...chartBase,
                stroke: { width: [0, 4, 4], curve: 'smooth' },
                xaxis: { categories: chartSeriesCruce.categories },
                colors: ["#0277BD", "#D44D03", "#003745"],
                dataLabels: { enabled: false },
                yaxis: [
                  {
                    title: { text: "Inversión COP", style: { color: "#0277BD", fontWeight: 700 } },
                    labels: { style: { colors: "#0277BD" }, formatter: (v: number) => formatCurrency(v, true) },
                  },
                  {
                    opposite: true,
                    title: { text: "BPDC / MPCD", style: { color: "#D44D03", fontWeight: 700 } },
                    labels: { style: { colors: "#D44D03" }, formatter: (v: number) => formatAbbr(v) },
                  },
                  {
                    show: false,
                    opposite: true,
                    title: { text: "MPCD", style: { color: "#003745", fontWeight: 700 } },
                    labels: { style: { colors: "#003745" }, formatter: (v: number) => formatAbbr(v) },
                  }
                ],
                tooltip: {
                  shared: true,
                  intersect: false,
                  y: {
                    formatter: function (y, { seriesIndex }) {
                      if (typeof y !== "undefined") {
                        if (seriesIndex === 0) return formatCurrency(y, false) + " COP";
                        if (seriesIndex === 1) return formatAbbr(y) + " BPDC";
                        if (seriesIndex === 2) return formatAbbr(y) + " MPCD";
                      }
                      return y;
                    }
                  }
                },
                legend: { 
                  position: 'top', 
                  horizontalAlign: 'center',
                  itemMargin: { horizontal: 15, vertical: 5 }
                }
              }}
            />
          ) : (
            <div style={{height:450, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--color-text-muted)'}}>Cargando datos de producción y gas...</div>
          )}
        </div>
      </div>

      <ODSImpactSection anio={filtroAnio} empresa={filtroOp} dpto={filtroDpto} mpio={filtroMpio} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px', marginBottom: '24px' }}>
        <div className="panel" id="panel-social-top">
          <div className="panel-header">
            <span className="panel-title">Inversión por Empresa (Top 10)</span>
            <ExportButton targetId="panel-social-top" fileName="Inversion_Empresa_Top10" />
          </div>
          <div className="panel-body">
            {typeof window !== "undefined" && topEmpresas.length > 0 && (
              <Chart type="bar" height={380}
                series={[{name:"Monto",data:topEmpresas.map(([,v])=>Math.round(v))}]}
                options={{...chartBase,
                  plotOptions:{bar:{horizontal:true,borderRadius:4,barHeight:"95%",dataLabels:{position:'center'}}},
                  xaxis:{categories:topEmpresas.map(([e])=>e),labels:{style:{colors:"var(--color-text-muted)",fontSize:"11px"},formatter:(v:string)=>formatCurrency(Number(v), true)}},
                  yaxis:{labels:{style:{colors:"var(--color-text-muted)",fontSize:"11px"}}},
                  colors:["#0277BD"],dataLabels:{enabled:true,style:{fontSize:"11px",fontWeight:700},formatter:(v:number)=>formatCurrency(v,true)},
                  tooltip:{theme:"light",y:{formatter:(v:number)=>formatCurrency(v, false)}},
                }}
              />
            )}
          </div>
        </div>
        <div className="panel" id="panel-social-tipo">
          <div className="panel-header">
            <span className="panel-title">Distribución por Tipo de Inversión</span>
            <ExportButton targetId="panel-social-tipo" fileName="Distribucion_Tipo_Inversion" />
          </div>
          <div className="panel-body" style={{display:"flex",justifyContent:"center", height: '380px'}}>
            {typeof window !== "undefined" && porTipo.length > 0 && (
              <Chart type="pie" height="100%"
                series={porTipo.map(([,v])=>Math.round(v))}
                options={{...chartBase,
                  labels:porTipo.map(([t])=>t),
                  legend:{position:"bottom",fontFamily: "var(--font-main)"},
                  colors:["#0277BD","#DDA63A","#D44D03","#6A1B9A","#C68400","#C62828","#0097A7","#558B2F"],
                  tooltip:{theme:"light",y:{formatter:(v:number)=>formatCurrency(v, false)}},
                }}
              />
            )}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Detalle: Inversión Social</span>
          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{filtrados.length} registros</span>
        </div>
        <DataTable
          data={filtrados}
          columns={[
            { key: "Anio", label: "Año", width: "80px", render: (v) => <span style={{ opacity: 0.7, fontWeight: 700 }}>{v}</span> },
            { key: "Empresa", label: "Empresa", render: (v) => <span style={{ fontWeight: 700, color: "var(--color-secondary)" }}>{v}</span> },
            { key: "Departamento", label: "Departamento" },
            { key: "Municipio", label: "Municipio" },
            { key: "TipoProyecto", label: "Tipo Proyecto", render: (v) => <span style={{ fontSize: 12 }}>{v || "–"}</span> },
            { key: "MontoInvertido", label: "Monto", align: "right", render: (v) => <span style={{ fontWeight: 700, color: "var(--color-info)" }}>{formatCurrency(v, true)}</span> },
            { key: "Beneficiarios", label: "Beneficiarios", align: "right", render: (v) => <span style={{ fontWeight: 700, color: "var(--color-emphasis)" }}>{formatNum(v)}</span> },
          ]}
          pageSize={100}
        />
      </div>
    </div>
    ) : (
      <MapaSocialPage />
    )}
    </>
  );
}

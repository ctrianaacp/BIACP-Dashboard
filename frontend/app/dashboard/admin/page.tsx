"use client";

import { useState, useCallback, useEffect } from "react";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { fetchExcelXLSX, fetchExcelFromSharePoint, fetchDatosGovCo, DATOS_GOV_RECURSOS, SHAREPOINT_FILES } from "@/lib/graphClient";
import { graphConfig } from "@/lib/msalConfig";
import { 
  ShieldCheck, 
  BarChart3, 
  ClipboardList, 
  Building2, 
  FolderSearch, 
  Database, 
  Link2, 
  RotateCcw, 
  CheckCircle2, 
  XCircle,
  FolderOpen,
  Microscope
} from "lucide-react";

// ─── Constante de superadmin ──────────────────────────────────────────────────
const SUPERADMIN_EMAIL = "ctriana@acp.com.co";

// ─── Definición de todas las fuentes de datos ────────────────────────────────
type FuenteTipo = "sharepoint-xlsx" | "sharepoint-table" | "datos-gov";

interface FuenteDatos {
  id: string;
  nombre: string;
  modulo: string;
  tipo: FuenteTipo;
  site?: keyof typeof graphConfig.sites;
  siteUrl?: string;
  filePath?: string;
  tableName?: string;
  sheetName?: string;
  resourceId?: string;
  graphUrl?: string;
  descripcion: string;
  usaXLSX?: boolean;
}

const FUENTES: FuenteDatos[] = [
  // ── SharePoint Excel (XLSX descarga directa) ──────────────────────────────
  {
    id: "petroleo",
    nombre: "Producción Petróleo Consolidado",
    modulo: "Producción Petróleo",
    tipo: "sharepoint-xlsx",
    site: "equipoACP",
    siteUrl: `https://graph.microsoft.com/v1.0/sites/${graphConfig.sites.equipoACP}`,
    filePath: SHAREPOINT_FILES.petroleoConsolidado.path,
    tableName: SHAREPOINT_FILES.petroleoConsolidado.table,
    graphUrl: `https://graph.microsoft.com/v1.0/sites/${graphConfig.sites.equipoACP}/drive/root:/${SHAREPOINT_FILES.petroleoConsolidado.path}:/content`,
    descripcion: "Producción histórica de petróleo en barriles por día calendario (BPDC) por operadora, departamento y municipio.",
    usaXLSX: true,
  },
  {
    id: "gas",
    nombre: "Producción Gas Natural Consolidado",
    modulo: "Producción Gas",
    tipo: "sharepoint-xlsx",
    site: "equipoACP",
    siteUrl: `https://graph.microsoft.com/v1.0/sites/${graphConfig.sites.equipoACP}`,
    filePath: SHAREPOINT_FILES.gasConsolidado.path,
    tableName: SHAREPOINT_FILES.gasConsolidado.table,
    graphUrl: `https://graph.microsoft.com/v1.0/sites/${graphConfig.sites.equipoACP}/drive/root:/${SHAREPOINT_FILES.gasConsolidado.path}:/content`,
    descripcion: "Producción histórica de gas natural en MPCD (Millones de pies cúbicos por día) por operadora y período.",
    usaXLSX: true,
  },
  {
    id: "compensaciones",
    nombre: "Compensaciones Ambientales",
    modulo: "Compensaciones Ambientales",
    tipo: "sharepoint-table",
    site: "datosBIACP",
    siteUrl: `https://graph.microsoft.com/v1.0/sites/${graphConfig.sites.datosBIACP}`,
    filePath: SHAREPOINT_FILES.compensaciones.path,
    tableName: SHAREPOINT_FILES.compensaciones.table,
    graphUrl: `https://graph.microsoft.com/v1.0/sites/${graphConfig.sites.datosBIACP}/drive/root:/${SHAREPOINT_FILES.compensaciones.path}:/workbook/tables/${SHAREPOINT_FILES.compensaciones.table}/rows`,
    descripcion: "Hectáreas comprometidas, ejecutadas y pendientes de compensación ambiental por operadora.",
  },
  {
    id: "inversion1pct",
    nombre: "Inversión 1% Operadoras",
    modulo: "Inversión 1%",
    tipo: "sharepoint-table",
    site: "datosBIACP",
    siteUrl: `https://graph.microsoft.com/v1.0/sites/${graphConfig.sites.datosBIACP}`,
    filePath: SHAREPOINT_FILES.inversion1pct.path,
    tableName: SHAREPOINT_FILES.inversion1pct.table,
    graphUrl: `https://graph.microsoft.com/v1.0/sites/${graphConfig.sites.datosBIACP}/drive/root:/${SHAREPOINT_FILES.inversion1pct.path}:/workbook/tables/${SHAREPOINT_FILES.inversion1pct.table}/rows`,
    descripcion: "Montos ejecutados y liquidados de inversión del 1% ambiental por operadora y municipio.",
  },
  {
    id: "bloqueos-sim",
    nombre: "SIM Bloqueos (Reporte Vigente)",
    modulo: "SIM Bloqueos",
    tipo: "sharepoint-xlsx",
    site: "equipoACP",
    siteUrl: `https://graph.microsoft.com/v1.0/sites/${graphConfig.sites.equipoACP}`,
    filePath: SHAREPOINT_FILES.bloqueosSIM.path,
    tableName: SHAREPOINT_FILES.bloqueosSIM.table,
    graphUrl: `https://graph.microsoft.com/v1.0/sites/${graphConfig.sites.equipoACP}/drive/root:/${SHAREPOINT_FILES.bloqueosSIM.path}:/content`,
    descripcion: "Reporte vigente de alarmas y bloqueos upstream del Sistema de Información de Manifestaciones (SIM).",
    usaXLSX: true,
  },
  {
    id: "bloqueos-historico",
    nombre: "SIM Bloqueos Histórico 2010-2024",
    modulo: "SIM Bloqueos",
    tipo: "sharepoint-xlsx",
    site: "equipoACP",
    siteUrl: `https://graph.microsoft.com/v1.0/sites/${graphConfig.sites.equipoACP}`,
    filePath: SHAREPOINT_FILES.bloqueosHistorico.path,
    tableName: SHAREPOINT_FILES.bloqueosHistorico.table,
    graphUrl: `https://graph.microsoft.com/v1.0/sites/${graphConfig.sites.equipoACP}/drive/root:/${SHAREPOINT_FILES.bloqueosHistorico.path}:/content`,
    descripcion: "Histórico completo de alarmas y bloqueos upstream desde 2010 hasta 2024.",
    usaXLSX: true,
  },
  {
    id: "sgr-aprobados",
    nombre: "SGR – Proyectos Aprobados",
    modulo: "Regalías SGR",
    tipo: "datos-gov",
    resourceId: DATOS_GOV_RECURSOS.sgrProyectosAprobados,
    graphUrl: `https://www.datos.gov.co/resource/${DATOS_GOV_RECURSOS.sgrProyectosAprobados}.json`,
    descripcion: "Proyectos OCAD aprobados por el Sistema General de Regalías (SGR). Fuente: datos.gov.co",
  },
  {
    id: "sgr-resumen",
    nombre: "SGR – Resumen General",
    modulo: "Regalías SGR",
    tipo: "datos-gov",
    resourceId: DATOS_GOV_RECURSOS.sgrResumen,
    graphUrl: `https://www.datos.gov.co/resource/${DATOS_GOV_RECURSOS.sgrResumen}.json`,
    descripcion: "Resumen consolidado de distribución y uso de regalías por ente territorial.",
  },
  {
    id: "cifras-sociales-empleo",
    nombre: "Cifras Sociales – Empleo",
    modulo: "Empleo",
    tipo: "sharepoint-xlsx",
    site: "datosBIACP",
    siteUrl: `https://graph.microsoft.com/v1.0/sites/${graphConfig.sites.datosBIACP}`,
    filePath: SHAREPOINT_FILES.cifrasSociales.path,
    tableName: "EMPLEO",
    graphUrl: `https://graph.microsoft.com/v1.0/sites/${graphConfig.sites.datosBIACP}/drive/root:/${SHAREPOINT_FILES.cifrasSociales.path}:/content`,
    descripcion: "Registros de empleo nacional y local por operadora, sexo y origen de contratación.",
    usaXLSX: true,
  },
  {
    id: "cifras-sociales-bys",
    nombre: "Cifras Sociales – Bienes y Servicios",
    modulo: "Bienes y Servicios",
    tipo: "sharepoint-xlsx",
    site: "datosBIACP",
    siteUrl: `https://graph.microsoft.com/v1.0/sites/${graphConfig.sites.datosBIACP}`,
    filePath: SHAREPOINT_FILES.cifrasSociales.path,
    tableName: "BYS",
    graphUrl: `https://graph.microsoft.com/v1.0/sites/${graphConfig.sites.datosBIACP}/drive/root:/${SHAREPOINT_FILES.cifrasSociales.path}:/content`,
    descripcion: "Consolidado de contratación local y no local de bienes y servicios (compras directas e indirectas).",
    usaXLSX: true,
  },
  {
    id: "cifras-sociales-inversion",
    nombre: "Cifras Sociales – Inversión Social",
    modulo: "Inversión Social",
    tipo: "sharepoint-xlsx",
    site: "datosBIACP",
    siteUrl: `https://graph.microsoft.com/v1.0/sites/${graphConfig.sites.datosBIACP}`,
    filePath: SHAREPOINT_FILES.cifrasSociales.path,
    tableName: "INVERSIÓN_SOCIAL",
    graphUrl: `https://graph.microsoft.com/v1.0/sites/${graphConfig.sites.datosBIACP}/drive/root:/${SHAREPOINT_FILES.cifrasSociales.path}:/content`,
    descripcion: "Proyectos de inversión social obligatoria y voluntaria por línea de inversión y ODS.",
    usaXLSX: true,
  },
];

const TIPO_BADGE: Record<FuenteTipo, { label: string; color: string; bg: string; icon: any }> = {
  "sharepoint-xlsx": { label: "SharePoint XLSX", color: "#0F6CBD", bg: "#EFF6FC", icon: <BarChart3 size={14} /> },
  "sharepoint-table": { label: "SharePoint Table API", color: "#0F6CBD", bg: "#EFF6FC", icon: <ClipboardList size={14} /> },
  "datos-gov": { label: "datos.gov.co", icon: <Building2 size={14} />, color: "#107C10", bg: "#EFF7EF" },
};

const MODULO_COLORES: Record<string, string> = {
  "Producción Petróleo": "#C4501A",
  "Producción Gas": "#3D4F5C",
  "Compensaciones Ambientales": "#2E7D32",
  "Inversión 1%": "#0277BD",
  "SIM Bloqueos": "#C62828",
  "Regalías SGR": "#6A1B9A",
  "ZOMAC / PDET": "#E65100",
  "Bienes y Servicios": "#3D4F5C",
  "Empleo": "#2E7D32",
};

const PAGE_SIZE = 20;
type Estado = "idle" | "loading" | "ok" | "error";

interface TablaState {
  datos: Record<string, unknown>[];
  columnas: string[];
  total: number;
  pagina: number;
  estado: Estado;
  error?: string;
  filtroBusqueda: string;
}

export default function AdminPage() {
  const { accounts, instance } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const router = useRouter();
  const account = accounts[0];

  const userEmail = account?.username?.toLowerCase() ?? "";
  const esSuperAdmin = userEmail === SUPERADMIN_EMAIL.toLowerCase();

  useEffect(() => {
    if (!isAuthenticated) { router.replace("/"); return; }
    if (isAuthenticated && !esSuperAdmin) { router.replace("/dashboard"); }
  }, [isAuthenticated, esSuperAdmin, router]);

  const [fuenteSeleccionada, setFuenteSeleccionada] = useState<string | null>(null);
  const [tablaState, setTablaState] = useState<TablaState>({
    datos: [], columnas: [], total: 0, pagina: 0,
    estado: "idle", filtroBusqueda: "",
  });
  const [filtroModulo, setFiltroModulo] = useState<string>("Todos");

  const fuente = FUENTES.find(f => f.id === fuenteSeleccionada);

  const cargarDatos = useCallback(async (f: FuenteDatos) => {
    if (!account) return;
    setTablaState({ datos: [], columnas: [], total: 0, pagina: 0, estado: "loading", filtroBusqueda: "" });

    try {
      let rows: Record<string, unknown>[] = [];
      if (f.tipo === "sharepoint-xlsx" && f.site && f.filePath && f.tableName) {
        rows = await fetchExcelXLSX(f.site, f.filePath, f.tableName, instance, account);
      } else if (f.tipo === "sharepoint-table" && f.site && f.filePath && f.tableName) {
        rows = await fetchExcelFromSharePoint(f.site, f.filePath, f.tableName, instance, account);
      } else if (f.tipo === "datos-gov" && f.resourceId) {
        rows = await fetchDatosGovCo(f.resourceId, 500);
      }
      const columnas = rows.length > 0 ? Object.keys(rows[0]) : [];
      setTablaState({ datos: rows, columnas, total: rows.length, pagina: 0, estado: "ok", filtroBusqueda: "" });
    } catch (err) {
      setTablaState(prev => ({ ...prev, estado: "error", error: err instanceof Error ? err.message : "Error desconocido" }));
    }
  }, [account, instance]);

  if (!isAuthenticated || !esSuperAdmin) return null;

  const modulos = ["Todos", ...Array.from(new Set(FUENTES.map(f => f.modulo)))];
  const fuentesFiltradas = filtroModulo === "Todos" ? FUENTES : FUENTES.filter(f => f.modulo === filtroModulo);

  const datosFiltrados = tablaState.filtroBusqueda
    ? tablaState.datos.filter(row => Object.values(row).some(v => String(v ?? "").toLowerCase().includes(tablaState.filtroBusqueda.toLowerCase())))
    : tablaState.datos;

  const totalPaginas = Math.ceil(datosFiltrados.length / PAGE_SIZE);
  const datosPagina = datosFiltrados.slice(tablaState.pagina * PAGE_SIZE, (tablaState.pagina + 1) * PAGE_SIZE);

  return (
    <div>
      <div className="page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ShieldCheck size={32} strokeWidth={2.5} style={{ color: "var(--color-primary)" }} />
          Administración – Fuentes de Datos
        </h1>
        <p>Vista exclusiva para superadministrador · <strong>{account?.username}</strong></p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))", gap: "14px", marginBottom: "24px" }}>
        {[
          { icon: <FolderOpen size={16} />, label: "Fuentes totales", valor: FUENTES.length, color: "#C4501A" },
          { icon: <BarChart3 size={16} />, label: "SharePoint XLSX", valor: FUENTES.filter(f => f.tipo === "sharepoint-xlsx").length, color: "#0F6CBD" },
          { icon: <ClipboardList size={16} />, label: "SharePoint Tables", valor: FUENTES.filter(f => f.tipo === "sharepoint-table").length, color: "#0F6CBD" },
          { icon: <Building2 size={16} />, label: "datos.gov.co", valor: FUENTES.filter(f => f.tipo === "datos-gov").length, color: "#107C10" },
          { icon: <Database size={16} />, label: "Sites SharePoint", valor: 2, color: "#3D4F5C" },
        ].map(item => (
          <div key={item.label} className="panel" style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#6B7F8C", marginBottom: "6px", display: 'flex', alignItems: 'center', gap: '6px' }}>
              {item.icon} {item.label}
            </div>
            <div style={{ fontSize: "26px", fontWeight: 800, color: item.color }}>{item.valor}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: "20px", alignItems: "start" }}>
        <div>
          <div style={{ marginBottom: "12px" }}>
            <select className="select-filter" style={{ width: "100%" }} value={filtroModulo} onChange={e => setFiltroModulo(e.target.value)}>
              {modulos.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {fuentesFiltradas.map(f => {
              const isSelected = fuenteSeleccionada === f.id;
              const moduloColor = MODULO_COLORES[f.modulo] ?? "#3D4F5C";
              return (
                <div key={f.id} onClick={() => { setFuenteSeleccionada(f.id); cargarDatos(f); }}
                  style={{
                    background: isSelected ? "#FEF3EE" : "#fff",
                    border: `1.5px solid ${isSelected ? "#C4501A" : "#DDE3E8"}`,
                    borderRadius: "8px", padding: "12px 14px", cursor: "pointer", transition: "all 0.18s",
                    borderLeft: `4px solid ${isSelected ? "#C4501A" : moduloColor}`,
                  }}>
                  <div style={{ fontSize: "12.5px", fontWeight: 700, color: "#1A2530", marginBottom: "4px" }}>{f.nombre}</div>
                  <div style={{ fontSize: "10px", fontWeight: 700, color: moduloColor, textTransform: "uppercase" }}>{f.modulo}</div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: TIPO_BADGE[f.tipo].bg, color: TIPO_BADGE[f.tipo].color, fontSize: "10px", fontWeight: 600, padding: "2px 8px", borderRadius: "99px", marginTop: "8px" }}>
                    {TIPO_BADGE[f.tipo].icon} {TIPO_BADGE[f.tipo].label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          {!fuente ? (
            <div className="panel" style={{ padding: "48px", textAlign: "center" }}>
              <FolderSearch size={48} strokeWidth={1.5} style={{ color: 'var(--color-text-muted)', margin: '0 auto 16px' }} />
              <div style={{ fontWeight: 700 }}>Selecciona una fuente de datos</div>
            </div>
          ) : (
            <>
              <div className="panel" style={{ marginBottom: "16px" }}>
                <div className="panel-header">
                  <div className="panel-title">{TIPO_BADGE[fuente.tipo].icon} {fuente.nombre}</div>
                </div>
                <div className="panel-body">
                  <p style={{ fontSize: "13px", marginBottom: "16px" }}>{fuente.descripcion}</p>
                  
                  <div style={{ display: 'grid', gap: '8px', marginBottom: '20px' }}>
                    {fuente.filePath && <div style={{ fontSize: '11px', background: '#F5F7F8', padding: '8px', borderRadius: '4px' }}><strong>Ruta:</strong> {fuente.filePath}</div>}
                    {fuente.tableName && <div style={{ fontSize: '11px', background: '#F5F7F8', padding: '8px', borderRadius: '4px' }}><strong>Tabla/Hoja:</strong> {fuente.tableName}</div>}
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={() => cargarDatos(fuente)} disabled={tablaState.estado === "loading"} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-primary)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}>
                      <RotateCcw size={16} className={tablaState.estado === "loading" ? "animate-spin-slow" : ""} />
                      {tablaState.estado === "loading" ? "Cargando..." : "Cargar desde SharePoint"}
                    </button>

                    {tablaState.estado === "ok" && tablaState.datos.length > 0 && (
                      <button
                        onClick={async () => {
                          const tableMap: Record<string, string> = {
                            'cifras-sociales-empleo': 'hecho_empleo',
                            'cifras-sociales-bys': 'hecho_bienes_servicios',
                            'cifras-sociales-inversion': 'hecho_inversion_social'
                          };
                          const targetTable = tableMap[fuente.id];
                          if (!targetTable) { alert('No habilitado para sync DB.'); return; }
                          if (!confirm(`¿Sincronizar ${tablaState.datos.length} filas con ${targetTable}? (Se borrarán datos previos)`)) return;
                          
                          setTablaState(p => ({ ...p, estado: 'loading' }));
                          try {
                            const res = await axios.post('/api/admin/ingest', { table: targetTable, rows: tablaState.datos });
                            alert(`Éxito: ${res.data.count} filas sincronizadas.`);
                          } catch (err: any) {
                            alert('Error: ' + (err.response?.data?.error || err.message));
                          } finally {
                            setTablaState(p => ({ ...p, estado: 'ok' }));
                          }
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-success)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        <Database size={16} /> Sincronizar con DB
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {tablaState.estado === "ok" && (
                <div className="panel">
                  <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="panel-title">{tablaState.total.toLocaleString()} filas cargadas</div>
                    <input type="search" placeholder="Buscar..." value={tablaState.filtroBusqueda} onChange={e => setTablaState(p => ({ ...p, filtroBusqueda: e.target.value, pagina: 0 }))} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #DDE3E8' }} />
                  </div>
                  <div className="table-wrapper" style={{ maxHeight: '400px', overflow: 'auto' }}>
                    <table>
                      <thead>
                        <tr>{tablaState.columnas.slice(0, 10).map(c => <th key={c}>{c}</th>)}</tr>
                      </thead>
                      <tbody>
                        {datosPagina.map((row, i) => (
                          <tr key={i}>{tablaState.columnas.slice(0, 10).map(c => <td key={c} style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>{String(row[c] ?? "")}</td>)}</tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div style={{ marginTop: 28, padding: "20px 24px", background: "linear-gradient(135deg, #EFF7EF 0%, #EFF6FC 100%)", border: "1.5px solid #C8E6C9", borderRadius: 12, display: "flex", alignItems: "center", gap: 20 }}>
        <Microscope size={48} strokeWidth={1.5} style={{ color: "var(--color-success)" }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Laboratorio de Normalización</div>
          <div style={{ fontSize: 13 }}>Valida y genera reglas de transformación para nuevas fuentes de datos.</div>
        </div>
        <a href="/dashboard/admin/normalizacion" className="btn-primary" style={{ padding: "12px 22px", background: "#2E7D32", color: "#fff", borderRadius: 8, fontWeight: 700, textDecoration: "none" }}>🔬 Abrir →</a>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } .animate-spin-slow { animation: spin 2s linear infinite; }`}</style>
    </div>
  );
}

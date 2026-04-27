"use client";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { SHAREPOINT_FILES, fetchExcelXLSX, fetchExcelFromSharePoint, fetchDatosGovCo, DATOS_GOV_RECURSOS } from "@/lib/graphClient";
import {
  perfilarColumnas, detectarProblemas, generarCodigoReglas,
  aplicarCorrecciones, exportarCSV,
  PROBLEMA_INFO, PerfilColumna, Problema, TipoProblema,
} from "@/lib/normalizacionLab";
import { 
  BarChart3, 
  FolderTree, 
  AlertTriangle, 
  RotateCcw, 
  CheckCircle2, 
  XCircle, 
  FolderOpen, 
  Microscope, 
  Lightbulb, 
  Send, 
  Download, 
  ClipboardList, 
  Eye, 
  Sparkles, 
  Search, 
  Edit3,
  FileText,
  LayoutGrid
} from "lucide-react";
import { cargarOperadoras, cargarDaneMunicipios, Operadora, DaneMunicipio } from "@/lib/catalogos";

const SUPERADMIN_EMAIL = "ctriana@acp.com.co";

// ─── Catálogo de fuentes ──────────────────────────────────────────────────────
const FUENTES_LAB = [
  { id: "petroleo",     label: "Producción Petróleo",     tipo: "xlsx" as const, site: SHAREPOINT_FILES.petroleoConsolidado.site,   path: SHAREPOINT_FILES.petroleoConsolidado.path,   table: SHAREPOINT_FILES.petroleoConsolidado.table },
  { id: "gas",          label: "Producción Gas",           tipo: "xlsx" as const, site: SHAREPOINT_FILES.gasConsolidado.site,         path: SHAREPOINT_FILES.gasConsolidado.path,         table: SHAREPOINT_FILES.gasConsolidado.table },
  { id: "compensaciones", label: "Compensaciones Amb.",   tipo: "table" as const, site: SHAREPOINT_FILES.compensaciones.site,        path: SHAREPOINT_FILES.compensaciones.path,         table: SHAREPOINT_FILES.compensaciones.table },
  { id: "inversion1pct", label: "Inversión 1%",           tipo: "table" as const, site: SHAREPOINT_FILES.inversion1pct.site,         path: SHAREPOINT_FILES.inversion1pct.path,          table: SHAREPOINT_FILES.inversion1pct.table },
  { id: "bloqueos",     label: "SIM Bloqueos Histórico",  tipo: "xlsx" as const, site: SHAREPOINT_FILES.bloqueosHistorico.site,      path: SHAREPOINT_FILES.bloqueosHistorico.path,      table: SHAREPOINT_FILES.bloqueosHistorico.table },
  { id: "sgr",          label: "Regalías SGR",            tipo: "gov" as const,  resourceId: DATOS_GOV_RECURSOS.sgrProyectosAprobados },
];

type Paso = "selector" | "cargando" | "perfilado" | "problemas" | "revision" | "exportar";

export default function NormalizacionLabPage() {
  const { accounts, instance } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const router = useRouter();
  const account = accounts[0];
  const esSuperAdmin = account?.username?.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase();
  // Esperar a que MSAL inicialice (evita flash de redirección)
  const [msalListo, setMsalListo] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMsalListo(true), 600);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!msalListo) return;
    if (!isAuthenticated) { router.replace("/"); return; }
    if (!esSuperAdmin) router.replace("/dashboard");
  }, [msalListo, isAuthenticated, esSuperAdmin, router]);

  // ─── Estado ────────────────────────────────────────────────────────────────
  const [paso, setPaso] = useState<Paso>("selector");
  const [fuenteId, setFuenteId] = useState<string>("");
  const [filas, setFilas] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string>("");
  const [perfiles, setPerfiles] = useState<PerfilColumna[]>([]);
  const [problemas, setProblemas] = useState<Problema[]>([]);
  const [tabActiva, setTabActiva] = useState<"perfil" | "problemas" | "datos">("perfil");
  const [filtroTipo, setFiltroTipo] = useState<TipoProblema | "todos">("todos");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "pendiente" | "aprobado" | "rechazado">("todos");
  const [problemaBuscado, setProblema] = useState<number | null>(null);
  const [verNormalizados, setVerNormalizados] = useState(false);
  // ─── Catálogos de referencia DANE y Operadoras ────────────────────────────
  // ─── Catálogos de referencia DANE y Operadoras ────────────────────────────
  const { data: catalogoDane = [] } = useQuery<DaneMunicipio[]>({
    queryKey: ["catalogo-dane"],
    queryFn: () => cargarDaneMunicipios(instance, account!),
    enabled: msalListo && !!account,
    staleTime: 60 * 60 * 1000,
  });
  const { data: catalogoOps = [] } = useQuery<Operadora[]>({
    queryKey: ["catalogo-operadoras"],
    queryFn: () => cargarOperadoras(instance, account!),
    enabled: msalListo && !!account,
    staleTime: 60 * 60 * 1000,
  });

  const [copiado, setCopiado] = useState(false);
  const [paginaDatos, setPaginaDatos] = useState(0);
  const [toast, setToast] = useState<string>("");

  const mostrarToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  // ─── Cargar datos ──────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    if (!fuenteId || !account) return;
    const fuente = FUENTES_LAB.find(f => f.id === fuenteId);
    if (!fuente) return;
    setPaso("cargando"); setError("");
    try {
      let rows: Record<string, unknown>[] = [];
      if (fuente.tipo === "xlsx") {
        rows = await fetchExcelXLSX(fuente.site!, fuente.path!, fuente.table!, instance, account);
      } else if (fuente.tipo === "table") {
        rows = await fetchExcelFromSharePoint(fuente.site!, fuente.path!, fuente.table!, instance, account);
      } else if (fuente.tipo === "gov") {
        rows = await fetchDatosGovCo(fuente.resourceId!, 500) as Record<string, unknown>[];
      }
      setFilas(rows);
      const p = perfilarColumnas(rows);
      // Pasar catálogos DANE y Operadoras para normalización dinámica
      const probs = detectarProblemas(rows, p, {
        daneMunicipios: catalogoDane.length > 0 ? catalogoDane : undefined,
        operadoras: catalogoOps.length > 0 ? catalogoOps : undefined,
      });
      // Enriquecer perfiles con conteo de problemas
      const probsPorCol: Record<string, number> = {};
      probs.forEach(pr => { probsPorCol[pr.columna] = (probsPorCol[pr.columna] ?? 0) + 1; });
      const perfilesEnriquecidos = p.map(pf => ({ ...pf, problemas: probsPorCol[pf.nombre] ?? 0 }));
      setPerfiles(perfilesEnriquecidos);
      setProblemas(probs);
      setPaso("perfilado");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
      setPaso("selector");
    }
  }, [fuenteId, account, instance]);

  // ─── Acciones sobre problemas ─────────────────────────────────────────────
  const actualizarProblema = (idx: number, cambios: Partial<Problema>) => {
    setProblemas(prev => prev.map((p, i) => i === idx ? { ...p, ...cambios } : p));
  };

  const aprobarTodos = (tipo?: TipoProblema) => {
    let cuenta = 0;
    setProblemas(prev => prev.map(p => {
      if ((!tipo || p.tipo === tipo) && p.estado === "pendiente") {
        cuenta++;
        return { ...p, estado: "aprobado" };
      }
      return p;
    }));
    // Cambiar al tab de problemas para que el usuario vea el resultado
    setTabActiva("problemas");
    setFiltroEstado("aprobado");
    setTimeout(() => mostrarToast(`✅ ${cuenta} problema${cuenta !== 1 ? "s" : ""} aprobado${cuenta !== 1 ? "s" : ""}`), 50);
  };

  const rechazarTodos = (tipo?: TipoProblema) => {
    let cuenta = 0;
    setProblemas(prev => prev.map(p => {
      if ((!tipo || p.tipo === tipo) && p.estado === "pendiente") {
        cuenta++;
        return { ...p, estado: "rechazado" };
      }
      return p;
    }));
    setTabActiva("problemas");
    setFiltroEstado("rechazado");
    setTimeout(() => mostrarToast(`❌ ${cuenta} problema${cuenta !== 1 ? "s" : ""} rechazado${cuenta !== 1 ? "s" : ""}`), 50);
  };

  // ─── Filtros de problemas ─────────────────────────────────────────────────
  const problemasFiltrados = useMemo(() => {
    return problemas.filter(p => {
      if (filtroTipo !== "todos" && p.tipo !== filtroTipo) return false;
      if (filtroEstado !== "todos" && p.estado !== filtroEstado) return false;
      return true;
    });
  }, [problemas, filtroTipo, filtroEstado]);

  // ─── Código de exportación ────────────────────────────────────────────────
  const codigoExport = useMemo(() => generarCodigoReglas(problemas), [problemas]);

  // ─── Resumen ──────────────────────────────────────────────────────────────
  const resumen = useMemo(() => ({
    total: problemas.length,
    pendientes: problemas.filter(p => p.estado === "pendiente").length,
    aprobados: problemas.filter(p => p.estado === "aprobado" || p.estado === "editado").length,
    rechazados: problemas.filter(p => p.estado === "rechazado").length,
    porTipo: Object.entries(
      problemas.reduce((acc, p) => { acc[p.tipo] = (acc[p.tipo] ?? 0) + 1; return acc; }, {} as Record<string, number>)
    ).sort(([, a], [, b]) => b - a),
  }), [problemas]);

  // ─── Dataset normalizado (aplica correcciones aprobadas) ─────────────────
  const { filasNormalizadas, totalCambios, cambiosPorColumna } = useMemo(
    () => aplicarCorrecciones(filas, problemas),
    [filas, problemas]
  );

  // ─── Datos paginados (original o normalizado) ─────────────────────────────
  const PAGE = 20;
  const columnas = perfiles.map(p => p.nombre);
  const filasActuales = verNormalizados ? filasNormalizadas : filas;
  const datosPag = filasActuales.slice(paginaDatos * PAGE, (paginaDatos + 1) * PAGE);
  const totalPags = Math.ceil(filasActuales.length / PAGE);

  // Conjunto de valores originales corregidos (para resaltar celdas)
  const valoresCorregidos = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    for (const p of problemas) {
      if (p.estado !== "aprobado" && p.estado !== "editado") continue;
      if (!m[p.columna]) m[p.columna] = new Set();
      if (p.tipo === "duplicado-normalizable") {
        p.valor.split(" | ").forEach(v => m[p.columna].add(v.trim()));
      } else {
        m[p.columna].add(p.valor);
      }
    }
    return m;
  }, [problemas]);

  // Pantalla de carga mientras MSAL inicializa
  if (!msalListo) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400, gap: 16 }}>
      <RotateCcw size={40} className="animate-spin-slow" style={{ color: "var(--color-primary)" }} />
      <div style={{ color: "#6B7F8C", fontSize: 14, fontWeight: 600 }}>Verificando credenciales...</div>
    </div>
  );
  if (!isAuthenticated || !esSuperAdmin) return null;

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Microscope size={32} strokeWidth={2.5} style={{ color: "var(--color-primary)" }} />
          Laboratorio de Normalización
        </h1>
        <p>Análisis de calidad de datos · Revisión humana · Generación de reglas</p>
      </div>

      {/* ── PASO 1: Selector ── */}
      {(paso === "selector" || paso === "cargando") && (
        <div className="panel" style={{ maxWidth: 640, margin: "0 auto" }}>
          <div className="panel-header">
            <span className="panel-title">📂 Seleccionar Fuente de Datos</span>
          </div>
          <div className="panel-body">
            <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
              {FUENTES_LAB.map(f => (
                <label key={f.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "14px 16px", borderRadius: 8, cursor: "pointer",
                  border: `2px solid ${fuenteId === f.id ? "#C4501A" : "#DDE3E8"}`,
                  background: fuenteId === f.id ? "#FEF3EE" : "#fff",
                  transition: "all 0.15s",
                }}>
                  <input type="radio" name="fuente" value={f.id} checked={fuenteId === f.id}
                    onChange={() => setFuenteId(f.id)} style={{ accentColor: "#C4501A" }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#1A2530" }}>{f.label}</div>
                    <div style={{ fontSize: 11, color: "#6B7F8C", marginTop: 2 }}>
                      {f.tipo === "gov" ? "datos.gov.co" : `SharePoint ${f.tipo.toUpperCase()}`}
                      {f.tipo !== "gov" && ` · ${f.table}`}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {error && (
              <div style={{ background: "#FFF0F0", border: "1px solid #FFCDD2", borderRadius: 8, padding: "12px 16px", color: "#C62828", fontSize: 13, marginBottom: 16 }}>
                ❌ {error}
              </div>
            )}

            <button
              onClick={cargar}
              disabled={!fuenteId || paso === "cargando"}
              style={{
                width: "100%", padding: "12px 20px",
                background: (!fuenteId || paso === "cargando") ? "#DDE3E8" : "#C4501A",
                color: (!fuenteId || paso === "cargando") ? "#6B7F8C" : "#fff",
                border: "none", borderRadius: 8, cursor: !fuenteId ? "not-allowed" : "pointer",
                fontWeight: 700, fontSize: 14, fontFamily: "var(--font-inter)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                transition: "all 0.18s",
              }}
            >
              {paso === "cargando" ? (
                <><RotateCcw size={18} className="animate-spin-slow" /> Cargando y analizando...</>
              ) : <><Search size={18} /> Cargar y analizar datos</>}
            </button>
          </div>
        </div>
      )}

      {/* ── PASOS 2+: Análisis ── */}
      {paso === "perfilado" && (
        <>
          {/* Barra de resumen */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Filas cargadas", val: filas.length.toLocaleString("es-CO"), color: "#C4501A", icon: <BarChart3 size={14} /> },
              { label: "Columnas", val: String(perfiles.length), color: "#3D4F5C", icon: <LayoutGrid size={14} /> },
              { label: "Problemas", val: String(resumen.total), color: "#C62828", icon: <AlertTriangle size={14} /> },
              { label: "Pendientes", val: String(resumen.pendientes), color: "#E65100", icon: <RotateCcw size={14} /> },
              { label: "Aprobados", val: String(resumen.aprobados), color: "#2E7D32", icon: <CheckCircle2 size={14} /> },
              { label: "Rechazados", val: String(resumen.rechazados), color: "#6B7F8C", icon: <XCircle size={14} /> },
            ].map(item => (
              <div key={item.label} className="panel" style={{ padding: "12px 16px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#6B7F8C", marginBottom: 4, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {item.icon} {item.label}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: item.color }}>{item.val}</div>
              </div>
            ))}
          </div>

          {/* Barra de acciones */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            {(["perfil","problemas","datos"] as const).map(t => (
              <button key={t} onClick={() => setTabActiva(t)} style={{
                padding: "8px 16px", borderRadius: 8, border: "1.5px solid",
                borderColor: tabActiva === t ? "#C4501A" : "#DDE3E8",
                background: tabActiva === t ? "#FEF3EE" : "#fff",
                color: tabActiva === t ? "#C4501A" : "#3D4F5C",
                fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "var(--font-inter)",
              }}>
                {t === "perfil" ? <><FolderTree size={16} /> Perfil de columnas</> : t === "problemas" ? <><AlertTriangle size={16} /> Problemas ({resumen.total})</> : <><ClipboardList size={16} /> Datos crudos</>}
              </button>
            ))}
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button onClick={() => aprobarTodos()} style={{ padding:"8px 14px",borderRadius:8,border:"1.5px solid #2E7D32",background:"#EFF7EF",color:"#2E7D32",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"var(--font-inter)" }}>
                ✅ Aprobar todos los pendientes
              </button>
              {resumen.aprobados > 0 && (
                <button
                  onClick={() => {
                    const fuenteLabel = FUENTES_LAB.find(f => f.id === fuenteId)?.label ?? "datos";
                    exportarCSV(filasNormalizadas, `normalizados_${fuenteLabel.replace(/\s+/g,"_")}`);
                    mostrarToast(`📥 Descargando ${filasNormalizadas.length.toLocaleString("es-CO")} filas con ${totalCambios.toLocaleString("es-CO")} cambios aplicados`);
                  }}
                  style={{ padding:"8px 14px",borderRadius:8,border:"1.5px solid #2E7D32",background:"#2E7D32",color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"var(--font-inter)" }}
                >
                  📥 Descargar CSV normalizado ({totalCambios.toLocaleString("es-CO")} cambios)
                </button>
              )}
              <button onClick={() => { setPaso("exportar"); }} style={{ padding:"8px 14px",borderRadius:8,border:"1.5px solid #0277BD",background:"#EFF6FC",color:"#0277BD",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"var(--font-inter)" }}>
                📤 Ver código de reglas
              </button>
              <button onClick={() => { setPaso("selector"); setFilas([]); setPerfiles([]); setProblemas([]); }} style={{ padding:"8px 14px",borderRadius:8,border:"1.5px solid #DDE3E8",background:"#fff",color:"#6B7F8C",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"var(--font-inter)" }}>
                ↺ Cambiar fuente
              </button>
            </div>
          </div>

          {/* ── TAB: Perfilado de columnas ── */}
          {tabActiva === "perfil" && (
            <div className="panel">
              <div className="panel-header">
                <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FolderTree size={18} /> 
                  Perfil de Columnas – {FUENTES_LAB.find(f=>f.id===fuenteId)?.label}
                </span>
                <span style={{ fontSize: 12, color: "#6B7F8C" }}>{perfiles.length} columnas · {filas.length.toLocaleString("es-CO")} filas</span>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Columna</th>
                      <th>Tipo detectado</th>
                      <th style={{ textAlign: "right" }}>Nulos</th>
                      <th style={{ textAlign: "right" }}>% Nulos</th>
                      <th style={{ textAlign: "right" }}>Únicos</th>
                      <th style={{ textAlign: "right" }}>Long. min/max</th>
                      <th>Muestras de valores</th>
                      <th style={{ textAlign: "center" }}>Problemas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perfiles.map((p, i) => {
                      const TIPO_COLOR: Record<string, string> = {
                        texto:"#3D4F5C",numero:"#0277BD",fecha:"#2E7D32",
                        moneda:"#6A1B9A",codigo:"#E65100",mixto:"#C62828",desconocido:"#6B7F8C",
                      };
                      return (
                        <tr key={i}>
                          <td style={{ fontWeight: 700, color: "#1A2530", fontFamily: "monospace", fontSize: 12 }}>{p.nombre}</td>
                          <td>
                            <span style={{
                              background: "#F5F7F8", color: TIPO_COLOR[p.tipoDatos] ?? "#3D4F5C",
                              fontWeight: 700, fontSize: 10, padding: "2px 8px", borderRadius: 99,
                              border: `1px solid ${TIPO_COLOR[p.tipoDatos]}30`,
                            }}>{p.tipoDatos}</span>
                          </td>
                          <td style={{ textAlign: "right", color: p.nulos > 0 ? "#C62828" : "#6B7F8C", fontFamily: "monospace", fontSize: 12 }}>{p.nulos}</td>
                          <td style={{ textAlign: "right", color: p.pctNulos > 10 ? "#C62828" : "#6B7F8C", fontSize: 12 }}>
                            {p.pctNulos.toFixed(1)}%
                            {p.pctNulos > 0 && <div style={{ height: 3, background: p.pctNulos > 20 ? "#FFCDD2" : "#FFF3E0", borderRadius: 99, marginTop: 3 }}>
                              <div style={{ height: 3, width: `${Math.min(p.pctNulos, 100)}%`, background: p.pctNulos > 20 ? "#C62828" : "#E65100", borderRadius: 99 }} />
                            </div>}
                          </td>
                          <td style={{ textAlign: "right", fontFamily: "monospace", fontSize: 12 }}>{p.unicos.toLocaleString("es-CO")}</td>
                          <td style={{ textAlign: "right", fontFamily: "monospace", fontSize: 11, color: "#6B7F8C" }}>{p.longMin} / {p.longMax}</td>
                          <td style={{ maxWidth: 260 }}>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                              {p.muestras.slice(0, 5).map((m, j) => (
                                <span key={j} style={{ background: "#F5F7F8", border: "1px solid #DDE3E8", borderRadius: 4, padding: "1px 5px", fontSize: 10, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block" }} title={m}>{m || "—"}</span>
                              ))}
                            </div>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {p.problemas > 0 ? (
                              <span style={{ background: "#FFF0F0", color: "#C62828", fontWeight: 800, fontSize: 12, padding: "3px 8px", borderRadius: 99, border: "1px solid #FFCDD2" }}>
                                {p.problemas}
                              </span>
                            ) : (
                              <span style={{ color: "#2E7D32", fontWeight: 700, fontSize: 12 }}>✓</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── TAB: Problemas ── */}
          {tabActiva === "problemas" && (
            <div>
              {/* Filtros y acciones */}
              <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
                <select className="select-filter" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value as TipoProblema | "todos")}>
                  <option value="todos">Todos los tipos ({resumen.total})</option>
                  {resumen.porTipo.map(([tipo, cnt]) => (
                    <option key={tipo} value={tipo}>{PROBLEMA_INFO[tipo as TipoProblema]?.label ?? tipo} ({cnt})</option>
                  ))}
                </select>
                <select className="select-filter" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as typeof filtroEstado)}>
                  <option value="todos">Todos los estados</option>
                  <option value="pendiente">Pendientes ({resumen.pendientes})</option>
                  <option value="aprobado">Aprobados ({resumen.aprobados})</option>
                  <option value="rechazado">Rechazados ({resumen.rechazados})</option>
                </select>
                <span style={{ fontSize: 12, color: "#6B7F8C" }}>{problemasFiltrados.length} resultados</span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  {filtroTipo !== "todos" && (
                    <>
                      <button onClick={() => aprobarTodos(filtroTipo as TipoProblema)} style={{ padding:"6px 12px",borderRadius:6,border:"1.5px solid #2E7D32",background:"#EFF7EF",color:"#2E7D32",fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"var(--font-inter)" }}>
                        ✅ Aprobar tipo
                      </button>
                      <button onClick={() => rechazarTodos(filtroTipo as TipoProblema)} style={{ padding:"6px 12px",borderRadius:6,border:"1.5px solid #C62828",background:"#FFF0F0",color:"#C62828",fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"var(--font-inter)" }}>
                        ❌ Rechazar tipo
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Lista de problemas */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {problemasFiltrados.slice(0, 100).map((prob, relIdx) => {
                  const idx = problemas.indexOf(prob);
                  const info = PROBLEMA_INFO[prob.tipo];
                  const esExpandido = problemaBuscado === idx;

                  return (
                    <div key={idx} style={{
                      border: `1.5px solid ${prob.estado === "aprobado" ? "#C8E6C9" : prob.estado === "rechazado" ? "#FFCDD2" : prob.estado === "editado" ? "#BBDEFB" : "#DDE3E8"}`,
                      borderRadius: 8, background: prob.estado === "aprobado" ? "#F1F8F1" : prob.estado === "rechazado" ? "#FFF5F5" : "#fff",
                      overflow: "hidden",
                    }}>
                      {/* Cabecera del problema */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer" }}
                        onClick={() => setProblema(esExpandido ? null : idx)}>
                        <span style={{
                          background: info.bg, color: info.color,
                          fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
                          border: `1px solid ${info.color}30`, whiteSpace: "nowrap", flexShrink: 0,
                        }}>{info.icon} {info.label}</span>

                        <span style={{ fontFamily: "monospace", fontSize: 11, color: "#0277BD", fontWeight: 600, flexShrink: 0 }}>
                          [{prob.columna}]
                        </span>

                        <span style={{ flex: 1, fontSize: 12, color: "#1A2530", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <strong>{JSON.stringify(prob.valor)}</strong>
                          <span style={{ color: "#6B7F8C", margin: "0 6px" }}>→</span>
                          <span style={{ color: "#2E7D32" }}>{JSON.stringify(prob.estado === "editado" && prob.valorEditado ? prob.valorEditado : prob.sugerencia)}</span>
                        </span>

                        <span style={{ fontSize: 11, color: "#6B7F8C", flexShrink: 0 }}>×{prob.frecuencia}</span>

                        {/* Estado badge */}
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
                          background: prob.estado === "aprobado" ? "#C8E6C9" : prob.estado === "rechazado" ? "#FFCDD2" : prob.estado === "editado" ? "#BBDEFB" : "#F5F7F8",
                          color: prob.estado === "aprobado" ? "#2E7D32" : prob.estado === "rechazado" ? "#C62828" : prob.estado === "editado" ? "#0277BD" : "#6B7F8C",
                          border: "1px solid transparent", flexShrink: 0,
                        }}>
                          {prob.estado === "aprobado" ? "✅ Aprobado" : prob.estado === "rechazado" ? "❌ Rechazado" : prob.estado === "editado" ? "✏️ Editado" : "⏳ Pendiente"}
                        </span>

                        <span style={{ fontSize: 12, color: "#6B7F8C", flexShrink: 0 }}>{esExpandido ? "▲" : "▼"}</span>
                      </div>

                      {/* Panel expandido */}
                      {esExpandido && (
                        <div style={{ borderTop: "1px solid #DDE3E8", padding: "14px 16px", background: "#FAFBFC" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#6B7F8C", marginBottom: 4 }}>Valor original</div>
                              <div style={{ fontFamily: "monospace", fontSize: 13, color: "#C62828", background: "#FFF0F0", padding: "8px 10px", borderRadius: 6, border: "1px solid #FFCDD2", wordBreak: "break-all" }}>
                                {JSON.stringify(prob.valor)}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#6B7F8C", marginBottom: 4 }}>Sugerencia automática</div>
                              <div style={{ fontFamily: "monospace", fontSize: 13, color: "#2E7D32", background: "#EFF7EF", padding: "8px 10px", borderRadius: 6, border: "1px solid #C8E6C9", wordBreak: "break-all" }}>
                                {JSON.stringify(prob.sugerencia)}
                              </div>
                            </div>
                          </div>

                          {/* Campo de edición */}
                          <div style={{ marginBottom: 14 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#6B7F8C", marginBottom: 4 }}>
                              ✏️ Valor de reemplazo (editable)
                            </div>
                            <input
                              type="text"
                              value={prob.valorEditado ?? prob.sugerencia}
                              onChange={e => actualizarProblema(idx, { valorEditado: e.target.value, estado: "editado" })}
                              style={{
                                width: "100%", padding: "8px 12px", border: "1.5px solid #0277BD",
                                borderRadius: 6, fontSize: 13, fontFamily: "monospace",
                                outline: "none", boxSizing: "border-box",
                              }}
                            />
                          </div>

                          {/* Botones de acción */}
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={(e) => {
                              e.stopPropagation();
                              actualizarProblema(idx, { estado: "aprobado" });
                              setFiltroEstado("todos");
                              mostrarToast("✅ Corrección aprobada");
                            }} style={{
                              padding: "8px 16px", borderRadius: 6, border: "1.5px solid #2E7D32",
                              background: "#EFF7EF", color: "#2E7D32", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "var(--font-inter)",
                            }}>✅ Aprobar</button>
                            <button onClick={(e) => {
                              e.stopPropagation();
                              actualizarProblema(idx, { estado: "editado", valorEditado: prob.valorEditado ?? prob.sugerencia });
                              setFiltroEstado("todos");
                              mostrarToast("✏️ Corrección editada y aprobada");
                            }} style={{
                              padding: "8px 16px", borderRadius: 6, border: "1.5px solid #0277BD",
                              background: "#EFF6FC", color: "#0277BD", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "var(--font-inter)",
                            }}>✏️ Aprobar con edición</button>
                            <button onClick={(e) => {
                              e.stopPropagation();
                              actualizarProblema(idx, { estado: "rechazado" });
                              setFiltroEstado("todos");
                              mostrarToast("❌ Corrección rechazada");
                            }} style={{
                              padding: "8px 16px", borderRadius: 6, border: "1.5px solid #DDE3E8",
                              background: "#FFF5F5", color: "#C62828", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "var(--font-inter)",
                            }}>❌ Rechazar</button>
                            <button onClick={(e) => {
                              e.stopPropagation();
                              actualizarProblema(idx, { estado: "pendiente", valorEditado: undefined });
                            }} style={{
                              padding: "8px 16px", borderRadius: 6, border: "1.5px solid #DDE3E8",
                              background: "#fff", color: "#6B7F8C", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "var(--font-inter)",
                            }}>↺ Resetear</button>
                          </div>

                          {prob.filas.length > 0 && (
                            <div style={{ marginTop: 10, fontSize: 11, color: "#6B7F8C" }}>
                              📋 Filas afectadas: {prob.filas.slice(0, 10).map(f => `#${f + 1}`).join(", ")}{prob.filas.length > 10 ? ` +${prob.filas.length - 10} más` : ""}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {problemasFiltrados.length === 0 && (
                  <div style={{ textAlign: "center", padding: 40, color: "#6B7F8C" }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>🎉</div>
                    <div style={{ fontWeight: 700 }}>No hay problemas con ese filtro</div>
                  </div>
                )}
                {problemasFiltrados.length > 100 && (
                  <div style={{ textAlign: "center", fontSize: 12, color: "#6B7F8C", padding: 12 }}>
                    Mostrando los primeros 100 de {problemasFiltrados.length}. Usa los filtros para reducir.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB: Datos crudos ── */}
          {tabActiva === "datos" && (
            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">📋 Datos {verNormalizados ? "normalizados ✨" : "crudos"}</span>
                <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                  {resumen.aprobados > 0 && (
                    <button
                      onClick={() => setVerNormalizados(v => !v)}
                      style={{
                        padding:"5px 12px",borderRadius:6,fontSize:11,fontWeight:700,fontFamily:"var(--font-inter)",cursor:"pointer",
                        border:`1.5px solid ${verNormalizados ? "#2E7D32" : "#DDE3E8"}`,
                        background: verNormalizados ? "#EFF7EF" : "#fff",
                        color: verNormalizados ? "#2E7D32" : "#6B7F8C",
                      }}
                    >
                      {verNormalizados ? "✨ Mostrando normalizados" : "👁 Ver normalizados"}
                    </button>
                  )}
                  <span style={{ fontSize: 12, color: "#6B7F8C" }}>
                    Fila {paginaDatos * PAGE + 1}–{Math.min((paginaDatos+1)*PAGE, filasActuales.length)} de {filasActuales.length}
                  </span>
                </div>
              </div>
              {verNormalizados && totalCambios > 0 && (
                <div style={{ padding:"10px 16px",background:"#EFF7EF",borderBottom:"1px solid #C8E6C9",fontSize:12,color:"#2E7D32",display:"flex",flexWrap:"wrap",gap:12 }}>
                  <strong>✅ {totalCambios.toLocaleString("es-CO")} celdas corregidas en:</strong>
                  {Object.entries(cambiosPorColumna).map(([col, n]) => (
                    <span key={col} style={{ background:"#C8E6C9",borderRadius:4,padding:"1px 8px",fontFamily:"monospace",fontSize:11 }}>
                      {col}: {n.toLocaleString("es-CO")}
                    </span>
                  ))}
                </div>
              )}
              <div className="table-wrapper" style={{ maxHeight: 500 }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 40, textAlign: "center" }}>#</th>
                      {columnas.map(c => (
                        <th key={c} style={{ position:"relative" }}>
                          {c}
                          {cambiosPorColumna[c] && (
                            <span style={{ marginLeft:4,background:"#C8E6C9",color:"#2E7D32",fontSize:9,fontWeight:800,borderRadius:99,padding:"1px 5px" }}>
                              {cambiosPorColumna[c]}
                            </span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {datosPag.map((fila, i) => (
                      <tr key={i}>
                        <td style={{ textAlign: "center", color: "#B0BEC5", fontFamily: "monospace", fontSize: 11 }}>
                          {paginaDatos * PAGE + i + 1}
                        </td>
                        {columnas.map(c => {
                          const v = fila[c];
                          const str = v === null || v === undefined ? "" : String(v);
                          // Resaltar: si normalizado → celda verde; si original y era un valor corregido → amarillo
                          const originalFila = filas[paginaDatos * PAGE + i];
                          const eraCorregido = verNormalizados && valoresCorregidos[c]?.has(String(originalFila?.[c] ?? ""));
                          const eraProblema = !verNormalizados && problemas.some(p => p.columna === c && p.valor === str && p.estado === "pendiente");
                          return (
                            <td key={c} style={{
                              maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              background: eraCorregido ? "#F1FBF1" : eraProblema ? "#FFFDE7" : undefined,
                              fontSize: 12,
                              color: eraCorregido ? "#2E7D32" : undefined,
                              fontWeight: eraCorregido ? 600 : undefined,
                            }} title={`${str}${eraCorregido ? " (corregido)" : ""}`}>
                              {str || <span style={{ color: "#DDE3E8" }}>—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Paginación datos */}
              {totalPags > 1 && (
                <div style={{ padding: "12px 16px", borderTop: "1px solid #DDE3E8", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <button disabled={paginaDatos === 0} onClick={() => setPaginaDatos(p => p - 1)}
                    style={{ padding:"6px 14px",border:"1px solid #DDE3E8",borderRadius:6,background:"transparent",cursor:paginaDatos===0?"not-allowed":"pointer",fontSize:12,color:paginaDatos===0?"#DDE3E8":"#3D4F5C",fontWeight:600,fontFamily:"var(--font-inter)" }}>
                    ← Anterior
                  </button>
                  <span style={{ fontSize: 12, color: "#6B7F8C" }}>Página {paginaDatos + 1} de {totalPags}</span>
                  <button disabled={paginaDatos >= totalPags - 1} onClick={() => setPaginaDatos(p => p + 1)}
                    style={{ padding:"6px 14px",border:"1px solid #DDE3E8",borderRadius:6,background:"transparent",cursor:paginaDatos>=totalPags-1?"not-allowed":"pointer",fontSize:12,color:paginaDatos>=totalPags-1?"#DDE3E8":"#3D4F5C",fontWeight:600,fontFamily:"var(--font-inter)" }}>
                    Siguiente →
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── EXPORTAR REGLAS ── */}
      {paso === "exportar" && (
        <div>
          <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
            <button onClick={() => setPaso("perfilado")} style={{ padding:"8px 16px",borderRadius:8,border:"1.5px solid #DDE3E8",background:"#fff",color:"#3D4F5C",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"var(--font-inter)" }}>
              ← Volver al laboratorio
            </button>
            <span style={{ fontSize: 13, color: "#6B7F8C" }}>
              {resumen.aprobados} reglas aprobadas de {resumen.total} problemas detectados
            </span>
          </div>

          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">📤 Código para <code style={{ fontFamily:"monospace",background:"#F5F7F8",padding:"2px 6px",borderRadius:4 }}>normalizacion.ts</code></span>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(codigoExport);
                  setCopiado(true);
                  setTimeout(() => setCopiado(false), 2000);
                }}
                style={{ padding:"6px 14px",borderRadius:6,border:"1.5px solid #0277BD",background:"#EFF6FC",color:"#0277BD",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"var(--font-inter)" }}
              >
                {copiado ? "✅ Copiado!" : "📋 Copiar código"}
              </button>
            </div>
            <div className="panel-body">
              {resumen.aprobados === 0 ? (
                <div style={{ textAlign: "center", padding: 32, color: "#6B7F8C" }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>💡</div>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Aún no hay reglas aprobadas</div>
                  <div style={{ fontSize: 13 }}>Vuelve al Tab de Problemas y aprueba las correcciones que desees aplicar.</div>
                </div>
              ) : (
                <pre style={{
                  background: "#1E2A35", color: "#A8D8A8",
                  padding: "20px 24px", borderRadius: 8,
                  fontFamily: "monospace", fontSize: 12, lineHeight: 1.7,
                  overflowX: "auto", margin: 0,
                }}>
                  {codigoExport}
                </pre>
              )}

              {resumen.aprobados > 0 && (
                <div style={{ marginTop: 16, padding: "14px 16px", background: "#EFF6FC", border: "1px solid #C0DEEE", borderRadius: 8 }}>
                  <div style={{ fontWeight: 700, color: "#0277BD", marginBottom: 8, fontSize: 13 }}>
                    ℹ️ Instrucciones de integración
                  </div>
                  <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#3D4F5C", lineHeight: 1.9 }}>
                    <li>Copia el código generado arriba</li>
                    <li>Abre <code style={{ fontFamily:"monospace",background:"#F5F7F8",padding:"1px 5px",borderRadius:3 }}>lib/normalizacion.ts</code></li>
                    <li>Pega los nuevos objetos de reemplazos junto a los existentes</li>
                    <li>Exporta las funciones normalizadoras que usen estas reglas</li>
                    <li>Actualiza los <code style={{ fontFamily:"monospace",background:"#F5F7F8",padding:"1px 5px",borderRadius:3 }}>page.tsx</code> de cada módulo para usar las nuevas funciones</li>
                  </ol>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast de confirmación */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          background: "#1A2530", color: "#fff",
          padding: "12px 20px", borderRadius: 10,
          fontWeight: 700, fontSize: 13, fontFamily: "var(--font-inter)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
          animation: "fadeInUp 0.2s ease",
        }}>
          {toast}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeInUp { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
}

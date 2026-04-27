"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { useQuery } from "@tanstack/react-query";
import { cargarOperadoras, cargarDaneMunicipios, diagnosticarLista, Operadora, DaneMunicipio } from "@/lib/catalogos";
import { 
  Library, 
  Building2, 
  Map, 
  Search, 
  RotateCcw, 
  Loader2, 
  AlertCircle, 
  Database, 
  ChevronRight,
  RefreshCcw
} from "lucide-react";

const SUPERADMIN_EMAIL = "ctriana@acp.com.co";

export default function CatalogosPage() {
  const { accounts, instance } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const router = useRouter();
  const account = accounts[0];
  const esSuperAdmin = account?.username?.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase();

  const [msalListo, setMsalListo] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMsalListo(true), 600); return () => clearTimeout(t); }, []);
  useEffect(() => {
    if (!msalListo) return;
    if (!isAuthenticated) { router.replace("/"); return; }
    if (!esSuperAdmin) router.replace("/dashboard");
  }, [msalListo, isAuthenticated, esSuperAdmin, router]);

  const [tab, setTab] = useState<"operadoras" | "dane">("operadoras");
  const [busquedaOp, setBusquedaOp] = useState("");
  const [busquedaDane, setBusquedaDane] = useState("");
  const [filtroDpto, setFiltroDpto] = useState("Todos");
  const [diagDane, setDiagDane] = useState<{ columnas: string[]; muestras: Record<string,unknown>[] } | null>(null);
  const [loadingDiag, setLoadingDiag] = useState(false);

  const hacerDiagnostico = useCallback(async () => {
    if (!account) return;
    setLoadingDiag(true);
    try {
      const r = await diagnosticarLista("datosBIACP", "Departamentos Municipios DANE", instance, account);
      setDiagDane(r);
    } catch(e) { setDiagDane({ columnas: [String(e)], muestras: [] }); }
    finally { setLoadingDiag(false); }
  }, [instance, account]);

  // ─── Cargar catálogos ─────────────────────────────────────────────────────
  const { data: operadoras = [], isLoading: loadOp, error: errOp } = useQuery<Operadora[]>({
    queryKey: ["catalogo-operadoras"],
    queryFn: () => cargarOperadoras(instance, account!),
    enabled: msalListo && !!account,
    staleTime: 30 * 60 * 1000,
  });

  const { data: dane = [], isLoading: loadDane, error: errDane } = useQuery<DaneMunicipio[]>({
    queryKey: ["catalogo-dane"],
    queryFn: () => cargarDaneMunicipios(instance, account!),
    enabled: msalListo && !!account,
    staleTime: 30 * 60 * 1000,
  });

  // ─── Filtros ──────────────────────────────────────────────────────────────
  const opFiltradas = operadoras.filter(o =>
    !busquedaOp || o.nombre.toLowerCase().includes(busquedaOp.toLowerCase()) ||
    o.alias.some(a => a.toLowerCase().includes(busquedaOp.toLowerCase()))
  );

  const dptos = ["Todos", ...Array.from(new Set(dane.map(d => d.departamento))).sort()];
  const daneFiltrado = dane.filter(d => {
    if (filtroDpto !== "Todos" && d.departamento !== filtroDpto) return false;
    if (busquedaDane && !d.municipio.toLowerCase().includes(busquedaDane.toLowerCase()) &&
        !d.departamento.toLowerCase().includes(busquedaDane.toLowerCase())) return false;
    return true;
  });

  if (!msalListo) return (
    <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:400,gap:16 }}>
      <RotateCcw size={40} className="animate-spin-slow" style={{ color: "var(--color-primary)" }} />
      <div style={{ color:"#6B7F8C",fontSize:14, fontWeight: 600 }}>Verificando acceso...</div>
    </div>
  );
  if (!isAuthenticated || !esSuperAdmin) return null;

  const isLoading = loadOp || loadDane;

  return (
    <div>
      <div className="page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Library size={32} strokeWidth={2.5} style={{ color: "var(--color-primary)" }} />
          Catálogos Maestros de Normalización
        </h1>
        <p>Listas de referencia SharePoint · Sitio: EquipoACP-DatosBI-ACP</p>
      </div>

      {/* Tarjetas resumen */}
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:20 }}>
        {[
          {
            label:"Empresas Operadoras",
            count: operadoras.length,
            subtitulo:"Lista SharePoint · Nombres canónicos",
            color:"#C4501A", icon: <Building2 size={24} />,
            loading: loadOp, error: errOp,
            lista:"Empresas Operadoras",
          },
          {
            label:"Municipios DANE (DIVIPOLA)",
            count: dane.length,
            subtitulo:`${new Set(dane.map(d=>d.departamento)).size} departamentos`,
            color:"#0277BD", icon: <Map size={24} />,
            loading: loadDane, error: errDane,
            lista:"Departamentos Municipios DANE",
          },
        ].map(item => (
          <div key={item.label} className="panel" style={{ padding:"20px 24px",borderTop:`4px solid ${item.color}` }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
              <div>
                <div style={{ fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.6px",color:"#6B7F8C",marginBottom:4, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {item.icon} {item.label}
                </div>
                {item.loading ? (
                  <div style={{ display:"flex",alignItems:"center",gap:8,color:"#6B7F8C",fontSize:13 }}>
                    <RotateCcw size={16} className="animate-spin-slow" style={{ color: item.color }} />
                    Cargando desde SharePoint...
                  </div>
                ) : item.error ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color:"#C62828",fontSize:12 }}>
                    <AlertCircle size={14} /> Error: {String(item.error)}
                  </div>
                ) : (
                  <div style={{ fontSize:32,fontWeight:800,color:item.color }}>{item.count.toLocaleString("es-CO")}</div>
                )}
                <div style={{ fontSize:11,color:"#6B7F8C",marginTop:4 }}>{item.subtitulo}</div>
              </div>
              <div style={{ color: item.color, opacity: 0.2 }}>{item.icon}</div>
            </div>
            <div style={{ marginTop:12,padding:"6px 10px",background:"#F5F7F8",borderRadius:6,fontFamily:"monospace",fontSize:10,color:"#6B7F8C",lineHeight:1.5 }}>
              🔗 /sites/EquipoACP-DatosBI-ACP/Lists/{item.lista}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:"flex",gap:8,marginBottom:16 }}>
        {(["operadoras","dane"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding:"9px 18px",borderRadius:8,border:"1.5px solid",
            borderColor: tab===t ? "#C4501A" : "#DDE3E8",
            background: tab===t ? "#FEF3EE" : "#fff",
            color: tab===t ? "#C4501A" : "#3D4F5C",
            fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"var(--font-inter)",
            display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            {t === "operadoras" ? <><Building2 size={16} /> Operadoras ({operadoras.length})</> : <><Map size={16} /> DANE Municipios ({dane.length})</>}
          </button>
        ))}
      </div>

      {/* ── Tab Operadoras ── */}
      {tab === "operadoras" && (
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">🏢 Empresas Operadoras – Catálogo Maestro</span>
            <input
              type="search" placeholder="Buscar operadora..."
              value={busquedaOp} onChange={e => setBusquedaOp(e.target.value)}
              style={{ padding:"6px 12px",border:"1px solid #DDE3E8",borderRadius:6,fontSize:12,fontFamily:"var(--font-inter)",outline:"none",minWidth:220 }}
            />
          </div>
          {loadOp ? (
            <div style={{ display:"flex",alignItems:"center",justifyContent:"center",padding:48,gap:12,color:"#6B7F8C" }}>
              <RotateCcw size={24} className="animate-spin-slow" style={{ color: "#C4501A" }} />
              Cargando catálogo de operadoras desde SharePoint...
            </div>
          ) : (
            <>
              <div style={{ padding:"8px 16px",background:"#F5F7F8",borderBottom:"1px solid #DDE3E8",fontSize:12,color:"#6B7F8C" }}>
                Mostrando {opFiltradas.length} de {operadoras.length} operadoras
              </div>
              <div className="table-wrapper" style={{ maxHeight:560 }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width:40,textAlign:"center" }}>#</th>
                      <th>Nombre Canónico (oficial)</th>
                      <th>Alias / Variantes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opFiltradas.map((op, i) => (
                      <tr key={op.id || i}>
                        <td style={{ textAlign:"center",color:"#B0BEC5",fontFamily:"monospace",fontSize:11 }}>{i+1}</td>
                        <td style={{ fontWeight:700,color:"#1A2530" }}>{op.nombre}</td>
                        <td>
                          <div style={{ display:"flex",flexWrap:"wrap",gap:4 }}>
                            {op.alias.length > 0 ? op.alias.map((a,j) => (
                              <span key={j} style={{ background:"#F5F7F8",border:"1px solid #DDE3E8",borderRadius:4,padding:"1px 6px",fontSize:11,color:"#6B7F8C" }}>
                                {a}
                              </span>
                            )) : <span style={{ color:"#DDE3E8",fontSize:11 }}>—</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Tab DANE ── */}
      {tab === "dane" && (
        <div className="panel">
          <div className="panel-header" style={{ flexWrap:"wrap",gap:8 }}>
            <span className="panel-title">🗺️ Municipios DANE (DIVIPOLA)</span>
            <div style={{ display:"flex",gap:8,marginLeft:"auto" }}>
              <select className="select-filter" value={filtroDpto} onChange={e => setFiltroDpto(e.target.value)}>
                {dptos.map(d => <option key={d}>{d}</option>)}
              </select>
              <input
                type="search" placeholder="Buscar municipio..."
                value={busquedaDane} onChange={e => setBusquedaDane(e.target.value)}
                style={{ padding:"6px 12px",border:"1px solid #DDE3E8",borderRadius:6,fontSize:12,fontFamily:"var(--font-inter)",outline:"none",minWidth:200 }}
              />
            </div>
          </div>
          {loadDane ? (
            <div style={{ display:"flex",alignItems:"center",justifyContent:"center",padding:48,gap:12,color:"#6B7F8C" }}>
              <RotateCcw size={24} className="animate-spin-slow" style={{ color: "#0277BD" }} />
              Cargando catálogo DANE desde SharePoint...
            </div>
          ) : dane.length === 0 ? (
            <div style={{ padding:24 }}>
              <div style={{ background:"#FFF8E1",border:"1px solid #FFD600",borderRadius:8,padding:"16px 20px",marginBottom:16 }}>
                <div style={{ fontWeight:700,fontSize:13,color:"#F57F17",marginBottom:6 }}>⚠️ Lista cargada pero sin municipios reconocidos</div>
                <div style={{ fontSize:12,color:"#6B7F8C" }}>Los nombres internos de las columnas en SharePoint no coinciden con los patrones esperados. Haz clic en "Diagnosticar" para ver las columnas reales.</div>
              </div>
              <button onClick={hacerDiagnostico} disabled={loadingDiag} style={{
                padding:"9px 18px",background:"#0277BD",color:"#fff",border:"none",borderRadius:8,
                fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"var(--font-inter)",marginBottom:16,
                opacity: loadingDiag ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '8px'
              }}>
                {loadingDiag ? <RotateCcw size={16} className="animate-spin-slow" /> : <Search size={16} />}
                {loadingDiag ? "Consultando SharePoint..." : "Diagnosticar columnas reales"}
              </button>
              {diagDane && (
                <div>
                  <div style={{ fontWeight:700,fontSize:12,color:"#3D4F5C",marginBottom:8 }}>Columnas reales de la lista ({diagDane.columnas.length}):</div>
                  <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginBottom:16 }}>
                    {diagDane.columnas.map((c,i) => (
                      <span key={i} style={{ background:"#E3F2FD",border:"1px solid #90CAF9",borderRadius:4,padding:"2px 8px",fontSize:11,fontFamily:"monospace",color:"#0277BD" }}>{c}</span>
                    ))}
                  </div>
                  {diagDane.muestras.length > 0 && (
                    <>
                      <div style={{ fontWeight:700,fontSize:12,color:"#3D4F5C",marginBottom:8 }}>Primer item de muestra:</div>
                      <pre style={{ background:"#F5F7F8",border:"1px solid #DDE3E8",borderRadius:8,padding:16,fontSize:10,overflow:"auto",maxHeight:300,lineHeight:1.6 }}>
                        {JSON.stringify(diagDane.muestras[0], null, 2)}
                      </pre>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              <div style={{ padding:"8px 16px",background:"#F5F7F8",borderBottom:"1px solid #DDE3E8",fontSize:12,color:"#6B7F8C" }}>
                Mostrando {Math.min(daneFiltrado.length, 500)} de {daneFiltrado.length} municipios
              </div>
              <div className="table-wrapper" style={{ maxHeight:560 }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ textAlign:"center" }}>Cód. Dpto</th>
                      <th>Departamento</th>
                      <th style={{ textAlign:"center" }}>Cód. DIVIPOLA</th>
                      <th>Municipio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {daneFiltrado.slice(0, 500).map((d, i) => (
                      <tr key={i}>
                        <td style={{ textAlign:"center",fontFamily:"monospace",fontWeight:700,color:"#C4501A",fontSize:12 }}>{d.codigoDpto}</td>
                        <td style={{ fontWeight:600,color:"#1A2530" }}>{d.departamento}</td>
                        <td style={{ textAlign:"center",fontFamily:"monospace",color:"#0277BD",fontSize:12 }}>{d.codigoMpio}</td>
                        <td>{d.municipio}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {daneFiltrado.length > 500 && (
                <div style={{ padding:"10px 16px",borderTop:"1px solid #DDE3E8",fontSize:12,color:"#6B7F8C",textAlign:"center" }}>
                  Mostrando 500 de {daneFiltrado.length}. Usa los filtros para reducir.
                </div>
              )}
            </>
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

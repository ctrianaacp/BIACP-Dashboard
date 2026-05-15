"use client";
import { useMsal } from "@azure/msal-react";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useState, useMemo } from "react";
import MapaPetroleoPage from "./MapaPetroleo";
import { fetchExcelXLSX, SHAREPOINT_FILES } from "@/lib/graphClient";
import { 
  Droplets, 
  MapPin, 
  Building2, 
  Map, 
  Search, 
  X, 
  RotateCcw, 
  Calendar, 
  CalendarDays,
  Home,
  Briefcase,
  Users,
  Star,
  BarChart2
} from "lucide-react";
import { 
  normalizarOperadora, 
  normalizarDepartamento, 
  normalizarMunicipio 
} from "@/lib/normalizacion";
import Loading from "@/components/Loading";
import { formatNum, formatAbbr, formatCurrency } from "@/lib/formatters";
import { CheckCircle2 } from "lucide-react";
import MultiSelect from "@/components/MultiSelect";
import ExportButton from "@/components/ExportButton";
import DataTable from "@/components/DataTable";
import ReservasChart from "@/components/produccion/ReservasChart";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface RegistroPetroleo {
  Departamento: string;
  Municipio: string;
  Operadora: string;
  Campo: string;
  Contrato: string;
  Mes: string;
  Produccion: number;
  Fecha: string;
  MunicipioDepartamento: string;
  AfiliadaACP: string;
}

// Importar ApexCharts solo en cliente (no SSR)
const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

// ─── Helper: convierte fecha de Excel → ISO string (YYYY-MM-DD) ──────────────
// xlsx con cellDates:true → devuelve objetos Date de JS
// xlsx con raw:true → devuelve número serial de Excel
// También maneja strings con formato de fecha
function excelDateToISO(serial: unknown): string {
  if (serial === null || serial === undefined || serial === "") return "";

  // Caso 1: objeto Date de JavaScript (cuando cellDates:true en xlsx)
  if (serial instanceof Date) {
    if (isNaN(serial.getTime())) return "";
    // Usar UTC para evitar desfase de zona horaria (Colombia = UTC-5)
    const y = serial.getUTCFullYear();
    const m = String(serial.getUTCMonth() + 1).padStart(2, "0");
    const d = String(serial.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // Caso 2: string con fecha legible
  if (typeof serial === "string") {
    if (serial.trim() === "") return "";
    // Formato YYYY-MM-DD o similar con guion
    if (serial.includes("-") && serial.length >= 7) return serial.substring(0, 10);
    // Intentar parsear como fecha
    const parsed = new Date(serial);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().substring(0, 10);
    return serial;
  }

  // Caso 3: número serial de Excel (cuando raw:true)
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

// Eliminamos formatters locales

// ─── Helper: días en el mes de una fecha ISO (YYYY-MM-DD) ────────────────────
function diasEnMes(fechaISO: string): number {
  if (!fechaISO || fechaISO.length < 7) return 30;
  const [y, m] = fechaISO.split("-").map(Number);
  return new Date(y, m, 0).getDate(); // getDate() del día 0 del mes siguiente = último día del mes actual
}

// ─── Cálculo BPDC = AVERAGEX(SUMMARIZE por Año+Mes, SUM(Producción)) ────────────
// NOTA: La columna Producción en el Excel YA está en unidades Bbl/día (BPDC)
// por campo y por mes. La fórmula DAX equivalente en JS:
// 1. Por cada (Año, Mes): suma todos los BPDC de cada campo  → totalBPDC_mes
// 2. Promedia esos totalBPDC_mes a través de todos los meses  → BPDC Promedio
function calcularBPDC(registros: RegistroPetroleo[]): number {
  if (registros.length === 0) return 0;
  const porMes: Record<string, number> = {};
  for (const r of registros) {
    const key = r.Fecha.substring(0, 7); // "YYYY-MM"
    if (!key || key.length < 7) continue;
    // Produccion ya es BPDC (tasa diaria) — solo sumar por mes
    porMes[key] = (porMes[key] ?? 0) + r.Produccion;
  }
  const valores = Object.values(porMes);
  if (valores.length === 0) return 0;
  return valores.reduce((s, v) => s + v, 0) / valores.length;
}

// ─── Loader de datos vía API PostgreSQL ───────────────────────────────────────────
async function cargarPetroleo(): Promise<RegistroPetroleo[]> {
  const res = await fetch("/api/produccion?tipo=petroleo");
  if (!res.ok) throw new Error("Error cargando datos de producción");
  const data = await res.json();
  
  // Transformar strings a numbers y normalizar
  return data.map((r: any) => ({
    ...r,
    Departamento: normalizarDepartamento(r.Departamento || ""),
    Municipio: normalizarMunicipio(r.Municipio || ""),
    Operadora: normalizarOperadora(r.Operadora || ""),
    MunicipioDepartamento: `${normalizarMunicipio(r.Municipio || "")} / ${normalizarDepartamento(r.Departamento || "")}`,
    Produccion: Number(r.Produccion) || 0
  }));
}

// ─── Loader de producción distribuida por participación (dim_contratos) ────────
async function cargarPetroleoContratos(): Promise<RegistroPetroleo[]> {
  const res = await fetch("/api/produccion-contratos");
  if (!res.ok) throw new Error("Error cargando datos de producción distribuida");
  const data = await res.json();
  return data.map((r: any) => ({
    ...r,
    Departamento: normalizarDepartamento(r.Departamento || ""),
    Municipio: normalizarMunicipio(r.Municipio || ""),
    Operadora: r.Operadora || "",
    MunicipioDepartamento: `${normalizarMunicipio(r.Municipio || "")} / ${normalizarDepartamento(r.Departamento || "")}`,
    Produccion: Number(r.Produccion) || 0
  }));
}

// ─── Componente KPI ───────────────────────────────────────────────────────────
function KPICard({ label, value, unit, color, icon: Icon }: {
  label: string; value: string; unit?: string; color: string; icon: any;
}) {
  return (
    <div className={`kpi-card ${color}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">
        {value}
        {unit && <span className="kpi-unit">{unit}</span>}
      </div>
      <span className="kpi-icon"><Icon size={24} strokeWidth={2.5} /></span>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ProduccionPetroleoPage() {
  const { instance, accounts } = useMsal();
  const [activeTab, setActiveTab] = useState<'indicadores' | 'mapa' | 'contratos'>('indicadores');

  // Filtros — uno por cada columna de la tabla
  const [filtroAnios, setFiltroAnios] = useState<string[]>([]);
  const [filtroMeses, setFiltroMeses] = useState<string[]>([]);
  const [filtroDptos, setFiltroDptos] = useState<string[]>([]);
  const [filtroMunicipios, setFiltroMunicipios] = useState<string[]>([]);
  const [filtroOperadoras, setFiltroOperadoras] = useState<string[]>([]);
  const [filtroCampos, setFiltroCampos] = useState<string[]>([]);
  const [filtroContratos, setFiltroContratos] = useState<string[]>([]);
  const [filtroAfiliada, setFiltroAfiliada] = useState<string[]>([]);
  // Panel de filtros
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

  // Contador de filtros activos
  const filtrosActivos = [
    filtroAnios.length > 0,
    filtroMeses.length > 0,
    filtroDptos.length > 0,
    filtroMunicipios.length > 0,
    filtroOperadoras.length > 0,
    filtroCampos.length > 0,
    filtroContratos.length > 0,
    filtroAfiliada.length > 0,
  ].filter(Boolean).length;

  const limpiarFiltros = () => {
    setFiltroAnios([]); setFiltroMeses([]);
    setFiltroDptos([]); setFiltroMunicipios([]);
    setFiltroOperadoras([]); setFiltroCampos([]);
    setFiltroContratos([]); setFiltroAfiliada([]);
  };

  // Carga de datos generales
  const { data: registros = [], isLoading, error } = useQuery({
    queryKey: ["produccion-petroleo-pg"],
    queryFn: cargarPetroleo,
    staleTime: 10 * 60 * 1000,
    retry: 0,
  });

  // Carga de datos distribuidos por participación (solo para pestaña contratos)
  const { data: registrosContratos = [] } = useQuery({
    queryKey: ["produccion-petroleo-contratos"],
    queryFn: cargarPetroleoContratos,
    staleTime: 10 * 60 * 1000,
    retry: 0,
    enabled: activeTab === 'contratos' || registros.length > 0,
  });

  // ── Opciones de filtros en cascada: cada select muestra solo los valores
  //    presentes dado lo ya seleccionado en los filtros anteriores.
  const MESES = [
    "Todos","Enero","Febrero","Marzo","Abril","Mayo","Junio",
    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
  ];

  // Años — sobre todos los registros
  const anios = useMemo(() => {
    const set = new Set(registros.map((r) => r.Fecha.substring(0, 4)).filter(Boolean));
    return ["Todos", ...Array.from(set).sort().reverse()];
  }, [registros]);

  // Meses — filtrado por año
  const mesesDisponibles = useMemo(() => {
    const base = filtroAnios.length === 0 ? registros : registros.filter((r) => filtroAnios.some(a => r.Fecha.startsWith(a)));
    const nums = new Set(base.map((r) => parseInt(r.Fecha.substring(5, 7))).filter((n) => !isNaN(n)));
    return ["Todos", ...Array.from(nums).sort((a, b) => a - b).map((n) => MESES[n])];
  }, [registros, filtroAnios]);

  // Base parcial: año + mes aplicados (para los selects de abajo)
  const baseAnioMes = useMemo(() => registros.filter((r) => {
    if (filtroAnios.length > 0 && !filtroAnios.some(a => r.Fecha.startsWith(a))) return false;
    if (filtroMeses.length > 0) {
      const numsMeses = filtroMeses.map(m => MESES.indexOf(m));
      if (!numsMeses.includes(parseInt(r.Fecha.substring(5, 7)))) return false;
    }
    return true;
  }), [registros, filtroAnios, filtroMeses]);

  // Departamentos — filtrado por año+mes
  const departamentos = useMemo(
    () => ["Todos", ...Array.from(new Set(baseAnioMes.map((r) => r.Departamento))).sort()],
    [baseAnioMes]
  );

  // Municipios — filtrado por año+mes+dpto
  const municipios = useMemo(() => {
    const base = filtroDptos.length === 0 ? baseAnioMes : baseAnioMes.filter((r) => filtroDptos.includes(r.Departamento));
    return ["Todos", ...Array.from(new Set(base.map((r) => r.Municipio))).sort()];
  }, [baseAnioMes, filtroDptos]);

  // Operadoras — filtrado por año+mes+dpto+municipio
  const operadoras = useMemo(() => {
    let base = baseAnioMes;
    if (filtroDptos.length > 0) base = base.filter((r) => filtroDptos.includes(r.Departamento));
    if (filtroMunicipios.length > 0) base = base.filter((r) => filtroMunicipios.includes(r.Municipio));
    return ["Todas", ...Array.from(new Set(base.map((r) => r.Operadora))).sort()];
  }, [baseAnioMes, filtroDptos, filtroMunicipios]);

  // Campos — filtrado por año+mes+dpto+municipio+operadora
  const campos = useMemo(() => {
    let base = baseAnioMes;
    if (filtroDptos.length > 0) base = base.filter((r) => filtroDptos.includes(r.Departamento));
    if (filtroMunicipios.length > 0) base = base.filter((r) => filtroMunicipios.includes(r.Municipio));
    if (filtroOperadoras.length > 0) base = base.filter((r) => filtroOperadoras.includes(r.Operadora));
    return ["Todos", ...Array.from(new Set(base.map((r) => r.Campo))).sort()];
  }, [baseAnioMes, filtroDptos, filtroMunicipios, filtroOperadoras]);

  // Contratos — filtrado por año+mes+dpto+municipio+operadora+campo
  const contratosFiltrables = useMemo(() => {
    let base = baseAnioMes;
    if (filtroDptos.length > 0) base = base.filter((r) => filtroDptos.includes(r.Departamento));
    if (filtroMunicipios.length > 0) base = base.filter((r) => filtroMunicipios.includes(r.Municipio));
    if (filtroOperadoras.length > 0) base = base.filter((r) => filtroOperadoras.includes(r.Operadora));
    if (filtroCampos.length > 0) base = base.filter((r) => filtroCampos.includes(r.Campo));
    return ["Todos", ...Array.from(new Set(base.map((r) => r.Contrato || 'Sin Contrato'))).sort()];
  }, [baseAnioMes, filtroDptos, filtroMunicipios, filtroOperadoras, filtroCampos]);

  // Datos filtrados — aplica todos los filtros activos
  const filtrados = useMemo(() => {
    return registros.filter((r) => {
      if (filtroAnios.length > 0 && !filtroAnios.some(a => r.Fecha.startsWith(a))) return false;
      if (filtroMeses.length > 0) {
        const numsMeses = filtroMeses.map(m => MESES.indexOf(m));
        if (!numsMeses.includes(parseInt(r.Fecha.substring(5, 7)))) return false;
      }
      if (filtroDptos.length > 0 && !filtroDptos.includes(r.Departamento)) return false;
      if (filtroMunicipios.length > 0 && !filtroMunicipios.includes(r.Municipio)) return false;
      if (filtroOperadoras.length > 0 && !filtroOperadoras.includes(r.Operadora)) return false;
      if (filtroCampos.length > 0 && !filtroCampos.includes(r.Campo)) return false;
      if (filtroContratos.length > 0 && !filtroContratos.includes(r.Contrato || 'Sin Contrato')) return false;
      if (filtroAfiliada.length > 0 && !filtroAfiliada.includes(r.AfiliadaACP)) return false;
      return true;
    });
  }, [registros, filtroAnios, filtroMeses, filtroDptos, filtroMunicipios, filtroOperadoras, filtroCampos, filtroContratos, filtroAfiliada]);

  // KPIs agregados
  const kpis = useMemo(() => {
    // BPDC = AVERAGEX(SUMMARIZE(tabla, Año, Mes, SUM(Producción)), [ProduccionMensual])
    // Agrupa por Año+Mes, suma cada grupo, luego promedia
    const bpdc = calcularBPDC(filtrados);

    const campos = new Set(filtrados.map((r) => r.Campo)).size;
    const operadorasSet = new Set(filtrados.map((r) => r.Operadora)).size;
    const municipios = new Set(filtrados.map((r) => r.Municipio)).size;

    // Producción mensual total (para el gráfico de series temporales)
    const porFecha: Record<string, number> = {};
    filtrados.forEach((r) => {
      const key = r.Fecha.substring(0, 7);
      porFecha[key] = (porFecha[key] ?? 0) + r.Produccion;
    });

    return { bpdc, camposSet: campos, operadorasSet, municipiosSet: municipios, porFecha };
  }, [filtrados]);

  // Series para gráfico producción por mes
  const seriesMensuales = useMemo(() => {
    const sorted = Object.entries(kpis.porFecha).sort(([a], [b]) => a.localeCompare(b));
    return {
      categorias: sorted.map(([k]) => k),
      valores: sorted.map(([, v]) => Math.round(v)),
    };
  }, [kpis.porFecha]);

  // Top 10 operadoras por producción
  const topOperadoras = useMemo(() => {
    const acc: Record<string, typeof filtrados> = {};
    filtrados.forEach((r) => {
      if (!acc[r.Operadora]) acc[r.Operadora] = [];
      acc[r.Operadora].push(r);
    });
    return Object.entries(acc)
      .map(([op, regs]) => ({ op, val: calcularBPDC(regs) }))
      .sort((a, b) => b.val - a.val)
      .slice(0, 10)
      .map(o => ({ ...o, val: Math.round(o.val) }));
  }, [filtrados]);

  // Top departamentos
  const topDptos = useMemo(() => {
    const acc: Record<string, typeof filtrados> = {};
    filtrados.forEach((r) => {
      if (!acc[r.Departamento]) acc[r.Departamento] = [];
      acc[r.Departamento].push(r);
    });
    return Object.entries(acc)
      .map(([dpto, regs]) => [dpto, calcularBPDC(regs)] as [string, number])
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8);
  }, [filtrados]);

  // --- DATA DISTRIBUIDA PARA LA PESTAÑA CONTRATOS (usa producción × participación) ---
  // Filtrar los registros distribuidos con los mismos filtros activos
  const filtradosContratos = useMemo(() => {
    return registrosContratos.filter((r) => {
      if (filtroAnios.length > 0 && !filtroAnios.some(a => r.Fecha.startsWith(a))) return false;
      if (filtroMeses.length > 0) {
        const numsMeses = filtroMeses.map(m => MESES.indexOf(m));
        if (!numsMeses.includes(parseInt(r.Fecha.substring(5, 7)))) return false;
      }
      if (filtroDptos.length > 0 && !filtroDptos.includes(r.Departamento)) return false;
      if (filtroMunicipios.length > 0 && !filtroMunicipios.includes(r.Municipio)) return false;
      if (filtroOperadoras.length > 0 && !filtroOperadoras.includes(r.Operadora)) return false;
      if (filtroCampos.length > 0 && !filtroCampos.includes(r.Campo)) return false;
      if (filtroContratos.length > 0 && !filtroContratos.includes(r.Contrato || 'Sin Contrato')) return false;
      if (filtroAfiliada.length > 0 && !filtroAfiliada.includes(r.AfiliadaACP)) return false;
      return true;
    });
  }, [registrosContratos, filtroAnios, filtroMeses, filtroDptos, filtroMunicipios, filtroOperadoras, filtroCampos, filtroContratos, filtroAfiliada]);

  // Top operadoras con desglose de contratos (usando datos DISTRIBUIDOS)
  const operadoraContratos = useMemo(() => {
    const acc: Record<string, Record<string, typeof filtradosContratos>> = {};
    filtradosContratos.forEach((r) => {
      if (!acc[r.Operadora]) acc[r.Operadora] = {};
      const contratoStr = r.Contrato || 'Sin Contrato';
      if (!acc[r.Operadora][contratoStr]) acc[r.Operadora][contratoStr] = [];
      acc[r.Operadora][contratoStr].push(r);
    });

    const operadorasTotal = Object.entries(acc).map(([op, contratos]) => {
      const bpcdPorContrato: Record<string, number> = {};
      let total = 0;
      Object.entries(contratos).forEach(([c, regs]) => {
        const val = calcularBPDC(regs);
        bpcdPorContrato[c] = val;
        total += val;
      });
      return { op, total, bpcdPorContrato };
    });

    const topOps = operadorasTotal.sort((a, b) => b.total - a.total).slice(0, 15);
    const todosLosContratos = new Set<string>();
    topOps.forEach(op => {
      Object.keys(op.bpcdPorContrato).forEach(c => todosLosContratos.add(c));
    });
    const contratosUnicos = Array.from(todosLosContratos);

    const series = contratosUnicos.map(contrato => ({
      name: contrato,
      data: topOps.map(op => Math.round(op.bpcdPorContrato[contrato] || 0))
    }));

    const seriesLimpias = series.filter(s => s.data.some(v => v > 0));
    return { categories: topOps.map(o => o.op), series: seriesLimpias };
  }, [filtradosContratos]);

  // Treemap general de contratos (datos distribuidos)
  const contratosTree = useMemo(() => {
    const acc: Record<string, typeof filtradosContratos> = {};
    filtradosContratos.forEach((r) => {
      const k = r.Contrato || 'Sin Contrato';
      if (!acc[k]) acc[k] = [];
      acc[k].push(r);
    });
    return Object.entries(acc)
      .map(([n, regs]) => ({ x: n, y: Math.round(calcularBPDC(regs)) }))
      .sort((a, b) => b.y - a.y)
      .slice(0, 30);
  }, [filtradosContratos]);

  // Top contratos con desglose de operadoras (datos distribuidos)
  const contratoOperadoras = useMemo(() => {
    const acc: Record<string, Record<string, typeof filtradosContratos>> = {};
    filtradosContratos.forEach((r) => {
      const contratoStr = r.Contrato || 'Sin Contrato';
      if (!acc[contratoStr]) acc[contratoStr] = {};
      if (!acc[contratoStr][r.Operadora]) acc[contratoStr][r.Operadora] = [];
      acc[contratoStr][r.Operadora].push(r);
    });

    const contratosTotal = Object.entries(acc).map(([c, operadoras]) => {
      const bpcdPorOperadora: Record<string, number> = {};
      let total = 0;
      Object.entries(operadoras).forEach(([op, regs]) => {
        const val = calcularBPDC(regs);
        bpcdPorOperadora[op] = val;
        total += val;
      });
      return { c, total, bpcdPorOperadora };
    });

    const topContratos = contratosTotal.sort((a, b) => b.total - a.total).slice(0, 15);
    const todasLasOperadoras = new Set<string>();
    topContratos.forEach(contrato => {
      Object.keys(contrato.bpcdPorOperadora).forEach(op => todasLasOperadoras.add(op));
    });
    const operadorasUnicas = Array.from(todasLasOperadoras);

    const series = operadorasUnicas.map(op => ({
      name: op,
      data: topContratos.map(c => Math.round(c.bpcdPorOperadora[op] || 0))
    }));

    const seriesLimpias = series.filter(s => s.data.some(v => v > 0));
    return { categories: topContratos.map(c => c.c), series: seriesLimpias };
  }, [filtradosContratos]);

  // KPIs específicos para la pestaña de contratos (datos distribuidos)
  const kpisContratos = useMemo(() => {
    const acc: Record<string, Set<string>> = {};
    filtradosContratos.forEach((r) => {
      const c = r.Contrato || 'Sin Contrato';
      if (!acc[c]) acc[c] = new Set();
      acc[c].add(r.Operadora);
    });

    const totalContratos = Object.keys(acc).length;
    const contratosCompartidos = Object.values(acc).filter(ops => ops.size > 1).length;
    const top = contratosTree.length > 0 ? contratosTree[0] : { x: '-', y: 0 };
    const bpdcContratos = calcularBPDC(filtradosContratos);
    const avgBPDC = totalContratos > 0 ? bpdcContratos / totalContratos : 0;

    return { totalContratos, contratosCompartidos, topContrato: top.x, topContratoBPDC: top.y, avgBPDC };
  }, [filtradosContratos, contratosTree]);

  // ─── Opciones de gráficos ──────────────────────────────────────────────────
  const chartOpts = {
    baseTheme: {
      chart: { background: "transparent", toolbar: { show: false }, fontFamily: "var(--font-main)" },
      theme: { mode: "light" as const },
      colors: ["#003745", "#D44D03", "#008054"], // HEX explícito para exportación de imagen HTML2Canvas
      grid: { borderColor: "#DDE3E8" },
      tooltip: {
        theme: "light",
        y: { formatter: (v: number) => `${formatNum(v)} Bbl/día` },
      },
      dataLabels: {
        enabled: true,
        formatter: (v: number) => formatAbbr(v),
        style: { fontSize: '10px' }
      }
    },
  };

  // ─── Estilos del panel lateral ─────────────────────────────────────────────
  const panelStyles: Record<string, React.CSSProperties> = {
    overlay: {
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
      zIndex: 1000, opacity: filtrosAbiertos ? 1 : 0,
      pointerEvents: filtrosAbiertos ? "auto" : "none",
      transition: "opacity 0.25s ease",
    },
    panel: {
      position: "fixed", top: 0, right: 0, bottom: 0, width: 300,
      background: "#ffffff",
      borderLeft: "1px solid #e2e8f0",
      zIndex: 1001, overflowY: "auto", padding: "24px 20px",
      transform: filtrosAbiertos ? "translateX(0)" : "translateX(100%)",
      transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
      boxShadow: filtrosAbiertos ? "-8px 0 40px rgba(0,0,0,0.25)" : "none",
      color: "#1e293b",
    },
    tab: {
      position: "fixed", right: filtrosAbiertos ? 300 : 0, top: "50%",
      transform: "translateY(-50%) rotate(0deg)",
      zIndex: 1002,
      background: "var(--color-primary, #f59e0b)",
      color: "#0f172a", fontWeight: 700, fontSize: 12,
      border: "none", cursor: "pointer",
      padding: "10px 6px", borderRadius: filtrosAbiertos ? "6px 0 0 6px" : "6px 0 0 6px",
      writingMode: "vertical-rl", textOrientation: "mixed",
      letterSpacing: "0.05em", textTransform: "uppercase",
      transition: "right 0.3s cubic-bezier(0.4,0,0.2,1)",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
      minHeight: 80,
    } as React.CSSProperties,
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return <Loading message="Cargando producción de petróleo..." />;
  }

  if (error) {
    return (
      <div className="page-content">
      <div className="page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Droplets size={32} strokeWidth={2.5} style={{ color: "var(--color-primary)" }} />
          Producción Petróleo
        </h1>
      </div>
        <div className="panel">
          <div className="panel-body" style={{ textAlign: "center", padding: 48 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <div style={{ color: "var(--color-danger)", fontWeight: 700, marginBottom: 8 }}>
              Error al cargar datos
            </div>
            <div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
              {String(error)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ padding: '24px 24px 0', display: 'flex', gap: 8, borderBottom: '1px solid var(--color-border)', background: '#fff', overflowX: 'auto' }}>
        <button 
          onClick={() => setActiveTab('indicadores')}
          style={{ padding: '12px 24px', fontWeight: 800, color: activeTab === 'indicadores' ? 'var(--color-primary)' : 'var(--color-text-muted)', borderBottom: activeTab === 'indicadores' ? '3px solid var(--color-primary)' : '3px solid transparent', background: 'transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer', fontSize: 14, whiteSpace: 'nowrap' }}
        >
          Indicadores y Tablas
        </button>
        <button 
          onClick={() => setActiveTab('contratos')}
          style={{ padding: '12px 24px', fontWeight: 800, color: activeTab === 'contratos' ? 'var(--color-primary)' : 'var(--color-text-muted)', borderBottom: activeTab === 'contratos' ? '3px solid var(--color-primary)' : '3px solid transparent', background: 'transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer', fontSize: 14, whiteSpace: 'nowrap' }}
        >
          Análisis por Contrato
        </button>
        <button 
          onClick={() => setActiveTab('mapa')}
          style={{ padding: '12px 24px', fontWeight: 800, color: activeTab === 'mapa' ? 'var(--color-primary)' : 'var(--color-text-muted)', borderBottom: activeTab === 'mapa' ? '3px solid var(--color-primary)' : '3px solid transparent', background: 'transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer', fontSize: 14, whiteSpace: 'nowrap' }}
        >
          Mapa Georreferenciado
        </button>
      </div>

      {activeTab !== 'mapa' ? (
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
        <h3 style={{ marginBottom: 24, fontSize: '1.2rem', fontWeight: 900, color: 'var(--color-secondary)' }}>Filtros</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div key="Año">
            <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <Calendar size={14} /> Año
            </label>
            <MultiSelect 
              options={anios} 
              selected={filtroAnios} 
              onChange={(selected) => {
                setFiltroAnios(selected);
                setFiltroMeses([]); setFiltroDptos([]); setFiltroMunicipios([]); setFiltroOperadoras([]); setFiltroCampos([]);
              }} 
            />
          </div>
          <div key="Mes">
            <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <CalendarDays size={14} /> Mes
            </label>
            <MultiSelect 
              options={mesesDisponibles} 
              selected={filtroMeses} 
              onChange={(selected) => {
                setFiltroMeses(selected);
                setFiltroDptos([]); setFiltroMunicipios([]); setFiltroOperadoras([]); setFiltroCampos([]);
              }} 
            />
          </div>
          <div key="Departamento">
            <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <Map size={14} /> Departamento
            </label>
            <MultiSelect options={departamentos} selected={filtroDptos} onChange={(s) => { setFiltroDptos(s); setFiltroMunicipios([]); setFiltroOperadoras([]); setFiltroCampos([]); }} />
          </div>
          <div key="Municipio">
            <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <Home size={14} /> Municipio
            </label>
            <MultiSelect options={municipios} selected={filtroMunicipios} onChange={(s) => { setFiltroMunicipios(s); setFiltroOperadoras([]); setFiltroCampos([]); }} />
          </div>
          <div key="Operadora">
            <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <Building2 size={14} /> Operadora
            </label>
            <MultiSelect options={operadoras} selected={filtroOperadoras} onChange={(s) => { setFiltroOperadoras(s); setFiltroCampos([]); }} />
          </div>
          <div key="Campo">
            <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <MapPin size={14} /> Campo
            </label>
            <MultiSelect options={campos} selected={filtroCampos} onChange={(s) => { setFiltroCampos(s); setFiltroContratos([]); }} />
          </div>
          <div key="Contrato">
            <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <MapPin size={14} /> Contrato
            </label>
            <MultiSelect options={contratosFiltrables} selected={filtroContratos} onChange={setFiltroContratos} />
          </div>
          <div key="Afiliada">
            <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <CheckCircle2 size={14} /> Afiliada ACP
            </label>
            <MultiSelect options={["Sí", "No"]} selected={filtroAfiliada} onChange={setFiltroAfiliada} />
          </div>
          <button 
            onClick={limpiarFiltros}
            style={{ padding: 12, background: "var(--color-bg-elevated)", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, marginTop: 12, fontSize: 13, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <RotateCcw size={14} /> Limpiar Filtros
          </button>
        </div>
      </div>

      {activeTab === 'indicadores' && (
        <>
          <div className="page-header">
            <h1 style={{ color: 'var(--color-primary)', fontWeight: 900 }}>Producción Petróleo</h1>
        <p>
          {filtrados.length.toLocaleString("es-CO")} registros · Fuente: PostgreSQL (Producción)
          {filtrosActivos > 0 && <span style={{ marginLeft: 12, background: 'var(--color-primary)', color: '#fff', padding: '3px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>{filtrosActivos} activos</span>}
        </p>
      </div>

      <div className="kpi-grid">
        <KPICard label="BPDC Promedio" value={formatAbbr(Math.round(kpis.bpdc))} unit="Bbl/día" color="primary" icon={Droplets} />
        <KPICard label="Campos activos" value={formatNum(kpis.camposSet)} color="secondary" icon={MapPin} />
        <KPICard label="Operadoras" value={formatNum(kpis.operadorasSet)} color="success" icon={Building2} />
        <KPICard label="Municipios" value={formatNum(kpis.municipiosSet)} color="info" icon={Map} />
      </div>

      <div className="charts-grid">
        <div className="panel" id="panel-evolucion">
          <div className="panel-header">
            <span className="panel-title">Evolución de Producción (BPDC)</span>
            <ExportButton targetId="panel-evolucion" fileName="Evolucion_Produccion_BPDC" />
          </div>
          <div className="panel-body">
            {typeof window !== "undefined" && seriesMensuales.categorias.length > 0 && (
              <Chart key={seriesMensuales.categorias.join(",")} type="area" height={380}
                series={[{ name: "Producción BPDC", data: seriesMensuales.valores }]}
                options={{
                  ...chartOpts.baseTheme,
                  xaxis: { 
                    categories: seriesMensuales.categorias, 
                    tickAmount: 12,
                    labels: { 
                      style: { colors: "var(--color-text-muted)", fontSize: "9px" }, 
                      rotate: -45,
                      hideOverlappingLabels: true
                    } 
                  },
                  yaxis: { labels: { style: { colors: "var(--color-text-muted)" }, formatter: (v: number) => formatAbbr(v) } },
                  fill: { type: "gradient", gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.02 } },
                  stroke: { curve: "smooth", width: 2 },
                  colors: ["#D44D03"], // Usar HEX directo para exportación SVG/PNG
                  dataLabels: { enabled: false },
                  responsive: [{
                    breakpoint: 640,
                    options: {
                      xaxis: { labels: { show: false } }, // Ocultar etiquetas si es muy pequeño
                      chart: { height: 230 }
                    }
                  }]
                }}
              />
            )}
          </div>
        </div>
        <div className="panel" id="panel-top10">
          <div className="panel-header">
            <span className="panel-title">Top 10 Operadoras</span>
            <ExportButton targetId="panel-top10" fileName="Top_10_Operadoras" />
          </div>
          <div className="panel-body">
            {typeof window !== "undefined" && topOperadoras.length > 0 && (
              <Chart type="bar" height={380}
                series={[{ name: "BPDC", data: topOperadoras.map((o) => o.val) }]}
                options={{
                  ...chartOpts.baseTheme,
                  plotOptions: { 
                    bar: { 
                      horizontal: true, 
                      borderRadius: 4, 
                      barHeight: "95%",
                      dataLabels: { position: 'center' }
                    } 
                  },
                  xaxis: { 
                    categories: topOperadoras.map((o) => o.op), 
                    labels: { 
                      style: { colors: "var(--color-text-muted)", fontSize: "9px" }, 
                      formatter: (v: string) => formatAbbr(Number(v)) 
                    } 
                  },
                  colors: ["#003745"], // HEX explícito para exportación
                  dataLabels: { 
                    enabled: true, 
                    style: { fontSize: "11px", fontWeight: 700 },
                    formatter: (val: number) => formatNum(val)
                  },
                  responsive: [{
                    breakpoint: 640,
                    options: {
                      plotOptions: { bar: { barHeight: "80%" } },
                      dataLabels: { enabled: false }
                    }
                  }]
                }}
              />
            )}
          </div>
        </div>
      </div>

      <ReservasChart producto="Petroleo" />

      <div className="panel" id="panel-dpto" style={{ marginBottom: 24 }}>
        <div className="panel-header">
          <span className="panel-title">Producción por Departamento</span>
          <ExportButton targetId="panel-dpto" fileName="Produccion_Departamento" />
        </div>
        <div className="panel-body">
          {typeof window !== "undefined" && topDptos.length > 0 && (
            <Chart type="treemap" height={380}
              series={[{ data: topDptos.map(([n,v]) => ({ x: n, y: Math.round(v) })) }]}
              options={{
                ...chartOpts.baseTheme,
                colors: ["#D44D03", "#003745", "#008054", "#0277BD", "#C68400", "#C62828", "#0097A7", "#558B2F"],
                plotOptions: { treemap: { distributed: true, enableShades: false } },
                dataLabels: {
                  enabled: true,
                  formatter: (text: string, op: any) => [text, formatNum(op.value)]
                }
              }}
            />
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Detalle: Producción Petróleo</span>
          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{filtrados.length} registros</span>
        </div>
        <DataTable
          data={filtrados}
          columns={[
            { key: "Fecha", label: "Fecha", width: "110px", render: (v) => <span style={{ fontFamily: "monospace", fontSize: 12 }}>{v}</span> },
            { key: "Departamento", label: "Departamento" },
            { key: "Municipio", label: "Municipio" },
            { key: "Operadora", label: "Operadora", render: (v, row: any) => <span style={{ fontWeight: 600 }}>{v} {row.AfiliadaACP === 'Sí' && <span title="Afiliada ACP" style={{ color: '#008054', marginLeft: 4 }}>✓</span>}</span> },
            { key: "Campo", label: "Campo" },
            { key: "Contrato", label: "Contrato", render: (v) => v || 'Sin Contrato' },
            { key: "Produccion", label: "BPDC", align: "right", render: (v) => <span style={{ fontWeight: 700, color: "var(--color-primary)" }}>{Number(v).toLocaleString("es-CO")}</span> },
          ]}
          pageSize={100}
        />
      </div>
        </>
      )}

      {activeTab === 'contratos' && (
        <>
          <div className="page-header">
            <h1 style={{ color: 'var(--color-primary)', fontWeight: 900 }}>Análisis por Contrato</h1>
            <p>
              Participación de las operadoras desglosado por sus contratos en el periodo seleccionado. 
              Filtros activos: {filtrosActivos}
            </p>
          </div>

          <div className="kpi-grid">
            <KPICard label="Contratos Totales" value={formatNum(kpisContratos.totalContratos)} color="primary" icon={Briefcase} />
            <KPICard label="Contratos Compartidos" value={formatNum(kpisContratos.contratosCompartidos)} color="secondary" icon={Users} />
            <KPICard label="Mayor Productor" value={String(kpisContratos.topContrato)} unit={formatAbbr(Math.round(kpisContratos.topContratoBPDC)) + " BPDC"} color="success" icon={Star} />
            <KPICard label="BPDC Prom. / Contrato" value={formatAbbr(Math.round(kpisContratos.avgBPDC))} unit="Bbl/día" color="info" icon={BarChart2} />
          </div>

        <div className="panel" id="panel-contratos-stacked" style={{ marginBottom: 24 }}>
          <div className="panel-header">
            <span className="panel-title">Producción (BPDC) por Operadora y Contrato</span>
            <ExportButton targetId="panel-contratos-stacked" fileName="Produccion_Operadora_Contrato" />
          </div>
          <div className="panel-body">
            {typeof window !== "undefined" && operadoraContratos.categories.length > 0 ? (
              <Chart type="bar" height={650}
                series={operadoraContratos.series}
                options={{
                  ...chartOpts.baseTheme,
                  chart: { stacked: true, toolbar: { show: true }, animations: { enabled: false } },
                  plotOptions: { 
                    bar: { 
                      horizontal: false, 
                      borderRadius: 2, 
                      columnWidth: "60%",
                      dataLabels: {
                        total: {
                          enabled: true,
                          style: { color: 'var(--color-text-primary)', fontSize: '9px', fontWeight: 900 },
                          formatter: (v: string | number) => formatAbbr(Number(v))
                        }
                      }
                    } 
                  },
                  xaxis: { 
                    categories: operadoraContratos.categories, 
                    labels: { 
                      style: { colors: "var(--color-text-muted)", fontSize: "8px" }, 
                      rotate: -45,
                      hideOverlappingLabels: false
                    } 
                  },
                  yaxis: { 
                    labels: { formatter: (v: number) => formatAbbr(v) },
                    title: { text: "BPDC", style: { color: "var(--color-text-muted)" } }
                  },
                  dataLabels: { 
                    enabled: true,
                    formatter: (val: number) => val > 0 ? formatAbbr(val) : '',
                    style: { fontSize: "8px", fontWeight: 800, colors: ["#ffffff"] }
                  },
                  stroke: { width: 0 },
                  legend: { position: 'right', offsetY: 40, fontSize: '10px', labels: { colors: 'var(--color-text-primary)' } },
                  fill: { opacity: 1 },
                  tooltip: {
                    theme: "light",
                    y: { formatter: (v: number) => `${formatNum(v)} Bbl/día` },
                    shared: false,
                    intersect: true
                  }
                }}
              />
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>No hay datos suficientes para graficar.</div>
            )}
          </div>
        </div>

        <div className="panel" id="panel-contratos-inverso" style={{ marginBottom: 24 }}>
          <div className="panel-header">
            <span className="panel-title">Producción (BPDC) por Contrato y Operadora (Top 15 Contratos)</span>
            <ExportButton targetId="panel-contratos-inverso" fileName="Produccion_Contrato_Operadora" />
          </div>
          <div className="panel-body">
            {typeof window !== "undefined" && contratoOperadoras.categories.length > 0 ? (
              <Chart type="bar" height={450}
                series={contratoOperadoras.series}
                options={{
                  ...chartOpts.baseTheme,
                  chart: { stacked: true, toolbar: { show: true }, animations: { enabled: false } },
                  plotOptions: { 
                    bar: { 
                      horizontal: false, 
                      borderRadius: 2, 
                      columnWidth: "60%",
                      dataLabels: {
                        total: {
                          enabled: true,
                          style: { color: 'var(--color-text-primary)', fontSize: '11px', fontWeight: 900 },
                          formatter: (v: string | number) => formatAbbr(Number(v))
                        }
                      }
                    } 
                  },
                  xaxis: { 
                    categories: contratoOperadoras.categories, 
                    labels: { 
                      style: { colors: "var(--color-text-muted)", fontSize: "10px" }, 
                      rotate: -45,
                      hideOverlappingLabels: false
                    } 
                  },
                  yaxis: { 
                    labels: { formatter: (v: number) => formatAbbr(v) },
                    title: { text: "BPDC", style: { color: "var(--color-text-muted)" } }
                  },
                  dataLabels: { 
                    enabled: true,
                    formatter: (val: number) => val > 0 ? formatAbbr(val) : '',
                    style: { fontSize: "10px", fontWeight: 800, colors: ["#ffffff"] }
                  },
                  stroke: { width: 0 },
                  legend: { position: 'right', offsetY: 40, labels: { colors: 'var(--color-text-primary)' } },
                  fill: { opacity: 1 },
                  tooltip: {
                    theme: "light",
                    y: { formatter: (v: number) => `${formatNum(v)} Bbl/día` },
                    shared: false,
                    intersect: true
                  }
                }}
              />
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>No hay datos suficientes para graficar.</div>
            )}
          </div>
        </div>

        <div className="panel" id="panel-contratos-treemap" style={{ marginBottom: 24 }}>
          <div className="panel-header">
            <span className="panel-title">Top 30 Contratos (Global)</span>
            <ExportButton targetId="panel-contratos-treemap" fileName="Top_Contratos" />
          </div>
          <div className="panel-body">
            {typeof window !== "undefined" && contratosTree.length > 0 && (
              <Chart type="treemap" height={380}
                series={[{ data: contratosTree }]}
                options={{
                  ...chartOpts.baseTheme,
                  colors: ["#D44D03", "#003745", "#008054", "#0277BD", "#C68400", "#C62828", "#0097A7", "#558B2F"],
                  plotOptions: { treemap: { distributed: true, enableShades: false } },
                  dataLabels: {
                    enabled: true,
                    formatter: (text: string, op: any) => [text, formatNum(op.value)]
                  }
                }}
              />
            )}
          </div>
        </div>
        </>
      )}
      </div>
    ) : (
      <MapaPetroleoPage />
    )}
    </>
  );
}

"use client";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import { 
  Globe2, 
  TrendingUp, 
  DollarSign
} from "lucide-react";
import Loading from "@/components/Loading";
import { formatNum, formatCurrency } from "@/lib/formatters";
import ExportButton from "@/components/ExportButton";

// Importar ApexCharts solo en cliente (no SSR)
const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface ContextoData {
  fecha: string;
  brent: string | null;
  wti: string | null;
  gas: string | null;
  trm: string | null;
}

interface BalanceData {
  fecha: string;
  produccion: string;
  consumo: string;
  balance: string;
}

interface TaladrosData {
  fecha: string;
  eeuu: string;
  opep: string;
  no_opep: string;
  global: string;
  eeuu_yoy: string | null;
  opep_yoy: string | null;
  no_opep_yoy: string | null;
  global_yoy: string | null;
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

// ─── Loader de datos vía API PostgreSQL ───────────────────────────────────────────
async function cargarContexto(): Promise<ContextoData[]> {
  const res = await fetch("/api/contexto-internacional");
  if (!res.ok) throw new Error("Error cargando datos de contexto internacional");
  return res.json();
}

async function cargarBalance(): Promise<BalanceData[]> {
  const res = await fetch("/api/contexto-internacional/balance");
  if (!res.ok) throw new Error("Error cargando datos de balance petrolero");
  return res.json();
}

async function cargarTaladros(): Promise<TaladrosData[]> {
  const res = await fetch("/api/contexto-internacional/taladros");
  if (!res.ok) throw new Error("Error cargando datos de taladros");
  return res.json();
}

export default function ContextoInternacionalPage() {
  const { data: registros = [], isLoading: loadingContexto } = useQuery({
    queryKey: ["contexto-internacional"],
    queryFn: cargarContexto,
    staleTime: 10 * 60 * 1000,
    retry: 0,
  });

  const { data: registrosBalance = [], isLoading: loadingBalance } = useQuery({
    queryKey: ["balance-internacional"],
    queryFn: cargarBalance,
    staleTime: 10 * 60 * 1000,
    retry: 0,
  });

  const { data: registrosTaladros = [], isLoading: loadingTaladros } = useQuery({
    queryKey: ["taladros-internacional"],
    queryFn: cargarTaladros,
    staleTime: 10 * 60 * 1000,
    retry: 0,
  });

  const isLoading = loadingContexto || loadingBalance || loadingTaladros;

  // Encontrar el último valor disponible de cada serie para los KPIs
  const ultimosValores = useMemo(() => {
    let brent = 0;
    let wti = 0;
    let gas = 0;
    let trm = 0;
    let fechaBrent = "";
    let fechaTrm = "";

    // Buscar el último registro válido empezando desde el final (los datos vienen ASC)
    for (let i = registros.length - 1; i >= 0; i--) {
      const r = registros[i];
      if (brent === 0 && r.brent !== null) {
        brent = parseFloat(r.brent);
        fechaBrent = r.fecha;
      }
      if (wti === 0 && r.wti !== null) wti = parseFloat(r.wti);
      if (gas === 0 && r.gas !== null) gas = parseFloat(r.gas);
      if (trm === 0 && r.trm !== null) {
        trm = parseFloat(r.trm);
        fechaTrm = r.fecha;
      }
      if (brent > 0 && wti > 0 && gas > 0 && trm > 0) break;
    }

    return { brent, wti, gas, trm, fechaBrent, fechaTrm };
  }, [registros]);

  // Preparar series para la gráfica de ApexCharts de precios
  const chartData = useMemo(() => {
    // Filtramos para asegurar que tengamos fechas válidas
    const validData = registros.filter(r => r.fecha);
    
    // Convertir fechas a timestamps para el eje X tipo datetime
    const brentData = validData.filter(r => r.brent !== null).map(r => [new Date(r.fecha).getTime(), parseFloat(r.brent!)]);
    const wtiData = validData.filter(r => r.wti !== null).map(r => [new Date(r.fecha).getTime(), parseFloat(r.wti!)]);
    const gasData = validData.filter(r => r.gas !== null).map(r => [new Date(r.fecha).getTime(), parseFloat(r.gas!)]);
    const trmData = validData.filter(r => r.trm !== null).map(r => [new Date(r.fecha).getTime(), parseFloat(r.trm!)]);

    return {
      brentData,
      wtiData,
      gasData,
      trmData
    };
  }, [registros]);

  // Preparar series para la gráfica de Balance Petrolero
  const chartDataBalance = useMemo(() => {
    const validData = registrosBalance.filter(r => r.fecha);
    
    // Convertir a timestamp para que ApexCharts habilite el zoom (datetime)
    const categorias = validData.map(r => new Date(r.fecha).getTime());

    const balanceValues = validData.map(r => parseFloat(r.balance));
    
    const hoy = new Date();
    const indiceProyeccion = validData.findIndex(r => new Date(r.fecha) > hoy);

    return {
      categorias,
      balanceValues,
      indiceProyeccion: indiceProyeccion >= 0 ? indiceProyeccion : null
    };
  }, [registrosBalance]);

  // Preparar series para la gráfica de Taladros (Valores Absolutos y Global)
  const chartDataTaladros = useMemo(() => {
    // Filtramos para asegurar que tengamos fechas y calculos
    const validData = registrosTaladros.filter(r => r.fecha && r.global !== null);
    
    // Convertir a timestamp para que ApexCharts habilite el zoom (datetime)
    const categorias = validData.map(r => new Date(r.fecha).getTime());

    return {
      categorias,
      eeuu: validData.map(r => parseFloat(r.eeuu)),
      opep: validData.map(r => parseFloat(r.opep)),
      no_opep: validData.map(r => parseFloat(r.no_opep)),
      global: validData.map(r => parseFloat(r.global)),
    };
  }, [registrosTaladros]);

  if (isLoading) {
    return <Loading message="Cargando contexto internacional..." />;
  }


  return (
    <div className="page-content">
      <div className="page-header">
        <h1 style={{ color: 'var(--color-primary)', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Globe2 size={32} strokeWidth={2.5} />
          Contexto Internacional
        </h1>
        <p>
          {registros.length.toLocaleString("es-CO")} días de registro · Fuente: PostgreSQL (hecho_precios_crudo, hecho_trm)
        </p>
      </div>

      <div className="kpi-grid">
        <KPICard 
          label={`Brent (Cierre)`} 
          value={`$${ultimosValores.brent.toFixed(2)}`} 
          unit="USD/Bl" 
          color="primary" 
          icon={TrendingUp} 
        />
        <KPICard 
          label={`WTI (Cierre)`} 
          value={`$${ultimosValores.wti.toFixed(2)}`} 
          unit="USD/Bl" 
          color="secondary" 
          icon={TrendingUp} 
        />
        <KPICard 
          label={`Gas Henry Hub`} 
          value={`$${ultimosValores.gas.toFixed(2)}`} 
          unit="USD/MMBtu" 
          color="success" 
          icon={TrendingUp} 
        />
        <KPICard 
          label={`TRM`} 
          value={`$${formatNum(ultimosValores.trm)}`} 
          unit="COP/USD" 
          color="info" 
          icon={DollarSign} 
        />
      </div>

      <div className="panel" id="panel-trm-brent" style={{ marginTop: 24, marginBottom: 24 }}>
        <div className="panel-header">
          <span className="panel-title">Comportamiento histórico TRM y Petróleo (Brent & WTI)</span>
          <ExportButton targetId="panel-trm-brent" fileName="Historico_TRM_Petroleo" />
        </div>
        <div className="panel-body">
          {typeof window !== "undefined" && chartData.brentData.length > 0 && (
            <Chart 
              type="line" 
              height={400}
              series={[
                { name: "Brent (USD/Bl)", type: "line", data: chartData.brentData },
                { name: "TRM (COP)", type: "line", data: chartData.trmData },
                { name: "WTI (USD/Bl)", type: "line", data: chartData.wtiData }
              ]}
              options={{
                chart: { 
                  background: "transparent", 
                  toolbar: { show: false }, 
                  fontFamily: "var(--font-main)" 
                },
                theme: { mode: "light" },
                colors: ["#0277BD", "#D44D03", "#008054"], // Brent: Blue, TRM: Orange/Red, WTI: Green
                stroke: { width: [2, 2, 2], curve: "straight" },
                xaxis: { 
                  type: "datetime",
                  labels: { 
                    style: { colors: "var(--color-text-muted)", fontSize: "11px" },
                    datetimeUTC: false
                  },
                  tooltip: { enabled: false }
                },
                yaxis: [
                  {
                    seriesName: "Brent (USD/Bl)",
                    title: { text: "USD/Bl (Brent & WTI)", style: { color: "#0277BD", fontWeight: 700 } },
                    labels: { style: { colors: "#0277BD" }, formatter: (v: number) => v.toFixed(1) }
                  },
                  {
                    seriesName: "TRM (COP)",
                    opposite: true,
                    title: { text: "COP (TRM)", style: { color: "#D44D03", fontWeight: 700 } },
                    labels: { style: { colors: "#D44D03" }, formatter: (v: number) => formatNum(v) }
                  },
                  {
                    seriesName: "WTI (USD/Bl)",
                    show: false, // Ocultamos el tercer eje ya que WTI comparte la misma escala que el Brent
                  }
                ],
                grid: { borderColor: "#DDE3E8" },
                legend: { position: "top", horizontalAlign: "center" },
                tooltip: {
                  theme: "light",
                  x: { format: 'dd MMM yyyy' },
                }
              }}
            />
          )}
        </div>
      </div>

      <div className="panel" id="panel-trm-gas" style={{ marginBottom: 24 }}>
        <div className="panel-header">
          <span className="panel-title">Comportamiento histórico TRM y Gas Natural (Henry Hub)</span>
          <ExportButton targetId="panel-trm-gas" fileName="Historico_TRM_Gas" />
        </div>
        <div className="panel-body">
          {typeof window !== "undefined" && chartData.gasData.length > 0 && (
            <Chart 
              type="line" 
              height={400}
              series={[
                { name: "Gas Henry Hub (USD/MMBtu)", type: "line", data: chartData.gasData },
                { name: "TRM (COP)", type: "line", data: chartData.trmData }
              ]}
              options={{
                chart: { 
                  background: "transparent", 
                  toolbar: { show: false }, 
                  fontFamily: "var(--font-main)" 
                },
                theme: { mode: "light" },
                colors: ["#0097A7", "#D44D03"], // Gas: Teal, TRM: Orange/Red
                stroke: { width: [2, 2], curve: "straight" },
                xaxis: { 
                  type: "datetime",
                  labels: { 
                    style: { colors: "var(--color-text-muted)", fontSize: "11px" },
                    datetimeUTC: false
                  },
                  tooltip: { enabled: false }
                },
                yaxis: [
                  {
                    seriesName: "Gas Henry Hub (USD/MMBtu)",
                    title: { text: "USD/MMBtu (Gas)", style: { color: "#0097A7", fontWeight: 700 } },
                    labels: { style: { colors: "#0097A7" }, formatter: (v: number) => v.toFixed(2) }
                  },
                  {
                    seriesName: "TRM (COP)",
                    opposite: true,
                    title: { text: "COP (TRM)", style: { color: "#D44D03", fontWeight: 700 } },
                    labels: { style: { colors: "#D44D03" }, formatter: (v: number) => formatNum(v) }
                  }
                ],
                grid: { borderColor: "#DDE3E8" },
                legend: { position: "top", horizontalAlign: "center" },
                tooltip: {
                  theme: "light",
                  x: { format: 'dd MMM yyyy' },
                }
              }}
            />
          )}
        </div>
      </div>

      <div className="panel" id="panel-balance" style={{ marginBottom: 24 }}>
        <div className="panel-header">
          <span className="panel-title">Balance Petrolero Mundial</span>
          <ExportButton targetId="panel-balance" fileName="Balance_Petrolero" />
        </div>
        <div className="panel-body">
          {typeof window !== "undefined" && chartDataBalance.categorias.length > 0 && (
            <Chart 
              type="bar" 
              height={400}
              series={[{ name: "Balance (Producción - Consumo)", data: chartDataBalance.balanceValues }]}
              options={{
                chart: { 
                  background: "transparent", 
                  toolbar: { show: false }, 
                  fontFamily: "var(--font-main)",
                  zoom: { enabled: true, type: 'x', autoScaleYaxis: true }
                },
                theme: { mode: "light" },
                plotOptions: {
                  bar: {
                    borderRadius: 2,
                    colors: {
                      ranges: [
                        { from: -1000, to: -0.0001, color: '#D44D03' }, // Naranja/Rojo para déficit
                        { from: 0, to: 1000, color: '#008054' } // Verde para superávit
                      ]
                    }
                  }
                },
                dataLabels: { enabled: false },
                xaxis: { 
                  type: "datetime",
                  categories: chartDataBalance.categorias,
                  labels: { 
                    style: { colors: "var(--color-text-muted)", fontSize: "11px" },
                    datetimeUTC: false
                  },
                  tooltip: { enabled: false }
                },
                yaxis: { 
                  title: { text: "Cifras en MBPD", style: { fontWeight: 700, color: "var(--color-text-muted)" } },
                  labels: { formatter: (v: number) => v.toFixed(1) }
                },
                grid: { borderColor: "#DDE3E8" },
                tooltip: {
                  theme: "light",
                  x: { format: 'MMM yyyy' },
                },
                annotations: chartDataBalance.indiceProyeccion !== null ? {
                  xaxis: [{
                    x: chartDataBalance.categorias[chartDataBalance.indiceProyeccion],
                    strokeDashArray: 4,
                    borderColor: '#0277BD',
                    label: {
                      borderColor: '#0277BD',
                      style: { color: '#fff', background: '#0277BD' },
                      text: 'Proyecciones EIA'
                    }
                  }]
                } : {}
              }}
            />
          )}
        </div>
      </div>

      <div className="panel" id="panel-taladros" style={{ marginBottom: 24 }}>
        <div className="panel-header">
          <span className="panel-title">Análisis de Taladros Global</span>
          <ExportButton targetId="panel-taladros" fileName="Taladros_Global" />
        </div>
        <div className="panel-body">
          {typeof window !== "undefined" && chartDataTaladros.categorias.length > 0 && (
            <Chart 
              type="line" 
              height={400}
              series={[
                { name: "EE.UU.", type: "column", data: chartDataTaladros.eeuu },
                { name: "OPEP", type: "column", data: chartDataTaladros.opep },
                { name: "No OPEP", type: "column", data: chartDataTaladros.no_opep },
                { name: "Global", type: "line", data: chartDataTaladros.global }
              ]}
              options={{
                chart: { 
                  background: "transparent", 
                  toolbar: { show: false }, 
                  fontFamily: "var(--font-main)",
                  stacked: true,
                  zoom: { enabled: true, type: 'x', autoScaleYaxis: true }
                },
                theme: { mode: "light" },
                colors: ["#02A3FF", "#D44D03", "#34D399", "#111827"], // EE.UU (Azul), OPEP (Naranja), No OPEP (Verde), Global (Negro)
                stroke: { 
                  width: [0, 0, 0, 4], 
                  curve: "smooth" 
                },
                markers: {
                  size: [0, 0, 0, 5],
                  shape: "diamond"
                },
                dataLabels: { enabled: false },
                xaxis: { 
                  type: "datetime",
                  categories: chartDataTaladros.categorias,
                  labels: { 
                    style: { colors: "var(--color-text-muted)", fontSize: "11px" },
                    datetimeUTC: false
                  },
                  tooltip: { enabled: false }
                },
                yaxis: { 
                  title: { text: "Taladros", style: { fontWeight: 700, color: "var(--color-text-muted)" } },
                  labels: { formatter: (v: number) => formatNum(v) }
                },
                grid: { borderColor: "#DDE3E8" },
                legend: { position: "top", horizontalAlign: "center" },
                tooltip: {
                  theme: "light",
                  x: { format: 'MMM yyyy' },
                  y: { formatter: (v: number) => formatNum(v) }
                }
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

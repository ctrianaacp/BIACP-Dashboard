"use client";

import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { Map, Download } from "lucide-react";
import html2canvas from "html2canvas";
import ExportButton from "@/components/ExportButton";

// Cargar ApexCharts dinámicamente sin SSR
const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

function Loading({ message }: { message: string }) {
  return (
    <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid rgba(0,0,0,0.1)', borderTop: '4px solid var(--color-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <div style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>{message}</div>
      </div>
    </div>
  );
}

interface PibData {
  trimestre: string;
  anio: string;
  pib_total: string;
  pib_og: string;
}

interface PibPartData {
  anio: string;
  extraccion: string;
  refinacion: string;
  total: string;
}

// ─── Loader de datos vía API PostgreSQL ───────────────────────────────────────────
async function cargarPib(): Promise<PibData[]> {
  const res = await fetch("/api/contexto-nacional/pib");
  if (!res.ok) throw new Error("Error cargando datos de PIB");
  return res.json();
}

async function cargarPibPart(): Promise<PibPartData[]> {
  const res = await fetch("/api/contexto-nacional/pib-participacion");
  if (!res.ok) throw new Error("Error cargando datos de participacion PIB");
  return res.json();
}

interface ExportacionesData {
  fecha_mes: string;
  valor_fob_miles_usd: string;
  brent_avg: string;
  wti_avg: string;
}

interface IedData {
  fecha_mes: string;
  petrolero: string;
  total: string;
}

interface RegaliasData {
  anio: string;
  valor_total: string;
}

async function cargarExportaciones(): Promise<ExportacionesData[]> {
  const res = await fetch("/api/contexto-nacional/exportaciones");
  if (!res.ok) throw new Error("Error cargando datos de exportaciones");
  return res.json();
}

async function cargarIed(): Promise<IedData[]> {
  const res = await fetch("/api/contexto-nacional/ied");
  if (!res.ok) throw new Error("Error cargando IED");
  return res.json();
}

async function cargarRegalias(): Promise<RegaliasData[]> {
  const res = await fetch("/api/contexto-nacional/regalias");
  if (!res.ok) throw new Error("Error cargando regalías");
  return res.json();
}

interface RegaliasTopItem {
  nombre: string;
  v2024: number;
  v2025: number;
}

interface RegaliasTopsData {
  departamentos: RegaliasTopItem[];
  campos: RegaliasTopItem[];
  municipios: RegaliasTopItem[];
  tipos: RegaliasTopItem[];
}

async function cargarRegaliasTops(): Promise<RegaliasTopsData> {
  const res = await fetch("/api/contexto-nacional/regalias-tops");
  if (!res.ok) throw new Error("Error cargando tops de regalías");
  return res.json();
}

export default function ContextoNacionalPage() {
  const { data: registros = [], isLoading: isLoadingPib } = useQuery({
    queryKey: ["contexto-nacional-pib"],
    queryFn: cargarPib,
    staleTime: 10 * 60 * 1000,
    retry: 0,
  });

  const { data: registrosPart = [], isLoading: isLoadingPart } = useQuery({
    queryKey: ["contexto-nacional-pib-part"],
    queryFn: cargarPibPart,
    staleTime: 10 * 60 * 1000,
    retry: 0,
  });

  const { data: registrosExp = [], isLoading: isLoadingExp } = useQuery({
    queryKey: ["contexto-nacional-exportaciones"],
    queryFn: cargarExportaciones,
    staleTime: 10 * 60 * 1000,
    retry: 0,
  });

  const { data: registrosIed = [], isLoading: isLoadingIed } = useQuery({
    queryKey: ["contexto-nacional-ied"],
    queryFn: cargarIed,
    staleTime: 10 * 60 * 1000,
    retry: 0,
  });

  const { data: registrosRegalias = [], isLoading: isLoadingRegalias } = useQuery({
    queryKey: ["contexto-nacional-regalias"],
    queryFn: cargarRegalias,
    staleTime: 10 * 60 * 1000,
    retry: 0,
  });

  const { data: regaliasTops = null, isLoading: isLoadingRegaliasTops } = useQuery({
    queryKey: ["contexto-nacional-regalias-tops"],
    queryFn: cargarRegaliasTops,
    staleTime: 10 * 60 * 1000,
    retry: 0,
  });

  // Preparar series para la gráfica de ApexCharts de Crecimiento
  const chartData = useMemo(() => {
    if (!registros.length) return { categorias: [], labels: [], pib_total: [], pib_og: [] };

    const getMonthFromTrim = (trim: string) => {
      if (trim === 'I') return '01';
      if (trim === 'II') return '04';
      if (trim === 'III') return '07';
      return '10';
    };

    const categorias = registros.map(r => {
      const year = r.anio.replace(/[^0-9]/g, '');
      const month = getMonthFromTrim(r.trimestre);
      return new Date(`${year}-${month}-01T00:00:00`).getTime();
    });
    
    const labels = registros.map(r => `${r.trimestre} ${r.anio}`);
    const pib_total = registros.map(r => parseFloat(r.pib_total));
    const pib_og = registros.map(r => parseFloat(r.pib_og));

    return { categorias, labels, pib_total, pib_og };
  }, [registros]);

  // Preparar series para la gráfica de Participación
  const chartDataPart = useMemo(() => {
    if (!registrosPart.length) return { categorias: [], labels: [], extraccion: [], refinacion: [], total: [] };

    return {
      categorias: registrosPart.map(r => {
        const year = r.anio.replace(/[^0-9]/g, '');
        return new Date(`${year}-01-01T00:00:00`).getTime();
      }),
      labels: registrosPart.map(r => r.anio),
      extraccion: registrosPart.map(r => parseFloat(r.extraccion)),
      refinacion: registrosPart.map(r => parseFloat(r.refinacion)),
      total: registrosPart.map(r => parseFloat(r.total)),
    };
  }, [registrosPart]);

  // Preparar series para la gráfica de Exportaciones vs Brent y WTI
  const chartDataExp = useMemo(() => {
    if (!registrosExp.length) return { categorias: [], exportaciones: [], brent: [], wti: [] };

    return {
      categorias: registrosExp.map(r => new Date(r.fecha_mes).getTime()),
      exportaciones: registrosExp.map(r => parseFloat(r.valor_fob_miles_usd) / 1000), // Convertir a MUSD
      brent: registrosExp.map(r => parseFloat(r.brent_avg)),
      wti: registrosExp.map(r => parseFloat(r.wti_avg)),
    };
  }, [registrosExp]);

  // IED
  const chartDataIed = useMemo(() => {
    if (!registrosIed.length) return { categorias: [], labels: [], petrolero: [], total: [] };
    const getTrimestre = (fecha: string) => {
      const d = new Date(fecha);
      const m = d.getUTCMonth();
      if (m <= 2) return `I Trim ${d.getUTCFullYear()}`;
      if (m <= 5) return `II Trim ${d.getUTCFullYear()}`;
      if (m <= 8) return `III Trim ${d.getUTCFullYear()}`;
      return `IV Trim ${d.getUTCFullYear()}`;
    };
    return {
      categorias: registrosIed.map(r => new Date(r.fecha_mes).getTime()),
      labels: registrosIed.map(r => getTrimestre(r.fecha_mes)),
      petrolero: registrosIed.map(r => parseFloat(r.petrolero)),
      total: registrosIed.map(r => parseFloat(r.total)),
    };
  }, [registrosIed]);

  // Regalías
  const chartDataRegalias = useMemo(() => {
    if (!registrosRegalias.length) return { categorias: [], labels: [], regalias: [] };
    return {
      categorias: registrosRegalias.map(r => new Date(`${r.anio}-01-01T00:00:00`).getTime()),
      labels: registrosRegalias.map(r => r.anio),
      regalias: registrosRegalias.map(r => parseFloat(r.valor_total) / 1000000000000), // En Billones COP
    };
  }, [registrosRegalias]);

  if (isLoadingPib || isLoadingPart || isLoadingExp || isLoadingIed || isLoadingRegalias || isLoadingRegaliasTops) {
    return <Loading message="Cargando contexto económico nacional..." />;
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 style={{ color: 'var(--color-primary)', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Map size={32} strokeWidth={2.5} />
          Contexto Económico Nacional
        </h1>
        <p>
          Producto Interno Bruto y Variables Macroeconómicas · Fuente: PostgreSQL (hecho_pib) / DANE
        </p>
      </div>

      <div className="panel" id="panel-pib" style={{ marginTop: 24, marginBottom: 24 }}>
        <div className="panel-header">
          <span className="panel-title">Crecimiento Económico – PIB Sector O&G</span>
          <ExportButton targetId="panel-pib" fileName="Crecimiento_PIB" />
        </div>
        <div className="panel-body">
          {typeof window !== "undefined" && chartData.categorias.length > 0 && (
            <Chart 
              type="bar" 
              height={450}
              series={[
                { name: "Crecimiento % PIB Total", data: chartData.pib_total },
                { name: "Crecimiento % PIB - Sector Hidrocarburos + Refinación", data: chartData.pib_og }
              ]}
              options={{
                chart: { 
                  background: "transparent", 
                  toolbar: { show: true }, 
                  fontFamily: "var(--font-main)",
                  zoom: { enabled: true, type: 'x', autoScaleYaxis: true }
                },
                theme: { mode: "light" },
                colors: ["#0C2340", "#48C78E"], // Azul oscuro, Verde Esmeralda
                plotOptions: {
                  bar: {
                    horizontal: false,
                    columnWidth: "60%",
                    borderRadius: 2,
                    dataLabels: {
                      position: 'top' // Muestra etiquetas arriba de la barra
                    }
                  }
                },
                dataLabels: { 
                  enabled: true,
                  formatter: (val) => val.toFixed(1) + "%",
                  offsetY: -20,
                  style: {
                    fontSize: '12px',
                    colors: ["#0C2340", "#48C78E"]
                  }
                },
                stroke: { show: true, width: 2, colors: ['transparent'] },
                xaxis: { 
                  type: 'datetime',
                  categories: chartData.categorias,
                  labels: { 
                    style: { colors: "var(--color-text-muted)", fontSize: "12px", fontWeight: 600 },
                    datetimeUTC: false,
                    formatter: function(value, timestamp, opts) {
                      if (!timestamp) return value;
                      const idx = chartData.categorias.indexOf(timestamp);
                      return idx !== -1 ? chartData.labels[idx] : value;
                    }
                  }
                },
                yaxis: { 
                  title: { text: "Variación Anual (%)", style: { fontWeight: 700, color: "var(--color-text-muted)" } },
                  labels: { formatter: (v: number) => v.toFixed(1) + "%" }
                },
                grid: { borderColor: "#DDE3E8" },
                legend: { position: "top", horizontalAlign: "center" },
                tooltip: {
                  theme: "light",
                  y: { formatter: (v: number) => v.toFixed(1) + "%" }
                }
              }}
            />
          )}
          <div style={{ marginTop: '16px', fontSize: '11px', color: 'var(--color-text-muted)', textAlign: 'center' }}>
            PIB: Producto Interno Bruto – Producción constantes. *Dato preliminar y último disponible. **Sumatoria del PIB de la extracción de petróleo crudo y gas natural, y la coquización, fabricación de productos de la refinación del petróleo y actividades de mezcla de combustibles. Pr: Dato preliminar – P: Dato provisional
          </div>
        </div>
      </div>

      <div className="panel" id="panel-pib-part" style={{ marginBottom: 24 }}>
        <div className="panel-header">
          <span className="panel-title">Participación del Sector Hidrocarburos en el PIB</span>
          <ExportButton targetId="panel-pib-part" fileName="Participacion_PIB" />
        </div>
        <div className="panel-body">
          {typeof window !== "undefined" && chartDataPart.categorias.length > 0 && (
            <Chart 
              type="line" 
              height={450}
              series={[
                { name: "Participación extracción de petróleo y gas natural", type: "column", data: chartDataPart.extraccion },
                { name: "Participación coquización y refinación de petróleo", type: "column", data: chartDataPart.refinacion },
                { name: "Participación hidrocarburos en el PIB", type: "line", data: chartDataPart.total }
              ]}
              options={{
                chart: { 
                  background: "transparent", 
                  toolbar: { show: true }, 
                  fontFamily: "var(--font-main)",
                  stacked: true,
                  zoom: { enabled: true, type: 'x', autoScaleYaxis: true }
                },
                theme: { mode: "light" },
                colors: ["#1E4E2C", "#0C2340", "#DFA51B"], // Verde Oscuro, Azul Oscuro, Amarillo/Dorado
                plotOptions: {
                  bar: {
                    columnWidth: "45%",
                  }
                },
                dataLabels: { 
                  enabled: true,
                  enabledOnSeries: [0, 1, 2], // Habilitar data labels para todas las series
                  formatter: (val, opts) => {
                    if (opts.seriesIndex === 2) return val.toFixed(1) + "%"; // Total flotando
                    return val.toFixed(1) + "%"; // Valor interior de la barra apilada
                  },
                  offsetY: (val, opts) => {
                    return opts.seriesIndex === 2 ? -10 : 0; // Desplazar el total hacia arriba
                  },
                  style: {
                    fontSize: '12px',
                    colors: ["#ffffff", "#ffffff", "#000000"]
                  },
                  background: {
                    enabled: false
                  }
                },
                stroke: { 
                  width: [0, 0, 0], // Sin línea conectando los puntos, solo marcadores
                  curve: "smooth"
                },
                markers: {
                  size: [0, 0, 5],
                  shape: "circle",
                  colors: ["#DFA51B"],
                  strokeColors: "#fff",
                  strokeWidth: 2
                },
                xaxis: { 
                  type: 'datetime',
                  categories: chartDataPart.categorias,
                  labels: { 
                    style: { colors: "var(--color-text-muted)", fontSize: "12px", fontWeight: 600 },
                    datetimeUTC: false,
                    formatter: function(value, timestamp, opts) {
                      if (!timestamp) return value;
                      const idx = chartDataPart.categorias.indexOf(timestamp);
                      return idx !== -1 ? chartDataPart.labels[idx] : value;
                    }
                  }
                },
                yaxis: { 
                  title: { text: "Participación (%)", style: { fontWeight: 700, color: "var(--color-text-muted)" } },
                  labels: { formatter: (v: number) => v.toFixed(1) + "%" },
                  max: 7
                },
                grid: { borderColor: "#DDE3E8" },
                legend: { position: "bottom", horizontalAlign: "center" },
                tooltip: {
                  theme: "light",
                  y: { formatter: (v: number) => v.toFixed(1) + "%" }
                }
              }}
            />
          )}
        </div>
      </div>

      <div className="panel" id="panel-exportaciones" style={{ marginBottom: 24 }}>
        <div className="panel-header">
          <span className="panel-title">Exportaciones de petróleo y sus derivados vs. Precios del Crudo</span>
          <ExportButton targetId="panel-exportaciones" fileName="Exportaciones_vs_Brent_WTI" />
        </div>
        <div className="panel-body">
          {typeof window !== "undefined" && chartDataExp.categorias.length > 0 && (
            <Chart 
              type="line" 
              height={450}
              series={[
                { name: "Exportaciones de petróleo y sus derivados (MUSD)", type: "column", data: chartDataExp.exportaciones },
                { name: "Brent (USD/Bl)", type: "line", data: chartDataExp.brent },
                { name: "WTI (USD/Bl)", type: "line", data: chartDataExp.wti }
              ]}
              options={{
                chart: { 
                  background: "transparent", 
                  toolbar: { show: true }, 
                  fontFamily: "var(--font-main)",
                  zoom: { enabled: true, type: 'x', autoScaleYaxis: true }
                },
                theme: { mode: "light" },
                colors: ["#34D399", "#D44D03", "#008054"], // Verde Claro, Naranja (Brent), Verde Oscuro (WTI)
                plotOptions: {
                  bar: {
                    columnWidth: "40%",
                    dataLabels: {
                      position: 'top'
                    }
                  }
                },
                dataLabels: { 
                  enabled: true,
                  enabledOnSeries: [0], // Solo en exportaciones
                  formatter: (val) => {
                    return val.toLocaleString("es-CO", { maximumFractionDigits: 0 }); // ej. 1.430
                  },
                  offsetY: -20,
                  style: {
                    fontSize: '11px',
                    colors: ["var(--color-text-main)"]
                  },
                  background: { enabled: false }
                },
                stroke: { 
                  width: [0, 3, 3], // Sin borde para la barra, 3px para las líneas
                  curve: "smooth"
                },
                xaxis: { 
                  type: "datetime",
                  categories: chartDataExp.categorias,
                  labels: { 
                    style: { colors: "var(--color-text-muted)", fontSize: "11px", fontWeight: 600 },
                    datetimeUTC: false,
                    format: 'MMM-yy'
                  }
                },
                yaxis: [
                  {
                    seriesName: "Exportaciones de petróleo y sus derivados (MUSD)",
                    title: { text: "MUSD", style: { fontWeight: 700, color: "var(--color-text-muted)" } },
                    labels: { formatter: (v: number) => `$ ${v.toLocaleString("es-CO", { maximumFractionDigits: 0 })}` }
                  },
                  {
                    seriesName: "Brent (USD/Bl)",
                    opposite: true,
                    title: { text: "USD/Bl", style: { fontWeight: 700, color: "var(--color-text-muted)" } },
                    labels: { formatter: (v: number) => `$ ${v.toFixed(0)}` }
                  },
                  {
                    seriesName: "WTI (USD/Bl)",
                    show: false // Comparte la escala del Brent
                  }
                ],
                grid: { borderColor: "#DDE3E8" },
                legend: { position: "top", horizontalAlign: "center" },
                tooltip: {
                  theme: "light",
                  x: { format: 'MMM-yyyy' }
                }
              }}
            />
          )}
        </div>
      </div>

      <div className="panel" id="panel-ied" style={{ marginBottom: 24 }}>
        <div className="panel-header">
          <span className="panel-title">Inversión Extranjera Directa</span>
          <ExportButton targetId="panel-ied" fileName="Inversion_Extranjera_Directa" />
        </div>
        <div className="panel-body">
          {typeof window !== "undefined" && chartDataIed.categorias.length > 0 && (
            <Chart 
              type="bar" 
              height={400}
              series={[
                { name: "IED Sector Petrolero", data: chartDataIed.petrolero },
                { name: "IED Total", data: chartDataIed.total }
              ]}
              options={{
                chart: { 
                  background: "transparent", 
                  toolbar: { show: true }, 
                  fontFamily: "var(--font-main)",
                  zoom: { enabled: true, type: 'x', autoScaleYaxis: true }
                },
                theme: { mode: "light" },
                colors: ["#0C5A66", "#8BD765"], // Verde azulado oscuro y Verde claro (colores de la imagen)
                plotOptions: {
                  bar: {
                    horizontal: false,
                    columnWidth: "55%",
                    borderRadius: 2,
                    dataLabels: {
                      position: 'top'
                    }
                  }
                },
                dataLabels: { 
                  enabled: true,
                  formatter: (val) => `$ ${val.toLocaleString("es-CO", { maximumFractionDigits: 0 })}`,
                  offsetY: -20,
                  style: {
                    fontSize: '11px',
                    colors: ["#0C5A66", "#8BD765"]
                  }
                },
                stroke: { show: true, width: 2, colors: ['transparent'] },
                xaxis: { 
                  type: 'datetime',
                  categories: chartDataIed.categorias,
                  labels: { 
                    style: { colors: "var(--color-text-muted)", fontSize: "11px", fontWeight: 600 },
                    datetimeUTC: false,
                    formatter: function(value, timestamp, opts) {
                      if (!timestamp) return value;
                      const idx = chartDataIed.categorias.indexOf(timestamp);
                      return idx !== -1 ? chartDataIed.labels[idx] : value;
                    }
                  }
                },
                yaxis: { 
                  title: { text: "MUSD", style: { fontWeight: 700, color: "var(--color-text-muted)" } },
                  labels: { formatter: (v: number) => `$ ${v.toLocaleString("es-CO", { maximumFractionDigits: 0 })}` }
                },
                grid: { borderColor: "#DDE3E8" },
                legend: { position: "top", horizontalAlign: "center" },
                tooltip: {
                  theme: "light",
                  y: { formatter: (v: number) => `$ ${v.toLocaleString("es-CO", { maximumFractionDigits: 0 })} MUSD` }
                }
              }}
            />
          )}
        </div>
      </div>

      <div className="panel" id="panel-regalias" style={{ marginBottom: 24 }}>
        <div className="panel-header">
          <span className="panel-title">Regalías causadas por explotación de hidrocarburos</span>
          <ExportButton targetId="panel-regalias" fileName="Regalias_Hidrocarburos" />
        </div>
        <div className="panel-body">
          {typeof window !== "undefined" && chartDataRegalias.categorias.length > 0 && (
            <Chart 
              type="bar" 
              height={400}
              series={[
                { name: "Recaudo", type: "column", data: chartDataRegalias.regalias },
                { name: "Promedio 2020-2024", type: "line", data: chartDataRegalias.regalias.map(() => 7.8) } // Línea constante
              ]}
              options={{
                chart: { 
                  background: "transparent", 
                  toolbar: { show: true }, 
                  fontFamily: "var(--font-main)",
                  zoom: { enabled: true, type: 'x', autoScaleYaxis: true }
                },
                theme: { mode: "light" },
                colors: ["#0C5A66", "#FFC000"], // Teal oscuro y amarillo (como la imagen)
                plotOptions: {
                  bar: {
                    columnWidth: "60%",
                    borderRadius: 2,
                    dataLabels: {
                      position: 'top'
                    }
                  }
                },
                dataLabels: { 
                  enabled: true,
                  enabledOnSeries: [0], // Solo en el recaudo
                  formatter: (val, opts) => {
                    // Si es 2025 (índice final), lo podemos pintar diferente o solo devolver el valor
                    return `$ ${val.toFixed(1)}`;
                  },
                  offsetY: -20,
                  style: {
                    fontSize: '11px',
                    colors: ["#0C5A66"]
                  },
                  background: { enabled: false }
                },
                stroke: { 
                  width: [0, 3], 
                  dashArray: [0, 5], // Línea punteada para el promedio
                  curve: "straight"
                },
                xaxis: { 
                  type: 'datetime',
                  categories: chartDataRegalias.categorias,
                  labels: { 
                    style: { colors: "var(--color-text-muted)", fontSize: "11px", fontWeight: 600 },
                    datetimeUTC: false,
                    formatter: function(value, timestamp, opts) {
                      if (!timestamp) return value;
                      const idx = chartDataRegalias.categorias.indexOf(timestamp);
                      return idx !== -1 ? chartDataRegalias.labels[idx] : value;
                    }
                  }
                },
                yaxis: { 
                  title: { text: "Billones de pesos COP", style: { fontWeight: 700, color: "var(--color-text-muted)" } },
                  labels: { formatter: (v: number) => `$ ${v.toFixed(1)}` }
                },
                grid: { borderColor: "#DDE3E8" },
                legend: { position: "top", horizontalAlign: "center" },
                tooltip: {
                  theme: "light",
                  y: { formatter: (v: number) => `$ ${v.toFixed(1)} Billones COP` }
                }
              }}
            />
          )}
        </div>
      </div>

      {/* Grid 2x2 de Regalías */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        
        {/* Top 5 Departamentos */}
        <div className="panel" id="panel-regalias-deptos">
          <div className="panel-header">
            <span className="panel-title">Top 5 Departamentos (Regalías)</span>
            <ExportButton targetId="panel-regalias-deptos" fileName="Top5_Departamentos_Regalias" />
          </div>
          <div className="panel-body">
            {typeof window !== "undefined" && regaliasTops?.departamentos && (
              <Chart 
                type="bar" 
                height={350}
                series={[
                  { name: "2024", data: regaliasTops.departamentos.map(d => d.v2024) },
                  { name: "2025", data: regaliasTops.departamentos.map(d => d.v2025) }
                ]}
                options={{
                  chart: { background: "transparent", toolbar: { show: true }, fontFamily: "var(--font-main)" },
                  theme: { mode: "light" },
                  colors: ["#0C5A66", "#8BD765"],
                  plotOptions: { bar: { horizontal: true, barHeight: "60%", borderRadius: 2, dataLabels: { position: 'top' } } },
                  dataLabels: { 
                    enabled: true, 
                    offsetX: 25,
                    formatter: (val) => `$ ${Number(val).toFixed(1)}`,
                    style: { fontSize: '10px', colors: ["var(--color-text-main)"] }
                  },
                  stroke: { show: true, width: 1, colors: ['transparent'] },
                  xaxis: { 
                    categories: regaliasTops.departamentos.map(d => d.nombre),
                    labels: { formatter: (v: number) => `$ ${v.toFixed(1)}` },
                    title: { text: "Billones COP" }
                  },
                  yaxis: { labels: { style: { fontWeight: 600 } } },
                  grid: { borderColor: "#DDE3E8" },
                  legend: { position: "top", horizontalAlign: "center" }
                }}
              />
            )}
          </div>
        </div>

        {/* Top 5 Campos */}
        <div className="panel" id="panel-regalias-campos">
          <div className="panel-header">
            <span className="panel-title">Top 5 Campos Petroleros (Regalías)</span>
            <ExportButton targetId="panel-regalias-campos" fileName="Top5_Campos_Regalias" />
          </div>
          <div className="panel-body">
            {typeof window !== "undefined" && regaliasTops?.campos && (
              <Chart 
                type="bar" 
                height={350}
                series={[
                  { name: "2024", data: regaliasTops.campos.map(d => d.v2024) },
                  { name: "2025", data: regaliasTops.campos.map(d => d.v2025) }
                ]}
                options={{
                  chart: { background: "transparent", toolbar: { show: true }, fontFamily: "var(--font-main)" },
                  theme: { mode: "light" },
                  colors: ["#0C5A66", "#34D399"],
                  plotOptions: { bar: { horizontal: true, barHeight: "60%", borderRadius: 2, dataLabels: { position: 'top' } } },
                  dataLabels: { 
                    enabled: true, 
                    offsetX: 25,
                    formatter: (val) => `$ ${Number(val).toFixed(2)}`,
                    style: { fontSize: '10px', colors: ["var(--color-text-main)"] }
                  },
                  stroke: { show: true, width: 1, colors: ['transparent'] },
                  xaxis: { 
                    categories: regaliasTops.campos.map(d => d.nombre),
                    labels: { formatter: (v: number) => `$ ${v.toFixed(1)}` },
                    title: { text: "Billones COP" }
                  },
                  yaxis: { labels: { style: { fontWeight: 600 } } },
                  grid: { borderColor: "#DDE3E8" },
                  legend: { position: "top", horizontalAlign: "center" }
                }}
              />
            )}
          </div>
        </div>

        {/* Top 5 Municipios */}
        <div className="panel" id="panel-regalias-municipios">
          <div className="panel-header">
            <span className="panel-title">Top 5 Municipios (Regalías)</span>
            <ExportButton targetId="panel-regalias-municipios" fileName="Top5_Municipios_Regalias" />
          </div>
          <div className="panel-body">
            {typeof window !== "undefined" && regaliasTops?.municipios && (
              <Chart 
                type="bar" 
                height={350}
                series={[
                  { name: "2024", data: regaliasTops.municipios.map(d => d.v2024) },
                  { name: "2025", data: regaliasTops.municipios.map(d => d.v2025) }
                ]}
                options={{
                  chart: { background: "transparent", toolbar: { show: true }, fontFamily: "var(--font-main)" },
                  theme: { mode: "light" },
                  colors: ["#0C5A66", "#D44D03"],
                  plotOptions: { bar: { horizontal: true, barHeight: "60%", borderRadius: 2, dataLabels: { position: 'top' } } },
                  dataLabels: { 
                    enabled: true, 
                    offsetX: 25,
                    formatter: (val) => `$ ${Number(val).toFixed(2)}`,
                    style: { fontSize: '10px', colors: ["var(--color-text-main)"] }
                  },
                  stroke: { show: true, width: 1, colors: ['transparent'] },
                  xaxis: { 
                    categories: regaliasTops.municipios.map(d => d.nombre),
                    labels: { formatter: (v: number) => `$ ${v.toFixed(1)}` },
                    title: { text: "Billones COP" }
                  },
                  yaxis: { labels: { style: { fontWeight: 600 } } },
                  grid: { borderColor: "#DDE3E8" },
                  legend: { position: "top", horizontalAlign: "center" }
                }}
              />
            )}
          </div>
        </div>

        {/* Tipo de Hidrocarburo */}
        <div className="panel" id="panel-regalias-tipo">
          <div className="panel-header">
            <span className="panel-title">Regalías por Tipo de Hidrocarburo</span>
            <ExportButton targetId="panel-regalias-tipo" fileName="Tipo_Hidrocarburo_Regalias" />
          </div>
          <div className="panel-body">
            {typeof window !== "undefined" && regaliasTops?.tipos && (
              <Chart 
                type="bar" 
                height={350}
                series={[
                  { name: "2024", data: regaliasTops.tipos.map(d => d.v2024) },
                  { name: "2025", data: regaliasTops.tipos.map(d => d.v2025) }
                ]}
                options={{
                  chart: { background: "transparent", toolbar: { show: true }, fontFamily: "var(--font-main)", stacked: true },
                  theme: { mode: "light" },
                  colors: ["#0C2340", "#48C78E"],
                  plotOptions: { bar: { horizontal: false, columnWidth: "50%", borderRadius: 2 } },
                  dataLabels: { 
                    enabled: true, 
                    formatter: (val) => `$ ${Number(val).toFixed(1)}`,
                    style: { fontSize: '11px', colors: ["#fff"] }
                  },
                  stroke: { show: true, width: 1, colors: ['#fff'] },
                  xaxis: { 
                    categories: regaliasTops.tipos.map(d => d.nombre),
                    labels: { style: { fontWeight: 600, fontSize: '12px' } }
                  },
                  yaxis: { 
                    title: { text: "Billones COP" },
                    labels: { formatter: (v: number) => `$ ${v.toFixed(1)}` }
                  },
                  grid: { borderColor: "#DDE3E8" },
                  legend: { position: "top", horizontalAlign: "center" }
                }}
              />
            )}
          </div>
        </div>

      </div>

    </div>
  );
}

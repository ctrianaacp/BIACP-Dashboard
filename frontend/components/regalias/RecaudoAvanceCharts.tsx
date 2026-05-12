"use client";

import dynamic from "next/dynamic";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface Props {
  presupuestoTotal: number;
  recaudoTotal: number;
  presupuestoCorriente: number;
  recaudoCorriente: number;
}

export default function RecaudoAvanceCharts({
  presupuestoTotal,
  recaudoTotal,
  presupuestoCorriente,
  recaudoCorriente
}: Props) {
  const isDark = false;
  const textColor = "#475569";

  // Cálculos para "Otros"
  const presupuestoOtros = presupuestoTotal - presupuestoCorriente;
  const recaudoOtros = recaudoTotal - recaudoCorriente;

  // Porcentajes de avance (evitando división por 0)
  const pctCorriente = presupuestoCorriente > 0 ? (recaudoCorriente / presupuestoCorriente) * 100 : 0;
  const pctOtros = presupuestoOtros > 0 ? (recaudoOtros / presupuestoOtros) * 100 : 0;

  // Gráfico de Barras Agrupadas (Total, Corriente, Otros)
  // La imagen 3 muestra Recaudo (azul claro) sobre Presupuesto (azul oscuro)
  // Lo haremos como gráfico de barras superpuestas (no stacked, o stacked si uno es el remanente)
  // ApexCharts "stacked: false" con 100% overlap? Mejor usar dos series normales.
  const barOptions = {
    chart: { type: "bar", toolbar: { show: false }, background: "transparent" },
    plotOptions: {
      bar: { horizontal: true, dataLabels: { position: "top" }, barHeight: "50%" }
    },
    dataLabels: { enabled: false },
    stroke: { width: 1, colors: ["transparent"] },
    colors: ["#60a5fa", "#1e3a8a"], // Azul claro para Recaudo, azul oscuro para Presupuesto
    xaxis: {
      labels: {
        style: { colors: textColor },
        formatter: (val: number) => new Intl.NumberFormat('es-CO', { notation: "compact" }).format(val)
      },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      labels: { style: { colors: textColor, fontSize: "14px", fontFamily: "Inter, sans-serif" } }
    },
    legend: { position: "bottom", labels: { colors: textColor } },
    grid: { borderColor: isDark ? "#334155" : "#e2e8f0", strokeDashArray: 4 },
    theme: { mode: isDark ? "dark" : "light" }
  };

  const barSeries = [
    {
      name: "Recaudo",
      data: [
        { x: "Total", y: recaudoTotal },
        { x: "Corriente", y: recaudoCorriente },
        { x: "Otros", y: recaudoOtros }
      ]
    },
    {
      name: "Presupuesto",
      data: [
        { x: "Total", y: presupuestoTotal },
        { x: "Corriente", y: presupuestoCorriente },
        { x: "Otros", y: presupuestoOtros }
      ]
    }
  ];

  // Opciones para Gauge (Avance recaudo corriente)
  const gaugeOptions = (color: string, label: string) => ({
    chart: { type: "radialBar", background: "transparent", offsetY: -10 },
    plotOptions: {
      radialBar: {
        startAngle: -90,
        endAngle: 90,
        hollow: { size: "65%" },
        track: { background: isDark ? "#334155" : "#e2e8f0", strokeWidth: "100%" },
        dataLabels: {
          name: { show: false },
          value: { offsetY: 0, fontSize: "24px", color: textColor, fontWeight: "bold", formatter: (val: number) => val.toFixed(2) + "%" }
        }
      }
    },
    fill: { type: "solid", colors: [color] },
    stroke: { lineCap: "flat" },
    labels: [label],
    theme: { mode: isDark ? "dark" : "light" }
  });

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
      <div className={`p-4 border rounded-xl shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <Chart options={barOptions as any} series={barSeries} type="bar" height={250} />
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={`p-4 border rounded-xl shadow-sm flex flex-col justify-center items-center ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <h3 className={`text-sm font-semibold mb-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Avance recaudo corriente</h3>
          <Chart options={gaugeOptions("#3b82f6", "Corriente") as any} series={[Math.min(pctCorriente, 100)]} type="radialBar" height={250} />
          <div className="text-xs text-slate-400 mt-[-40px] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span> Recaudo
          </div>
        </div>
        
        <div className={`p-4 border rounded-xl shadow-sm flex flex-col justify-center items-center ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <h3 className={`text-sm font-semibold mb-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Avance recaudo otros</h3>
          <Chart options={gaugeOptions("#10b981", "Otros") as any} series={[Math.min(pctOtros, 100)]} type="radialBar" height={250} />
          <div className="text-xs text-slate-400 mt-[-40px] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> Recaudo
          </div>
        </div>
      </div>
    </div>
  );
}

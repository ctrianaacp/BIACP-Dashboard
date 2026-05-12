"use client";

import dynamic from "next/dynamic";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

export default function PBCBarCharts({ data }: { data: any }) {
  const isDark = false;
  const textColor = "#475569";

  // Tomamos los últimos 5 meses (la imagen muestra 5 meses, del más reciente al más antiguo)
  const last5Mineria = data?.mineria?.slice(-5).reverse() || [];
  const last5Hidrocarburos = data?.hidrocarburos?.slice(-5).reverse() || [];

  const chartOptions = (colorRecaudo: string, colorPBC: string) => ({
    chart: {
      type: "bar",
      toolbar: { show: false },
      background: "transparent"
    },
    plotOptions: {
      bar: {
        horizontal: true,
        dataLabels: { position: "top" },
        barHeight: "60%"
      }
    },
    dataLabels: {
      enabled: false
    },
    colors: [colorRecaudo, colorPBC],
    xaxis: {
      labels: {
        style: { colors: textColor },
        formatter: (val: number) => new Intl.NumberFormat('es-CO', { notation: "compact" }).format(val)
      },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      labels: { style: { colors: textColor, fontSize: "12px", fontFamily: "Inter, sans-serif" } }
    },
    legend: { position: "bottom", labels: { colors: textColor } },
    grid: { borderColor: isDark ? "#334155" : "#e2e8f0", strokeDashArray: 4 },
    theme: { mode: isDark ? "dark" : "light" }
  });

  const seriesMineria = [
    { name: "Recaudo Minería", data: last5Mineria.map((d: any) => ({ x: d.mes, y: d.recaudo })) },
    { name: "PBC Minería", data: last5Mineria.map((d: any) => ({ x: d.mes, y: d.pbc })) }
  ];

  const seriesHidrocarburos = [
    { name: "Recaudo Hidrocarburos", data: last5Hidrocarburos.map((d: any) => ({ x: d.mes, y: d.recaudo })) },
    { name: "PBC Hidrocarburos", data: last5Hidrocarburos.map((d: any) => ({ x: d.mes, y: d.pbc })) }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      <div className={`p-4 border rounded-xl shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <h3 className={`text-center font-semibold mb-4 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Recaudo y PBC</h3>
        <Chart options={chartOptions("#3b82f6", "#fdba74") as any} series={seriesMineria} type="bar" height={300} />
      </div>
      <div className={`p-4 border rounded-xl shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <h3 className={`text-center font-semibold mb-4 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Recaudo y PBC</h3>
        <Chart options={chartOptions("#10b981", "#fdba74") as any} series={seriesHidrocarburos} type="bar" height={300} />
      </div>
    </div>
  );
}

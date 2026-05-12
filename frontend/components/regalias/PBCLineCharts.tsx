"use client";

import dynamic from "next/dynamic";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

export default function PBCLineCharts({ data }: { data: any }) {
  const isDark = false;
  const textColor = "#475569";

  const chartOptions = (title: string, colorLine: string) => ({
    chart: {
      type: "line",
      toolbar: { show: false },
      background: "transparent",
      animations: { enabled: true }
    },
    title: {
      text: title,
      align: "center",
      style: { color: textColor, fontSize: "16px", fontWeight: "600", fontFamily: "Inter, sans-serif" }
    },
    stroke: { curve: "smooth", width: 3 },
    colors: ["#f97316", colorLine], // Orange for PBC, specific color for Recaudo
    markers: { size: 5, strokeWidth: 2, hover: { size: 7 } },
    xaxis: {
      categories: data?.mineria?.map((d: any) => d.mes) || [],
      labels: { style: { colors: textColor, fontSize: "11px" }, rotate: -45 },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      labels: {
        style: { colors: textColor },
        formatter: (val: number) => new Intl.NumberFormat('es-CO', { notation: "compact" }).format(val)
      }
    },
    legend: { position: "bottom", labels: { colors: textColor } },
    grid: { borderColor: isDark ? "#334155" : "#e2e8f0", strokeDashArray: 4 },
    theme: { mode: isDark ? "dark" : "light" }
  });

  const seriesMineria = [
    { name: "PBC", data: data?.mineria?.map((d: any) => d.pbc) || [] },
    { name: "Recaudo", data: data?.mineria?.map((d: any) => d.recaudo) || [] }
  ];

  const seriesHidrocarburos = [
    { name: "PBC", data: data?.hidrocarburos?.map((d: any) => d.pbc) || [] },
    { name: "Recaudo", data: data?.hidrocarburos?.map((d: any) => d.recaudo) || [] }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      <div className={`p-4 border rounded-xl shadow-md ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <Chart options={chartOptions("Recaudo Directas frente al PBC - Minería", "#3b82f6") as any} series={seriesMineria} type="line" height={350} />
      </div>
      <div className={`p-4 border rounded-xl shadow-md ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <Chart options={chartOptions("Recaudo Directas frente al PBC - Hidrocarburos", "#8b5cf6") as any} series={seriesHidrocarburos} type="line" height={350} />
      </div>
    </div>
  );
}

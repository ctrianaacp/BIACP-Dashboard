"use client";

import dynamic from "next/dynamic";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

export default function PBCLineCharts({ data }: { data: any }) {
  const textColor = "#475569";

  const buildOptions = (title: string, colorLine: string, categories: string[]) => ({
    chart: {
      type: "line",
      toolbar: { show: false },
      background: "transparent",
      animations: { enabled: true }
    },
    stroke: { curve: "smooth", width: 3 },
    colors: ["#f97316", colorLine],
    markers: { size: 4, strokeWidth: 2, hover: { size: 6 } },
    xaxis: {
      categories,
      labels: { style: { colors: textColor, fontSize: "10px" }, rotate: -45, rotateAlways: true },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      labels: {
        style: { colors: textColor },
        formatter: (val: number) => new Intl.NumberFormat('es-CO', { notation: "compact" }).format(val)
      }
    },
    legend: { position: "bottom", labels: { colors: textColor }, fontSize: "12px" },
    grid: { borderColor: "#e2e8f0", strokeDashArray: 4 },
    tooltip: {
      y: { formatter: (val: number) => `$${new Intl.NumberFormat('es-CO', { notation: "compact" }).format(val)}` }
    }
  });

  const mineriaData = data?.mineria || [];
  const hidrocarburosData = data?.hidrocarburos || [];

  if (mineriaData.length === 0 && hidrocarburosData.length === 0) return null;

  return (
    <div className="charts-grid" style={{ marginTop: "24px" }}>
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Recaudo Directas frente al PBC - Minería</span>
        </div>
        <div className="panel-body">
          {mineriaData.length > 0 && (
            <Chart 
              options={buildOptions("", "#3b82f6", mineriaData.map((d: any) => d.mes)) as any} 
              series={[
                { name: "PBC", data: mineriaData.map((d: any) => d.pbc) },
                { name: "Recaudo", data: mineriaData.map((d: any) => d.recaudo) }
              ]} 
              type="line" 
              height={350} 
            />
          )}
        </div>
      </div>
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Recaudo Directas frente al PBC - Hidrocarburos</span>
        </div>
        <div className="panel-body">
          {hidrocarburosData.length > 0 && (
            <Chart 
              options={buildOptions("", "#8b5cf6", hidrocarburosData.map((d: any) => d.mes)) as any} 
              series={[
                { name: "PBC", data: hidrocarburosData.map((d: any) => d.pbc) },
                { name: "Recaudo", data: hidrocarburosData.map((d: any) => d.recaudo) }
              ]} 
              type="line" 
              height={350} 
            />
          )}
        </div>
      </div>
    </div>
  );
}

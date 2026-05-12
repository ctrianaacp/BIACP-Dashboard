"use client";

import dynamic from "next/dynamic";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

export default function PBCBarCharts({ data }: { data: any }) {
  const textColor = "#475569";

  // Últimos 5 meses de cada sector
  const last5Mineria = (data?.mineria || []).slice(-5).reverse();
  const last5Hidrocarburos = (data?.hidrocarburos || []).slice(-5).reverse();

  if (last5Mineria.length === 0 && last5Hidrocarburos.length === 0) return null;

  const chartOptions = (colorRecaudo: string, colorPBC: string) => ({
    chart: { type: "bar", toolbar: { show: false }, background: "transparent" },
    plotOptions: {
      bar: { horizontal: true, barHeight: "55%", borderRadius: 3 }
    },
    dataLabels: { enabled: false },
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
      labels: { style: { colors: textColor, fontSize: "11px", fontFamily: "Inter, sans-serif" } }
    },
    legend: { position: "bottom", labels: { colors: textColor }, fontSize: "12px" },
    grid: { borderColor: "#e2e8f0", strokeDashArray: 4 },
    tooltip: {
      y: { formatter: (val: number) => `$${new Intl.NumberFormat('es-CO', { notation: "compact" }).format(val)}` }
    }
  });

  return (
    <div className="charts-grid" style={{ marginTop: "24px" }}>
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Recaudo y PBC - Minería (Últimos 5 meses)</span>
        </div>
        <div className="panel-body">
          {last5Mineria.length > 0 && (
            <Chart 
              options={chartOptions("#3b82f6", "#fdba74") as any} 
              series={[
                { name: "Recaudo Minería", data: last5Mineria.map((d: any) => ({ x: d.mes, y: d.recaudo })) },
                { name: "PBC Minería", data: last5Mineria.map((d: any) => ({ x: d.mes, y: d.pbc })) }
              ]} 
              type="bar" 
              height={300} 
            />
          )}
        </div>
      </div>
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Recaudo y PBC - Hidrocarburos (Últimos 5 meses)</span>
        </div>
        <div className="panel-body">
          {last5Hidrocarburos.length > 0 && (
            <Chart 
              options={chartOptions("#10b981", "#fdba74") as any} 
              series={[
                { name: "Recaudo Hidrocarburos", data: last5Hidrocarburos.map((d: any) => ({ x: d.mes, y: d.recaudo })) },
                { name: "PBC Hidrocarburos", data: last5Hidrocarburos.map((d: any) => ({ x: d.mes, y: d.pbc })) }
              ]} 
              type="bar" 
              height={300} 
            />
          )}
        </div>
      </div>
    </div>
  );
}

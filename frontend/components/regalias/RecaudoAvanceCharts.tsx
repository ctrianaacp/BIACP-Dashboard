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
  const textColor = "#475569";

  // "Otros" = Todo lo que no es corriente (Disp. Inicial + Rendimientos + Adiciones, etc.)
  const presupuestoOtros = Math.max(presupuestoTotal - presupuestoCorriente, 0);
  const recaudoOtros = Math.max(recaudoTotal - recaudoCorriente, 0);

  // Porcentajes de avance
  const pctTotal = presupuestoTotal > 0 ? (recaudoTotal / presupuestoTotal) * 100 : 0;
  const pctCorriente = presupuestoCorriente > 0 ? (recaudoCorriente / presupuestoCorriente) * 100 : 0;

  // Formateador compacto
  const fmtCompact = (val: number) => new Intl.NumberFormat('es-CO', { notation: "compact", maximumFractionDigits: 1 }).format(val);

  // Gráfico de Barras Agrupadas: Presupuesto vs Recaudo (Total, Corriente, Otros)
  const barOptions = {
    chart: { type: "bar", toolbar: { show: false }, background: "transparent" },
    plotOptions: {
      bar: { horizontal: true, barHeight: "55%", borderRadius: 3 }
    },
    dataLabels: { 
      enabled: true,
      formatter: (val: number) => fmtCompact(val),
      style: { fontSize: "11px", fontWeight: 600 }
    },
    stroke: { width: 1, colors: ["transparent"] },
    colors: ["#60a5fa", "#1e3a8a"],
    xaxis: {
      labels: {
        style: { colors: textColor },
        formatter: (val: number) => fmtCompact(val)
      },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      labels: { style: { colors: textColor, fontSize: "13px", fontFamily: "Inter, sans-serif", fontWeight: 700 } }
    },
    legend: { position: "bottom", labels: { colors: textColor }, fontSize: "13px" },
    grid: { borderColor: "#e2e8f0", strokeDashArray: 4 },
    tooltip: {
      y: { formatter: (val: number) => `$${fmtCompact(val)}` }
    }
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

  // Gauge semicírculo
  const gaugeOptions = (color: string) => ({
    chart: { type: "radialBar", background: "transparent", offsetY: -10 },
    plotOptions: {
      radialBar: {
        startAngle: -90,
        endAngle: 90,
        hollow: { size: "65%" },
        track: { background: "#e2e8f0", strokeWidth: "100%" },
        dataLabels: {
          name: { show: false },
          value: { offsetY: 0, fontSize: "28px", color: textColor, fontWeight: "bold", formatter: (val: number) => val.toFixed(1) + "%" }
        }
      }
    },
    fill: { type: "solid", colors: [color] },
    stroke: { lineCap: "flat" }
  });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginTop: "24px" }}>
      {/* Barras Presupuesto vs Recaudo */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Presupuesto vs Recaudo</span>
        </div>
        <div className="panel-body">
          <Chart options={barOptions as any} series={barSeries} type="bar" height={250} />
        </div>
      </div>
      
      {/* Gauges */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div className="panel" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div className="panel-header" style={{ width: "100%" }}>
            <span className="panel-title" style={{ fontSize: "0.85rem" }}>Avance Recaudo Total</span>
          </div>
          <div className="panel-body" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <Chart options={gaugeOptions("#3b82f6") as any} series={[Math.min(pctTotal, 100)]} type="radialBar" height={240} />
            <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "-36px" }}>
              {fmtCompact(recaudoTotal)} / {fmtCompact(presupuestoTotal)}
            </div>
          </div>
        </div>
        
        <div className="panel" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div className="panel-header" style={{ width: "100%" }}>
            <span className="panel-title" style={{ fontSize: "0.85rem" }}>Avance Recaudo Corriente</span>
          </div>
          <div className="panel-body" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <Chart options={gaugeOptions("#10b981") as any} series={[Math.min(pctCorriente, 100)]} type="radialBar" height={240} />
            <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "-36px" }}>
              {fmtCompact(recaudoCorriente)} / {fmtCompact(presupuestoCorriente)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

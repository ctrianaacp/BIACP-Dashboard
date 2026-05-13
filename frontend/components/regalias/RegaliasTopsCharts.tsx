"use client";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import Loading from "@/components/Loading";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

export default function RegaliasTopsCharts() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["regalias-tops-2024-2025"],
    queryFn: async () => {
      const res = await fetch("/api/contexto-nacional/regalias-tops");
      if (!res.ok) throw new Error("Error fetching tops");
      return res.json();
    },
    staleTime: 4 * 60 * 60 * 1000,
  });

  if (isLoading) return <Loading message="Cargando análisis de regalías causadas..." />;
  if (error || !data) return null;

  const chartBase = {
    chart: { background: "transparent", toolbar: { show: false }, fontFamily: "var(--font-main)" },
    theme: { mode: "light" as const },
    grid: { borderColor: "var(--color-border)", strokeDashArray: 4 },
    dataLabels: { 
      enabled: true, 
      formatter: (val: number) => `$${val.toFixed(1)}B`,
      style: { fontSize: "11px", fontWeight: 700 } 
    },
    yaxis: {
      labels: { formatter: (val: number) => `$${val.toFixed(1)}B` }
    },
    plotOptions: { bar: { borderRadius: 4, dataLabels: { position: 'top' } } }
  };

  const createSeries = (items: any[]) => [
    { name: "2024", data: items.map((i: any) => i.v2024) },
    { name: "2025", data: items.map((i: any) => i.v2025) }
  ];

  const getCategories = (items: any[]) => items.map((i: any) => i.nombre.length > 20 ? i.nombre.substring(0, 20) + "..." : i.nombre);

  return (
    <div className="charts-grid" style={{ marginTop: "24px" }}>
      {/* ── Top Campos ── */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Top 5 Campos (Regalías Causadas)</span>
          <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Hecho Regalías Campo</span>
        </div>
        <div className="panel-body">
          <Chart 
            type="bar" 
            height={320}
            series={createSeries(data.campos || [])}
            options={{
              ...chartBase,
              colors: ["#D44D03", "#009988"],
              xaxis: { categories: getCategories(data.campos || []) },
            }}
          />
        </div>
      </div>

      {/* ── Top Departamentos ── */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Top 5 Departamentos Productores</span>
          <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Hecho Regalías Campo</span>
        </div>
        <div className="panel-body">
          <Chart 
            type="bar" 
            height={320}
            series={createSeries(data.departamentos || [])}
            options={{
              ...chartBase,
              colors: ["#D44D03", "#009988"],
              xaxis: { categories: getCategories(data.departamentos || []) },
            }}
          />
        </div>
      </div>

      {/* ── Top Municipios ── */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Top 5 Municipios (Asignación Directa)</span>
          <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Hecho Regalías Asignación</span>
        </div>
        <div className="panel-body">
          <Chart 
            type="bar" 
            height={320}
            series={createSeries(data.municipios || [])}
            options={{
              ...chartBase,
              colors: ["#D44D03", "#009988"],
              xaxis: { categories: getCategories(data.municipios || []) },
            }}
          />
        </div>
      </div>

      {/* ── Por Hidrocarburo ── */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Regalías por Tipo de Hidrocarburo</span>
          <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Hecho Regalías Campo</span>
        </div>
        <div className="panel-body">
          <Chart 
            type="bar" 
            height={320}
            series={createSeries(data.tipos || [])}
            options={{
              ...chartBase,
              colors: ["#D44D03", "#009988"],
              xaxis: { categories: getCategories(data.tipos || []) },
            }}
          />
        </div>
      </div>
    </div>
  );
}

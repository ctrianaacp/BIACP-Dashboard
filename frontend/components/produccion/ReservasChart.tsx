"use client";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import Loading from "@/components/Loading";
import ExportButton from "@/components/ExportButton";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

export default function ReservasChart({ producto }: { producto: "Petroleo" | "Gas" }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["reservas", producto],
    queryFn: async () => {
      const res = await fetch(`/api/reservas?producto=${producto}`);
      if (!res.ok) throw new Error("Error cargando reservas");
      return res.json();
    },
    staleTime: 4 * 60 * 60 * 1000,
  });

  if (isLoading) return <Loading message="Cargando reservas..." />;
  if (error || !data) return null;

  const topCampos = data.top_campos || [];
  const kpis = data.kpis || {};

  // Formatear millones
  const formatM = (v: number) => {
    return (v / 1000000).toLocaleString("es-CO", { maximumFractionDigits: 1 });
  };
  
  const unit = producto === "Petroleo" ? "Millones de Barriles (MBbl)" : "Millones de Pies Cúbicos (MMPC)";

  return (
    <div className="panel" id={`panel-reservas-${producto}`} style={{ marginTop: 24, marginBottom: 24 }}>
      <div className="panel-header">
        <span className="panel-title">Top 10 Campos por Reservas Remanentes de {producto} ({kpis.ano})</span>
        <ExportButton targetId={`panel-reservas-${producto}`} fileName={`Reservas_${producto}`} />
      </div>
      <div className="panel-body">
        
        {/* Resumen Global */}
        <div style={{ display: "flex", gap: 16, marginBottom: 16, justifyContent: "center" }}>
          <div style={{ background: "rgba(0,0,0,0.03)", padding: "12px 24px", borderRadius: 8, textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 700 }}>Estimado Máximo (Total)</div>
            <div style={{ fontSize: 18, color: "var(--color-primary)", fontWeight: 900 }}>{formatM(kpis.estimado_maximo_reservas)}</div>
          </div>
          <div style={{ background: "rgba(0,0,0,0.03)", padding: "12px 24px", borderRadius: 8, textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 700 }}>Producción Acumulada</div>
            <div style={{ fontSize: 18, color: "var(--color-warning)", fontWeight: 900 }}>{formatM(kpis.produccion_acumulada)}</div>
          </div>
          <div style={{ background: "rgba(0,0,0,0.03)", padding: "12px 24px", borderRadius: 8, textAlign: "center", border: "1px solid var(--color-success)" }}>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 700 }}>Reservas Remanentes</div>
            <div style={{ fontSize: 18, color: "var(--color-success)", fontWeight: 900 }}>{formatM(kpis.reservas_remanentes)}</div>
          </div>
        </div>

        {typeof window !== "undefined" && topCampos.length > 0 && (
          <Chart 
            type="bar" 
            height={350}
            series={[
              { name: "Producción Acumulada", data: topCampos.map((c: any) => parseFloat(c.produccion_acumulada) / 1000000) },
              { name: "Reservas Remanentes", data: topCampos.map((c: any) => parseFloat(c.reservas_remanentes) / 1000000) }
            ]}
            options={{
              chart: { 
                background: "transparent", 
                toolbar: { show: false }, 
                fontFamily: "var(--font-main)",
                stacked: true
              },
              theme: { mode: "light" },
              colors: ["#DFA51B", "#1E4E2C"], // Naranja (Acumulado) y Verde Oscuro (Remanente)
              plotOptions: {
                bar: {
                  horizontal: true,
                  barHeight: "60%",
                  borderRadius: 2
                }
              },
              dataLabels: { 
                enabled: true,
                formatter: (val) => Number(val).toFixed(1),
                style: { fontSize: '10px' }
              },
              stroke: { show: true, width: 1, colors: ['#fff'] },
              xaxis: { 
                categories: topCampos.map((c: any) => c.nombre),
                title: { text: unit },
                labels: { formatter: (v: number) => v.toLocaleString("es-CO", { maximumFractionDigits: 0 }) }
              },
              yaxis: { labels: { style: { fontWeight: 600 } } },
              grid: { borderColor: "#DDE3E8" },
              legend: { position: "top", horizontalAlign: "center" },
              tooltip: {
                y: { formatter: (v: number) => `${v.toLocaleString("es-CO", { maximumFractionDigits: 1 })} Millones` }
              }
            }}
          />
        )}
        <div style={{ fontSize: 11, color: "var(--color-text-muted)", textAlign: "center", marginTop: 8 }}>
          * Valores en millones. Reservas remanentes calculadas como Estimado Máximo de Reservas - Producción Acumulada.
        </div>
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import Loading from "@/components/Loading";
import { Filter, Calendar, MapPin, Pickaxe } from "lucide-react";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

export default function RegaliasCausadas() {
  const [filtros, setFiltros] = useState({
    anio: "Todos",
    departamento: "Todos",
    municipio: "Todos",
    campo: "Todos",
    tipo: "Todos"
  });

  const { data, isLoading } = useQuery({
    queryKey: ["regalias-causadas-dinamico", filtros],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filtros).forEach(([k, v]) => { if (v !== "Todos") params.append(k, v); });
      const res = await fetch(`/api/regalias-causadas?${params.toString()}`);
      if (!res.ok) throw new Error("Error fetch");
      return res.json();
    },
    staleTime: 60 * 1000
  });

  const chartBase = {
    chart: { background: "transparent", toolbar: { show: false }, fontFamily: "var(--font-main)" },
    theme: { mode: "light" as const },
    grid: { borderColor: "var(--color-border)", strokeDashArray: 4 },
  };

  const handleFilter = (key: string, val: string) => setFiltros(p => ({ ...p, [key]: val }));

  return (
    <div className="panel" style={{ marginTop: 24, padding: 24, background: "#f8f9fa", borderRadius: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Pickaxe size={24} color="var(--color-primary)" />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--color-secondary)', margin: 0 }}>
          Explorador Dinámico de Regalías Causadas
        </h2>
      </div>

      {/* ── Barra de Filtros Internos ── */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24, padding: 16, background: "#fff", borderRadius: 8, boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
        <div style={{ flex: "1 1 150px" }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "flex", gap: 6, marginBottom: 6 }}>
            <Calendar size={14} /> Año
          </label>
          <select value={filtros.anio} onChange={e => handleFilter('anio', e.target.value)} style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: "1px solid #ccc", fontWeight: 600 }}>
            <option value="Todos">Todos</option>
            {data?.opciones?.anios?.map((a: any) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div style={{ flex: "1 1 150px" }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "flex", gap: 6, marginBottom: 6 }}>
            <MapPin size={14} /> Departamento
          </label>
          <select value={filtros.departamento} onChange={e => handleFilter('departamento', e.target.value)} style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: "1px solid #ccc", fontWeight: 600 }}>
            <option value="Todos">Todos</option>
            {data?.opciones?.departamentos?.map((d: any) => <option key={d} value={d}>{d.length > 20 ? d.slice(0, 20) + "..." : d}</option>)}
          </select>
        </div>
        <div style={{ flex: "1 1 150px" }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "flex", gap: 6, marginBottom: 6 }}>
            <MapPin size={14} /> Municipio
          </label>
          <select value={filtros.municipio} onChange={e => handleFilter('municipio', e.target.value)} style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: "1px solid #ccc", fontWeight: 600 }}>
            <option value="Todos">Todos</option>
            {data?.opciones?.municipios?.map((m: any) => <option key={m} value={m}>{m.length > 20 ? m.slice(0, 20) + "..." : m}</option>)}
          </select>
        </div>
        <div style={{ flex: "1 1 150px" }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "flex", gap: 6, marginBottom: 6 }}>
            <Filter size={14} /> Campo
          </label>
          <select value={filtros.campo} onChange={e => handleFilter('campo', e.target.value)} style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: "1px solid #ccc", fontWeight: 600 }}>
            <option value="Todos">Todos</option>
            {data?.opciones?.campos?.map((c: any) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ flex: "1 1 150px" }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "flex", gap: 6, marginBottom: 6 }}>
            <Filter size={14} /> Hidrocarburo
          </label>
          <select value={filtros.tipo} onChange={e => handleFilter('tipo', e.target.value)} style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: "1px solid #ccc", fontWeight: 600 }}>
            <option value="Todos">Todos</option>
            <option value="PETROLEO">Petróleo</option>
            <option value="GAS">Gas</option>
          </select>
        </div>
      </div>

      {isLoading ? <Loading message="Calculando agregaciones..." /> : (
        <div className="charts-grid">
          {/* Evolución */}
          <div className="panel" style={{ gridColumn: "1 / -1" }}>
            <div className="panel-header"><span className="panel-title">Evolución de Regalías Causadas (Billones COP)</span></div>
            <div className="panel-body">
              {data?.evolucion && (
                <Chart 
                  type="line" 
                  height={320}
                  series={[
                    { name: "Regalías Causadas (Billones COP)", type: "area", data: data.evolucion.map((e: any) => Number((Number(e.causadas) / 1000000000000).toFixed(2))) },
                    { name: "Precio Ref Promedio (USD)", type: "line", data: data.evolucion.map((e: any) => Number(Number(e.precio_usd || 0).toFixed(2))) },
                    { name: "TRM Promedio", type: "line", data: data.evolucion.map((e: any) => Number(Number(e.trm || 0).toFixed(0))) }
                  ]}
                  options={{
                    ...chartBase,
                    colors: ["#009988", "#D44D03", "#F2C94C"],
                    xaxis: { categories: data.evolucion.map((e: any) => e.mes) },
                    yaxis: [
                      { 
                        seriesName: "Regalías Causadas (Billones COP)",
                        labels: { formatter: (v: number) => `$${v}B`, style: { colors: "#009988", fontWeight: 700 } }
                      },
                      {
                        opposite: true,
                        seriesName: "Precio Ref Promedio (USD)",
                        labels: { formatter: (v: number) => `$${v} USD`, style: { colors: "#D44D03", fontWeight: 700 } }
                      },
                      {
                        opposite: true,
                        seriesName: "TRM Promedio",
                        show: false, // Ocultar el eje TRM para no saturar visualmente, pero se ve en el tooltip
                      }
                    ],
                    dataLabels: { enabled: false },
                    stroke: { curve: 'smooth', width: [3, 3, 2] },
                    fill: { type: ['gradient', 'solid', 'solid'], gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05, stops: [0, 100] } },
                    legend: { position: 'top', horizontalAlign: 'center' },
                    tooltip: { shared: true, intersect: false }
                  }}
                />
              )}
            </div>
          </div>

          {/* Por Campo */}
          <div className="panel">
            <div className="panel-header"><span className="panel-title">Distribución por Campo (Top 10 Filtrado)</span></div>
            <div className="panel-body">
              {data?.campos && (
                <Chart 
                  type="bar" 
                  height={320}
                  series={[{ name: "Regalías (MM)", data: data.campos.map((c: any) => Math.round(Number(c.valor) / 1000000)) }]}
                  options={{
                    ...chartBase,
                    colors: ["#D44D03"],
                    plotOptions: { bar: { horizontal: true, borderRadius: 4, dataLabels: { position: 'center' } } },
                    xaxis: { categories: data.campos.map((c: any) => c.nombre.length > 25 ? c.nombre.substring(0,25)+"..." : c.nombre) },
                    dataLabels: { enabled: true, formatter: (v: number) => `$${v.toLocaleString("es-CO")}`, style: { fontSize: "10px" } }
                  }}
                />
              )}
            </div>
          </div>

          {/* Por Hidrocarburo */}
          <div className="panel">
            <div className="panel-header"><span className="panel-title">Regalías por Hidrocarburo</span></div>
            <div className="panel-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {data?.tipos && (
                <Chart 
                  type="donut" 
                  height={280}
                  series={data.tipos.map((t: any) => Number(t.valor))}
                  options={{
                    ...chartBase,
                    labels: data.tipos.map((t: any) => t.nombre),
                    colors: ["#009988", "#F2C94C"],
                    dataLabels: { enabled: true, formatter: (val, opts) => opts.w.config.labels[opts.seriesIndex] },
                    tooltip: { y: { formatter: (v: number) => `$${(v / 1000000000000).toFixed(2)}B` } },
                    legend: { position: 'bottom' }
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

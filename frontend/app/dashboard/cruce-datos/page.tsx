"use client";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import { 
  GitMerge, 
  Droplets,
  Wind,
  Package
} from "lucide-react";
import Loading from "@/components/Loading";
import { formatCurrency, formatAbbr } from "@/lib/formatters";
import ExportButton from "@/components/ExportButton";
import axios from "axios";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

// Helpers para fechas (mismos de produccion)
function excelDateToISO(serial: unknown): string {
  if (serial === null || serial === undefined || serial === "") return "";
  if (serial instanceof Date) {
    if (isNaN(serial.getTime())) return "";
    const y = serial.getUTCFullYear();
    const m = String(serial.getUTCMonth() + 1).padStart(2, "0");
    const d = String(serial.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof serial === "string") {
    if (serial.trim() === "") return "";
    if (serial.includes("-") && serial.length >= 7) return serial.substring(0, 10);
    const parsed = new Date(serial);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().substring(0, 10);
    return serial;
  }
  const num = Number(serial);
  if (isNaN(num) || num < 1 || num > 100000) return "";
  try {
    const date = new Date(Math.round((num - 25569) * 86400 * 1000));
    if (isNaN(date.getTime())) return "";
    return date.toISOString().substring(0, 10);
  } catch {
    return "";
  }
}

function calcularPromedioMensual(registros: any[], campoValor: string): number {
  if (registros.length === 0) return 0;
  const porMes: Record<string, number> = {};
  for (const r of registros) {
    const key = r.Fecha.substring(0, 7);
    if (!key || key.length < 7) continue;
    porMes[key] = (porMes[key] ?? 0) + r[campoValor];
  }
  const valores = Object.values(porMes);
  if (valores.length === 0) return 0;
  return valores.reduce((s, v) => s + v, 0) / valores.length;
}

async function cargarPetroleo() {
  const res = await axios.get('/api/produccion?tipo=petroleo');
  return res.data.map((r: any) => ({
    Fecha: r.Fecha,
    Produccion: Number(r.Produccion || 0),
  }));
}

async function cargarGas() {
  const res = await axios.get('/api/produccion?tipo=gas');
  return res.data.map((r: any) => ({
    Fecha: r.Fecha,
    Produccion: Number(r.Produccion || 0),
  }));
}

function KPICard({ label, value, unit, color, icon: Icon }: any) {
  return (
    <div className={`kpi-card ${color}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}{unit && <span className="kpi-unit">{unit}</span>}</div>
      <span className="kpi-icon"><Icon size={24} strokeWidth={2.5} /></span>
    </div>
  );
}

export default function CruceDatosPage() {
  const { data: petroleo, isLoading: isLoadingP } = useQuery({
    queryKey: ["produccion-petroleo-basico"],
    queryFn: cargarPetroleo,
    staleTime: 10 * 60 * 1000,
  });

  const { data: gas, isLoading: isLoadingG } = useQuery({
    queryKey: ["produccion-gas-basico"],
    queryFn: cargarGas,
    staleTime: 10 * 60 * 1000,
  });

  const { data: bys, isLoading: isLoadingB } = useQuery({
    queryKey: ["bienes-servicios-basico"],
    queryFn: () => axios.get(`/api/stats/dashboard?type=bienes-servicios`).then(res => res.data),
    staleTime: 10 * 60 * 1000,
  });

  const chartSeries = useMemo(() => {
    if (!petroleo || !gas || !bys?.summary) return null;

    // Agrupar petroleo por año
    const pPorAnio: Record<string, any[]> = {};
    petroleo.forEach(r => {
      const y = r.Fecha.substring(0, 4);
      if (!y || y.length < 4) return;
      if (!pPorAnio[y]) pPorAnio[y] = [];
      pPorAnio[y].push(r);
    });
    
    // Agrupar gas por año
    const gPorAnio: Record<string, any[]> = {};
    gas.forEach(r => {
      const y = r.Fecha.substring(0, 4);
      if (!y || y.length < 4) return;
      if (!gPorAnio[y]) gPorAnio[y] = [];
      gPorAnio[y].push(r);
    });

    // Obtener años únicos que existan en todas las bases (o en al menos una)
    const allYears = new Set<string>();
    Object.keys(pPorAnio).forEach(y => allYears.add(y));
    Object.keys(gPorAnio).forEach(y => allYears.add(y));
    bys.summary.forEach((s: any) => allYears.add(String(s.anio)));

    const yearsSorted = Array.from(allYears).sort((a, b) => a.localeCompare(b)).filter(y => y !== 'null');

    const dataPetroleo = yearsSorted.map(y => pPorAnio[y] ? calcularPromedioMensual(pPorAnio[y], 'Produccion') : 0);
    const dataGas = yearsSorted.map(y => gPorAnio[y] ? calcularPromedioMensual(gPorAnio[y], 'Produccion') : 0);
    const dataBys = yearsSorted.map(y => {
      const match = bys.summary.find((s: any) => String(s.anio) === y);
      return match ? Number(match.total_valor) : 0;
    });

    return {
      categories: yearsSorted,
      petroleo: dataPetroleo,
      gas: dataGas,
      bys: dataBys
    };
  }, [petroleo, gas, bys]);

  const isLoading = isLoadingP || isLoadingG || isLoadingB;

  if (isLoading) return <Loading message="Calculando cruce de variables..." />;

  const chartOpts = {
    chart: { background: "transparent", toolbar: { show: false }, fontFamily: "var(--font-main)" },
    theme: { mode: "light" as const },
    grid: { borderColor: "var(--color-border)" },
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 900 }}>
          <GitMerge size={32} strokeWidth={2.5} style={{ color: "var(--color-primary)" }} />
          Cruce: Producción vs Bienes y Servicios
        </h1>
        <p>
          Análisis comparativo de la inversión en cadena de suministro frente a la producción histórica de hidrocarburos.
        </p>
      </div>

      <div className="kpi-grid">
        <KPICard label="Producción Petróleo" value="BPDC" color="primary" icon={Droplets} />
        <KPICard label="Producción Gas" value="MPCD" color="secondary" icon={Wind} />
        <KPICard label="Bienes y Servicios" value="COP" color="success" icon={Package} />
      </div>

      {chartSeries && (
        <div className="panel" id="panel-cruce-historico">
          <div className="panel-header">
            <span className="panel-title">Evolución Comparativa Anual</span>
            <ExportButton targetId="panel-cruce-historico" fileName="Cruce_Produccion_Contratacion" />
          </div>
          <div className="panel-body">
            <Chart
              type="line"
              height={500}
              series={[
                { name: "Inversión Bienes y Servicios (COP)", type: "column", data: chartSeries.bys },
                { name: "Producción Petróleo (BPDC)", type: "line", data: chartSeries.petroleo.map(v => Math.round(v)) },
                { name: "Producción Gas (MPCD)", type: "line", data: chartSeries.gas.map(v => Math.round(v)) },
              ]}
              options={{
                ...chartOpts,
                stroke: { width: [0, 4, 4], curve: 'smooth' },
                xaxis: { categories: chartSeries.categories },
                colors: ["#10b981", "#D44D03", "#003745"],
                dataLabels: { enabled: false },
                yaxis: [
                  {
                    title: { text: "Inversión COP", style: { color: "#10b981", fontWeight: 700 } },
                    labels: { style: { colors: "#10b981" }, formatter: (v: number) => formatCurrency(v, true) },
                  },
                  {
                    opposite: true,
                    title: { text: "BPDC / MPCD", style: { color: "#D44D03", fontWeight: 700 } },
                    labels: { style: { colors: "#D44D03" }, formatter: (v: number) => formatAbbr(v) },
                  },
                  {
                    show: false,
                    opposite: true,
                    title: { text: "MPCD", style: { color: "#003745", fontWeight: 700 } },
                    labels: { style: { colors: "#003745" }, formatter: (v: number) => formatAbbr(v) },
                  }
                ],
                tooltip: {
                  shared: true,
                  intersect: false,
                  y: {
                    formatter: function (y, { seriesIndex }) {
                      if (typeof y !== "undefined") {
                        if (seriesIndex === 0) return formatCurrency(y, false) + " COP";
                        if (seriesIndex === 1) return formatAbbr(y) + " BPDC";
                        if (seriesIndex === 2) return formatAbbr(y) + " MPCD";
                      }
                      return y;
                    }
                  }
                },
                legend: { position: 'top', horizontalAlign: 'center' }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import axios from "axios";
import dynamic from "next/dynamic";
import { useMsal } from "@azure/msal-react";
import Loading from "@/components/Loading";
import { Layers, Map as MapIcon, Flame, MapPin, Building2 } from "lucide-react";
import { normalizarMunicipio, normalizarDepartamento, normalizarOperadora } from "@/lib/normalizacion";

import { formatNum, formatAbbr } from "@/lib/formatters";

const PremiumMap = dynamic(() => import("@/components/PremiumMap"), { 
  ssr: false,
  loading: () => <Loading message="Cargando motor 3D..." />
});

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

function calcularMPCD(registros: any[]): number {
  if (registros.length === 0) return 0;
  const porMes: Record<string, number> = {};
  for (const r of registros) {
    const key = r.Fecha?.substring(0, 7);
    if (!key || key.length < 7) continue;
    porMes[key] = (porMes[key] ?? 0) + r.Produccion;
  }
  const valores = Object.values(porMes);
  if (valores.length === 0) return 0;
  return valores.reduce((s, v) => s + v, 0) / valores.length;
}

function KPICard({ label, value, unit, color, icon: Icon }: {
  label: string; value: string; unit?: string; color: string; icon: any;
}) {
  return (
    <div className={`kpi-card ${color}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">
        {value}
        {unit && <span className="kpi-unit">{unit}</span>}
      </div>
      <span className="kpi-icon"><Icon size={24} strokeWidth={2.5} /></span>
    </div>
  );
}

async function cargarGas() {
  const res = await fetch("/api/produccion?tipo=gas");
  if (!res.ok) throw new Error("Error cargando datos de gas");
  const data = await res.json();
  return data.map((r: any) => ({
    ...r,
    Departamento: normalizarDepartamento(r.Departamento || ""),
    Municipio: normalizarMunicipio(r.Municipio || ""),
    Operadora: normalizarOperadora(r.Operadora || ""),
    Produccion: Number(r.Produccion) || 0
  }));
}

export default function MapaGasPage() {
  const { instance, accounts } = useMsal();
  const [layerType, setLayerType] = useState<'hexagon' | 'heatmap'>('hexagon');
  const [filtroAnio, setFiltroAnio] = useState<string>('Todos');

  const { data: geoData, isLoading: isGeoLoading } = useQuery({
    queryKey: ["municipios-coords"],
    queryFn: async () => {
      const { data } = await axios.get("/api/social-impact");
      return data;
    },
    staleTime: 10 * 60 * 1000,
  });

  const { data: registros = [], isLoading: isDataLoading, error } = useQuery({
    queryKey: ["produccion-gas-pg"],
    queryFn: cargarGas,
    staleTime: 10 * 60 * 1000,
    retry: 0,
  });

  const anios = useMemo(() => {
    if (!registros.length) return ["Todos"];
    const years = new Set<string>();
    registros.forEach((r: any) => {
      if (r.Fecha) years.add(r.Fecha.substring(0, 4));
    });
    return ["Todos", ...Array.from(years).sort().reverse()];
  }, [registros]);

  const filtrados = useMemo(() => {
    return registros.filter((reg: any) => {
      const year = reg.Fecha?.substring(0, 4);
      if (filtroAnio !== 'Todos' && year !== filtroAnio) return false;
      return true;
    });
  }, [registros, filtroAnio]);

  const kpis = useMemo(() => {
    const mpcd = calcularMPCD(filtrados);
    const campos = new Set(filtrados.map((r: any) => r.Campo)).size;
    const operadorasSet = new Set(filtrados.map((r: any) => r.Operadora)).size;
    const municipios = new Set(filtrados.map((r: any) => r.Municipio)).size;
    return { mpcd, camposSet: campos, operadorasSet, municipiosSet: municipios };
  }, [filtrados]);

  const mapData = useMemo(() => {
    if (!geoData?.municipios || filtrados.length === 0) return [];

    const munDict = new Map<string, { lat: number, lng: number }>();
    geoData.municipios.forEach((m: any) => {
      const nombreNorm = normalizarMunicipio(m.municipio);
      if (m.latitud && m.longitud) {
        munDict.set(nombreNorm, { lat: parseFloat(m.latitud), lng: parseFloat(m.longitud) });
      }
    });

    const porMuni: Record<string, any[]> = {};
    filtrados.forEach((r: any) => {
      if (!porMuni[r.Municipio]) porMuni[r.Municipio] = [];
      porMuni[r.Municipio].push(r);
    });

    const points: any[] = [];
    Object.entries(porMuni).forEach(([municipio, regs]) => {
      const coords = munDict.get(municipio);
      if (!coords) return;
      
      const mpcdPromedio = calcularMPCD(regs);
      
      // Extraer operadoras y campos únicos en este municipio
      const operadorasList = Array.from(new Set(regs.map((r: any) => r.Operadora)));
      const camposList = Array.from(new Set(regs.map((r: any) => r.Campo).filter(Boolean)));

      if (mpcdPromedio > 0) {
        points.push({
          position: [coords.lng, coords.lat],
          weight: mpcdPromedio, // MPCD promedio del municipio
          label: municipio,
          departamento: regs[0].Departamento,
          subtitle: operadorasList.join(", "),
          campos: camposList.join(", ")
        });
      }
    });

    return points;
  }, [geoData, filtrados]);

  const isLoading = isGeoLoading || isDataLoading;

  if (isLoading) return <Loading message="Cargando mapa de producción de gas..." />;
  if (error) return <div>Error cargando el mapa: {String(error)}</div>;

  return (
    <div className="page-content" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="page-header" style={{ flexShrink: 0 }}>
        <h1 style={{ color: 'var(--color-secondary)', fontWeight: 900, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Flame size={32} strokeWidth={2.5} style={{ color: "var(--color-secondary)" }} /> 
          Producción Gas: Perspectiva Geográfica
        </h1>
        <p>Evolución de producción (MPCD) en territorio ({filtrados.length.toLocaleString('es-CO')} registros mapeados {filtroAnio !== 'Todos' ? `en ${filtroAnio}` : ''})</p>
      </div>

      <div className="kpi-grid">
        <KPICard label="MPCD Promedio" value={formatNum(kpis.mpcd, 2)} unit="MPCD/día" color="secondary" icon={Flame} />
        <KPICard label="Campos activos" value={formatNum(kpis.camposSet)} color="primary" icon={MapPin} />
        <KPICard label="Operadoras" value={formatNum(kpis.operadorasSet)} color="success" icon={Building2} />
        <KPICard label="Municipios" value={formatNum(kpis.municipiosSet)} color="info" icon={MapIcon} />
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        
        {/* Controles de Capa */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--color-bg-elevated)', padding: 4, borderRadius: 10, border: '1px solid var(--color-border)' }}>
          <button 
            onClick={() => setLayerType('hexagon')}
            style={{
              padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: layerType === 'hexagon' ? 'var(--color-secondary)' : 'transparent',
              color: layerType === 'hexagon' ? '#fff' : 'var(--color-text-primary)',
              fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, transition: '0.2s'
            }}
          >
            <Layers size={16} /> Hexágonos 3D
          </button>
          <button 
            onClick={() => setLayerType('heatmap')}
            style={{
              padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: layerType === 'heatmap' ? 'var(--color-info)' : 'transparent',
              color: layerType === 'heatmap' ? '#fff' : 'var(--color-text-primary)',
              fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, transition: '0.2s'
            }}
          >
            <MapIcon size={16} /> Mapa de Calor Clásico
          </button>
        </div>

        <div style={{ width: 1, height: 24, background: 'var(--color-border)' }} />

        {/* Filtro Histórico */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Variación Histórica:
          </span>
          <select 
            value={filtroAnio}
            onChange={(e) => setFiltroAnio(e.target.value)}
            style={{ 
              padding: '6px 16px', borderRadius: 8, border: '1px solid var(--color-border)', 
              background: '#fff', fontWeight: 700, color: 'var(--color-secondary)',
              outline: 'none', cursor: 'pointer', minWidth: 120
            }}
          >
            {anios.map(a => <option key={a} value={a}>{a === 'Todos' ? '— Todos los Años —' : a}</option>)}
          </select>
        </div>

      </div>

      <div style={{ height: 'calc(100vh - 350px)', minHeight: '500px', position: 'relative', borderRadius: 16, overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', border: '1px solid var(--color-border)' }}>
        {/* Color range distinto para gas (tonos fríos: cian, azules) */}
        <PremiumMap 
          data={mapData} 
          layerType={layerType} 
          colorRange={[
            [224, 243, 253],
            [153, 216, 233],
            [67, 162, 202],
            [8, 104, 172],
            [2, 56, 88],
            [0, 37, 69]
          ]}
          customTooltip={(object, allData) => {
            // Extraer todos los puntos reales dentro del área mapeando con allData
            let pointsInBin: any[] = [];
            
            if (object.points && object.points.length > 0) {
              pointsInBin = object.points;
            } else if (object.pointIndices && object.pointIndices.length > 0) {
              pointsInBin = object.pointIndices.map((idx: number) => allData[idx]);
            } else {
              const hexCenter = object.position || object.coordinate;
              if (hexCenter && Array.isArray(hexCenter)) {
                pointsInBin = allData.filter(d => {
                  if (!d.position) return false;
                  const dx = d.position[0] - hexCenter[0];
                  const dy = d.position[1] - hexCenter[1];
                  const dist = Math.sqrt(dx * dx + dy * dy);
                  return dist < 0.15;
                });
              }
              if (pointsInBin.length === 0) {
                pointsInBin = [object];
              }
            }

            const capitalize = (s: string) => s ? s.toLowerCase().replace(/\b\w/g, l => l.toUpperCase()) : "";
            
            // Recolectar datos únicos
            const munis = Array.from(new Set(pointsInBin.map(p => capitalize((p.source || p).label || "")))).filter(Boolean);
            
            const opsSet = new Set<string>();
            pointsInBin.forEach(p => { 
              const source = p.source || p;
              if (source.subtitle) source.subtitle.split(", ").forEach((op: string) => opsSet.add(op)); 
            });
            
            const camposSet = new Set<string>();
            pointsInBin.forEach(p => { 
              const source = p.source || p;
              if (source.campos) source.campos.split(", ").forEach((c: string) => camposSet.add(c)); 
            });

            // Extraer el MPCD ya calculado por el HexagonLayer
            const totalMPCD = object.elevationValue ?? object.colorValue ?? pointsInBin.reduce((sum: number, p: any) => sum + ((p.source || p).weight || 0), 0);

            return {
              html: `
                <div style="margin-bottom: 3px; padding-bottom: 3px; color: #38bdf8; font-size: 11px; white-space: normal; word-wrap: break-word; max-width: 200px;">
                  <b>Municipios:</b> <span style="color: #fff;">${munis.join(", ") || "No disponible"}</span>
                </div>
                <div style="font-size: 10px; color: #cbd5e1; margin-bottom: 3px; line-height: 1.2; white-space: normal; word-wrap: break-word; max-width: 200px;">
                  <b>Operadora:</b> <span style="color: #fff;">${Array.from(opsSet).join(", ") || "No disponible"}</span>
                </div>
                <div style="font-size: 10px; color: #cbd5e1; margin-bottom: 6px; line-height: 1.2; white-space: normal; word-wrap: break-word; max-width: 200px;">
                  <b>Campos:</b> <span style="color: #fff;">${Array.from(camposSet).join(", ") || "No disponible"}</span>
                </div>
                <div style="display: flex; gap: 5px; align-items: center; padding-top: 5px; border-top: 1px dashed rgba(255,255,255,0.2);">
                  <span style="font-weight:bold; font-size: 11px; color: #cbd5e1;">MPCD:</span> 
                  <span style="font-weight:900; color: #4ade80; font-size: 12px;">${Number(totalMPCD).toLocaleString('es-CO', { maximumFractionDigits: 2 })}</span>
                </div>
              `,
              style: {
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                color: '#e2e8f0',
                borderRadius: '6px',
                padding: '8px 12px',
                boxShadow: '0 6px 15px -4px rgba(0, 0, 0, 0.5)',
                border: '1px solid rgba(51, 65, 85, 0.8)',
                fontSize: '10px',
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
              }
            };
          }}
        />
      </div>
    </div>
  );
}

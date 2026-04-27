"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import axios from "axios";
import dynamic from "next/dynamic";
import Loading from "@/components/Loading";
import { Layers, Map as MapIcon } from "lucide-react";
import { normalizarMunicipio } from "@/lib/normalizacion";

// Importación dinámica para evitar problemas de SSR con WebGL
const PremiumMap = dynamic(() => import("@/components/PremiumMap"), { 
  ssr: false,
  loading: () => <Loading message="Cargando motor 3D..." />
});

export default function MapaPruebaPage() {
  const [layerType, setLayerType] = useState<'hexagon' | 'heatmap'>('hexagon');
  const [filtroAnio, setFiltroAnio] = useState<string>('Todos');

  const { data, isLoading, error } = useQuery({
    queryKey: ["social-impact-map"],
    queryFn: async () => {
      const { data } = await axios.get("/api/social-impact");
      return data;
    },
    staleTime: 10 * 60 * 1000,
  });

  const anios = useMemo(() => {
    if (!data?.inversion_social) return ["Todos"];
    const years = new Set<string>();
    data.inversion_social.forEach((inv: any) => {
      if (inv.anio) years.add(String(inv.anio));
    });
    return ["Todos", ...Array.from(years).sort().reverse()];
  }, [data]);

  const mapData = useMemo(() => {
    if (!data?.inversion_social || !data?.municipios) return [];

    // 1. Crear diccionario de municipios para búsqueda rápida
    const munDict = new Map<string, { lat: number, lng: number }>();
    
    data.municipios.forEach((m: any) => {
      const nombreNorm = normalizarMunicipio(m.municipio);
      // Solo guardamos si tiene coordenadas válidas
      if (m.latitud && m.longitud) {
        munDict.set(nombreNorm, { 
          lat: parseFloat(m.latitud), 
          lng: parseFloat(m.longitud) 
        });
      }
    });

    // 2. Mapear inversión a coordenadas filtrando por año
    const points: any[] = [];
    
    data.inversion_social.forEach((inv: any) => {
      if (filtroAnio !== 'Todos' && String(inv.anio) !== filtroAnio) return;

      const nombreMun = normalizarMunicipio(inv.municipio_raw || inv.municipio);
      const coords = munDict.get(nombreMun);
      
      if (coords) {
        points.push({
          position: [coords.lng, coords.lat], // Deck.gl usa [longitud, latitud]
          weight: Number(inv.valor_cop || 0),
          label: nombreMun,
          departamento: inv.departamento_raw || inv.departamento || ""
        });
      }
    });

    return points;
  }, [data, filtroAnio]);

  if (isLoading) return <Loading message="Cargando datos geoespaciales..." />;
  if (error) return <div>Error cargando el mapa: {String(error)}</div>;

  return (
    <div className="page-content" style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header" style={{ flexShrink: 0, marginBottom: 16 }}>
        <h1 style={{ color: 'var(--color-info)', fontWeight: 900, display: 'flex', alignItems: 'center', gap: 12 }}>
          <MapIcon size={32} /> Mapa de Calor Georreferenciado
        </h1>
        <p>Inversión Social proyectada en territorio ({mapData.length} proyectos georreferenciados {filtroAnio !== 'Todos' ? `en ${filtroAnio}` : ''})</p>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        
        {/* Controles de Capa */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--color-bg-elevated)', padding: 4, borderRadius: 10, border: '1px solid var(--color-border)' }}>
          <button 
            onClick={() => setLayerType('hexagon')}
            style={{
              padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: layerType === 'hexagon' ? 'var(--color-primary)' : 'transparent',
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

      <div style={{ flex: 1, position: 'relative', borderRadius: 16, overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', border: '1px solid var(--color-border)' }}>
        <PremiumMap data={mapData} layerType={layerType} />
      </div>
    </div>
  );
}

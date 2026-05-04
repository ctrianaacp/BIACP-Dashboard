"use client";

import React, { useMemo, useState, useCallback, useRef } from 'react';
import DeckGL from '@deck.gl/react';
import { Map, MapRef } from 'react-map-gl/maplibre';
import { HeatmapLayer, HexagonLayer } from '@deck.gl/aggregation-layers';
import { ZoomIn, ZoomOut, Compass, Download, Image as ImageIcon } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

export interface MapDataPoint {
  position: [number, number]; // [longitude, latitude]
  weight: number;
  label?: string; // Municipio
  departamento?: string; // Departamento
  subtitle?: string; // Información extra, como Operadora
}

interface PremiumMapProps {
  data: MapDataPoint[];
  layerType?: 'heatmap' | 'hexagon';
  colorRange?: [number, number, number][];
  initialViewState?: {
    longitude: number;
    latitude: number;
    zoom: number;
    pitch: number;
    bearing: number;
  };
  tooltipLabels?: {
    countLabel?: string;
    weightLabel?: string;
    weightPrefix?: string;
    weightSuffix?: string;
  };
  customTooltip?: (object: any, data: MapDataPoint[]) => any;
}

const DEFAULT_VIEW_STATE = {
  longitude: -74.08175,
  latitude: 4.60971,
  zoom: 5,
  pitch: 45,
  bearing: 0
};

const DEFAULT_COLOR_RANGE: [number, number, number][] = [
  [1, 152, 189],
  [73, 227, 206],
  [216, 254, 181],
  [254, 237, 177],
  [254, 173, 84],
  [209, 55, 78]
];

export default function PremiumMap({
  data,
  layerType = 'hexagon',
  colorRange = DEFAULT_COLOR_RANGE,
  initialViewState = DEFAULT_VIEW_STATE,
  tooltipLabels = {},
  customTooltip
}: PremiumMapProps) {

  const mapRef = useRef<MapRef>(null);

  // Se usa 'any' para evitar conflictos con 'transitionDuration' y otras props de ViewStateT nativas de DeckGL
  const [viewState, setViewState] = useState<any>(initialViewState);

  // Funciones de control de mapa
  const handleZoomIn = useCallback(() => {
    setViewState((v: any) => ({ ...v, zoom: v.zoom + 1, transitionDuration: 300 }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setViewState((v: any) => ({ ...v, zoom: v.zoom - 1, transitionDuration: 300 }));
  }, []);

  const handleResetView = useCallback(() => {
    setViewState({ ...initialViewState, transitionDuration: 500 });
  }, [initialViewState]);

  // Funciones de exportación
  const handleExportData = useCallback(() => {
    if (!data || data.length === 0) return;
    const headers = ['Longitude', 'Latitude', 'Weight', 'Municipio', 'Departamento'];
    const csvContent = [
      headers.join(','),
      ...data.map(d => `${d.position[0]},${d.position[1]},${d.weight},"${d.label || ''}","${d.departamento || ''}"`)
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'mapa_datos.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [data]);

  const handleExportImage = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) {
      console.error("El mapa base no está listo para exportar");
      return;
    }

    // Forzar un repintado del mapa base y capturar en el mismo frame
    // Esto garantiza que el buffer de WebGL tenga los pixeles correctos incluso si preserveDrawingBuffer falla
    map.triggerRepaint();
    map.once('render', () => {
      const mapCanvas = map.getCanvas() as HTMLCanvasElement;
      const deckCanvas = document.getElementById('deckgl-overlay') as HTMLCanvasElement;
      
      if (deckCanvas && mapCanvas) {
        const mergedCanvas = document.createElement('canvas');
        mergedCanvas.width = deckCanvas.width;
        mergedCanvas.height = deckCanvas.height;
        
        const ctx = mergedCanvas.getContext('2d');
        if (ctx) {
          // 1. Fondo de seguridad
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, mergedCanvas.width, mergedCanvas.height);
          
          // 2. Pintar mapa base (MapLibre)
          try {
            // El canvas del mapa puede tener distinto tamaño lógico vs físico, ajustamos
            ctx.drawImage(mapCanvas, 0, 0, mergedCanvas.width, mergedCanvas.height);
          } catch (e) {
            console.error("Error copiando el mapa base nativo", e);
          }
          
          // 3. Pintar capa de datos (Deck.gl)
          try {
            ctx.drawImage(deckCanvas, 0, 0, mergedCanvas.width, mergedCanvas.height);
          } catch (e) {
            console.error("Error copiando la capa de datos", e);
          }
          
          const dataUrl = mergedCanvas.toDataURL('image/png');
          const link = document.createElement('a');
          link.download = 'mapa_completo_biacp.png';
          link.href = dataUrl;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } else {
        console.error("No se encontraron los lienzos del mapa");
      }
    });
  }, []);


  const layers = useMemo(() => {
    if (layerType === 'hexagon') {
      return [
        new HexagonLayer<MapDataPoint>({
          id: 'hexagon-layer',
          data,
          pickable: true,
          extruded: true,
          radius: 15000, // radio en metros
          elevationScale: 100,
          gpuAggregation: false, // <-- IMPORTANTE: Fuerza CPU aggregation para tener object.points en el tooltip
          getPosition: d => d.position,
          getElevationWeight: d => d.weight,
          getColorWeight: d => d.weight,
          colorRange,
          transitions: {
            elevationScale: 3000
          }
        })
      ];
    } else {
      return [
        new HeatmapLayer<MapDataPoint>({
          id: 'heatmap-layer',
          data,
          pickable: false,
          getPosition: d => d.position,
          getWeight: d => d.weight,
          radiusPixels: 40,
          intensity: 1,
          threshold: 0.05,
          colorRange
        })
      ];
    }
  }, [data, layerType, colorRange]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '500px', borderRadius: '12px', overflow: 'hidden' }}>
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState }) => setViewState(viewState)}
        controller={true}
        layers={layers}
        // @ts-ignore: Dependiendo de la versión, glOptions no está tipado pero es completamente válido en ejecución
        glOptions={{ preserveDrawingBuffer: true }}
        getTooltip={({ object }) => {
          if (!object) return null;
          
          if (customTooltip) {
             return customTooltip(object, data);
          }
          
          // Soporte robusto entre versiones de DeckGL
          const count = object.points?.length || object.pointIndices?.length || object.count || 1;
          
          let totalWeight = object.elevationValue ?? object.colorValue;
          
          // Si no hay valores calculados, sumar de los datos
          if (totalWeight === undefined && object.points) {
            totalWeight = object.points.reduce((sum: number, p: any) => sum + (p.weight || p.source?.weight || 0), 0);
          } else if (totalWeight === undefined && object.pointIndices) {
            totalWeight = object.pointIndices.reduce((sum: number, idx: number) => sum + (data[idx]?.weight || 0), 0);
          }
          
          if (totalWeight === undefined) {
             totalWeight = object.weight || 0;
          }

          // Identificar el punto original (para extraer municipio y dpto)
          let firstPoint = null;
          if (object.points && object.points.length > 0) {
            firstPoint = object.points[0].source || object.points[0];
          } else if (object.pointIndices && object.pointIndices.length > 0) {
            firstPoint = data[object.pointIndices[0]];
          } else {
            firstPoint = object; // Por si es una capa directa
          }

          let locationHtml = "";
          if (firstPoint) {
            const muni = firstPoint.label || firstPoint.municipio || "";
            const depto = firstPoint.departamento || "";
            if (muni || depto) {
               // Capitalizar cada palabra correctamente (ej. SAN VICENTE -> San Vicente)
               const capitalize = (s: string) => s ? s.toLowerCase().replace(/\b\w/g, l => l.toUpperCase()) : "";
               locationHtml = `<div style="font-weight: 800; margin-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px; color: #38bdf8; font-size: 14px; white-space: normal; word-wrap: break-word;">📍 ${capitalize(muni)}${muni && depto ? ', ' : ''}${capitalize(depto)}</div>`;
            }
          }

          const {
            countLabel = "Proyectos",
            weightLabel = "Inversión",
            weightPrefix = "$",
            weightSuffix = ""
          } = tooltipLabels;

          let subtitleHtml = "";
          if (firstPoint && firstPoint.subtitle) {
            // Se añaden reglas CSS para asegurar que no se trunque el texto si es muy largo
            subtitleHtml = `<div style="font-size: 11px; color: #94a3b8; margin-bottom: 8px; line-height: 1.4; white-space: normal; word-wrap: break-word; max-width: 250px;">🏢 <b>Operadoras:</b> ${firstPoint.subtitle}</div>`;
          }

          // Renderizar tooltip HTML premium
          return {
            html: `
              ${locationHtml}
              ${subtitleHtml}
              <div style="display: flex; justify-content: space-between; gap: 16px; margin-bottom: 4px;">
                <span>${countLabel}:</span> 
                <span style="font-weight:bold; color: #fff;">${count}</span>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 16px;">
                <span>${weightLabel}:</span> 
                <span style="font-weight:bold; color: #4ade80;">${weightPrefix}${Number(totalWeight).toLocaleString('es-CO')}${weightSuffix}</span>
              </div>
            `,
            style: {
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              color: '#94a3b8',
              borderRadius: '8px',
              padding: '12px 16px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
              border: '1px solid rgba(51, 65, 85, 0.8)',
              fontSize: '13px',
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
            }
          };
        }}
      >
        {/* @ts-ignore: preserveDrawingBuffer no está tipado en algunas versiones de react-map-gl pero sí funciona en MapLibre */}
        <Map ref={mapRef} mapStyle={MAP_STYLE} preserveDrawingBuffer={true} />
      </DeckGL>

      {/* Controles Flotantes Premium con estilos en línea para garantizar visibilidad */}
      <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 10 }}>
        
        {/* Controles de Navegación */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          backgroundColor: 'rgba(15, 23, 42, 0.8)', 
          backdropFilter: 'blur(8px)', 
          borderRadius: '8px', 
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)', 
          border: '1px solid rgba(51, 65, 85, 0.5)', 
          overflow: 'hidden' 
        }}>
          <button 
            onClick={handleZoomIn}
            style={{ padding: '8px', color: '#e2e8f0', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center' }}
            title="Acercar"
          >
            <ZoomIn size={20} />
          </button>
          <div style={{ height: '1px', backgroundColor: 'rgba(51, 65, 85, 0.5)', width: '100%' }} />
          <button 
            onClick={handleZoomOut}
            style={{ padding: '8px', color: '#e2e8f0', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center' }}
            title="Alejar"
          >
            <ZoomOut size={20} />
          </button>
          <div style={{ height: '1px', backgroundColor: 'rgba(51, 65, 85, 0.5)', width: '100%' }} />
          <button 
            onClick={handleResetView}
            style={{ padding: '8px', color: '#e2e8f0', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center' }}
            title="Restablecer Vista"
          >
            <Compass size={20} />
          </button>
        </div>

        {/* Controles de Exportación */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          backgroundColor: 'rgba(15, 23, 42, 0.8)', 
          backdropFilter: 'blur(8px)', 
          borderRadius: '8px', 
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)', 
          border: '1px solid rgba(51, 65, 85, 0.5)', 
          overflow: 'hidden',
          marginTop: '8px'
        }}>
          <button 
            onClick={handleExportImage}
            style={{ padding: '8px', color: '#60a5fa', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center' }}
            title="Exportar como Imagen"
          >
            <ImageIcon size={20} />
          </button>
          <div style={{ height: '1px', backgroundColor: 'rgba(51, 65, 85, 0.5)', width: '100%' }} />
          <button 
            onClick={handleExportData}
            style={{ padding: '8px', color: '#4ade80', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center' }}
            title="Exportar Datos (CSV)"
          >
            <Download size={20} />
          </button>
        </div>

      </div>
    </div>
  );
}

"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';

interface FiltersProps {
  filtroDepto: string;
  setFiltroDepto: (v: string) => void;
  filtroMunicipio: string;
  setFiltroMunicipio: (v: string) => void;
  filtroCampo: string;
  setFiltroCampo: (v: string) => void;
}

export default function RegaliasFilters({
  filtroDepto, setFiltroDepto,
  filtroMunicipio, setFiltroMunicipio,
  filtroCampo, setFiltroCampo
}: FiltersProps) {

  const { data, isLoading } = useQuery({
    queryKey: ['regalias-filtros'],
    queryFn: async () => {
      const res = await fetch('/api/contexto-nacional/regalias-filtros');
      if (!res.ok) throw new Error("Error cargando filtros");
      return res.json();
    },
    staleTime: 60 * 60 * 1000
  });

  if (isLoading) return <div className="text-sm text-gray-500 mb-4">Cargando filtros...</div>;

  const { departamentos = [], municipios = [], campos = [] } = data || {};

  return (
    <div className="panel mb-6 p-4" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
      <span style={{ fontWeight: 600, color: 'var(--color-primary)', marginRight: '8px' }}>Filtros Globales:</span>
      
      <select 
        value={filtroDepto} 
        onChange={(e) => setFiltroDepto(e.target.value)}
        style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #ccc' }}
      >
        <option value="">Todos los Departamentos</option>
        {departamentos.map((d: string) => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>

      <select 
        value={filtroMunicipio} 
        onChange={(e) => setFiltroMunicipio(e.target.value)}
        style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #ccc' }}
      >
        <option value="">Todos los Municipios</option>
        {municipios.map((m: string) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>

      <select 
        value={filtroCampo} 
        onChange={(e) => setFiltroCampo(e.target.value)}
        style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #ccc' }}
      >
        <option value="">Todos los Campos</option>
        {campos.map((c: string) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      {(filtroDepto || filtroMunicipio || filtroCampo) && (
        <button 
          onClick={() => { setFiltroDepto(''); setFiltroMunicipio(''); setFiltroCampo(''); }}
          style={{ padding: '6px 12px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Limpiar Filtros
        </button>
      )}
    </div>
  );
}

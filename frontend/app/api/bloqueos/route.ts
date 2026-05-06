import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import {
  normalizarDepartamento,
  normalizarMunicipio,
  normalizarOperadora,
  normalizarAlarmaBloqueo
} from '@/lib/normalizacion';

const MESES = [
  "Todos", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT 
        hb.fecha_inicio,
        hb.fecha_fin,
        hb.departamento_raw as departamento,
        hb.municipio_raw as municipio,
        hb.empresa_raw as operadora,
        hb.tipo_evento,
        hb.estado_actual as estado,
        hb.causas_consolidadas as causa,
        COALESCE(de.afiliada_acp, false) as afiliada_acp
      FROM hecho_bloqueos hb
      LEFT JOIN dim_empresas de ON hb.empresa_id = de.id
      WHERE hb.fecha_inicio IS NOT NULL
    `);

    const data = result.rows.map(r => {
      const fecha = r.fecha_inicio ? new Date(r.fecha_inicio).toISOString().substring(0, 10) : '';
      const anio = fecha ? fecha.substring(0, 4) : '';
      const mesNum = fecha ? parseInt(fecha.substring(5, 7), 10) : 0;
      
      let duracionDias = 0;
      if (r.fecha_inicio && r.fecha_fin) {
        const start = new Date(r.fecha_inicio).getTime();
        const end = new Date(r.fecha_fin).getTime();
        duracionDias = Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24)));
      } else if (r.fecha_inicio) {
        duracionDias = 1; // Default duration if no end date
      }

      return {
        Fecha: fecha,
        Anio: anio,
        Mes: mesNum > 0 ? MESES[mesNum] : '',
        Departamento: normalizarDepartamento(r.departamento || ''),
        Municipio: normalizarMunicipio(r.municipio || ''),
        Operadora: normalizarOperadora(r.operadora || ''),
        TipoEvento: normalizarAlarmaBloqueo(r.tipo_evento || ''),
        DuracionDias: duracionDias,
        Estado: String(r.estado || ''),
        Causa: String(r.causa || ''),
        AfiliadaACP: r.afiliada_acp ? "Sí" : "No",
      };
    }).filter(r => r.Fecha !== '' && r.Anio.length === 4);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching from hecho_bloqueos:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

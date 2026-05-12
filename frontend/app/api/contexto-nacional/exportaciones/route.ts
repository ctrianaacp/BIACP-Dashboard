import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const text = `
      SELECT 
        e.fecha_mes,
        e.valor_fob_miles_usd,
        COALESCE(AVG(CASE WHEN p.tipo_crudo = 'Brent' THEN p.precio_cierre END), 0) as brent_avg,
        COALESCE(AVG(CASE WHEN p.tipo_crudo = 'WTI' THEN p.precio_cierre END), 0) as wti_avg
      FROM hecho_exportaciones e
      LEFT JOIN hecho_precios_crudo p 
        ON DATE_TRUNC('month', p.fecha) = e.fecha_mes AND p.tipo_crudo IN ('Brent', 'WTI')
      WHERE e.producto = 'Petróleo y derivados'
      GROUP BY e.fecha_mes, e.valor_fob_miles_usd
      ORDER BY e.fecha_mes ASC
    `;
    const res = await query(text);
    return NextResponse.json(res.rows);
  } catch (error) {
    console.error('Error fetching exportaciones data:', error);
    return NextResponse.json({ error: 'Error fetching data' }, { status: 500 });
  }
}

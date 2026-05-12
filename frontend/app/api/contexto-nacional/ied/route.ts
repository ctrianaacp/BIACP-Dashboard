import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const text = `
      SELECT 
        fecha_mes,
        MAX(CASE WHEN serie_id = 'Petrolero' THEN valor_inversion_millones_usd END) as petrolero,
        MAX(CASE WHEN serie_id = 'Total' THEN valor_inversion_millones_usd END) as total
      FROM hecho_inversion_directa
      GROUP BY fecha_mes
      ORDER BY fecha_mes ASC
    `;
    const res = await query(text);
    return NextResponse.json(res.rows);
  } catch (error) {
    console.error('Error fetching IED data:', error);
    return NextResponse.json({ error: 'Error fetching data' }, { status: 500 });
  }
}

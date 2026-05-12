import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const text = `
      SELECT 
        TO_CHAR(fecha_mes, 'YYYY') as anio,
        SUM(valor_regalia_cop) as valor_total
      FROM hecho_regalias
      WHERE tipo_hidrocarburo = 'Total'
      GROUP BY anio
      ORDER BY anio ASC
    `;
    const res = await query(text);
    return NextResponse.json(res.rows);
  } catch (error) {
    console.error('Error fetching regalias data:', error);
    return NextResponse.json({ error: 'Error fetching data' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const text = `
      SELECT
        fecha_mes as fecha,
        SUM(CASE WHEN indicador = 'Producción Mundial' THEN valor_mbpd ELSE 0 END) as produccion,
        SUM(CASE WHEN indicador = 'Consumo Mundial' THEN valor_mbpd ELSE 0 END) as consumo,
        SUM(CASE WHEN indicador = 'Producción Mundial' THEN valor_mbpd ELSE 0 END) -
        SUM(CASE WHEN indicador = 'Consumo Mundial' THEN valor_mbpd ELSE 0 END) as balance
      FROM hecho_produccion_internacional
      GROUP BY 1
      ORDER BY 1 ASC
    `;
    const res = await query(text);

    return NextResponse.json(res.rows);
  } catch (error) {
    console.error('Error fetching balance petrolero data:', error);
    return NextResponse.json({ error: 'Error fetching data' }, { status: 500 });
  }
}

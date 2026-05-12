import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const text = `
      SELECT
        COALESCE(p.fecha, t.fecha) as fecha,
        MAX(CASE WHEN p.tipo_crudo = 'Brent' THEN p.precio_cierre END) as brent,
        MAX(CASE WHEN p.tipo_crudo = 'WTI' THEN p.precio_cierre END) as wti,
        MAX(CASE WHEN p.tipo_crudo = 'Gas Natural Henry Hub' THEN p.precio_cierre END) as gas,
        MAX(t.valor) as trm
      FROM hecho_precios_crudo p
      FULL OUTER JOIN hecho_trm t ON p.fecha = t.fecha
      GROUP BY 1
      ORDER BY 1 ASC
    `;
    const res = await query(text);

    // Filter out rows that have null for all metric values
    const data = res.rows.filter(r => r.brent !== null || r.wti !== null || r.gas !== null || r.trm !== null);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching contexto internacional data:', error);
    return NextResponse.json({ error: 'Error fetching data' }, { status: 500 });
  }
}

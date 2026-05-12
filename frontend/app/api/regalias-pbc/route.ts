import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const vigencia = searchParams.get('vigencia');

  if (!vigencia) {
    return NextResponse.json({ error: 'Falta el parámetro vigencia' }, { status: 400 });
  }

  try {
    const pbcQuery = `
      SELECT 
        mes_fecha,
        sector,
        COALESCE(pbc_presupuesto, 0) as pbc,
        COALESCE(recaudo, 0) as recaudo
      FROM hecho_sgr_presupuesto
      WHERE vigencia = $1
      ORDER BY mes_fecha ASC
    `;

    const res = await pool.query(pbcQuery, [vigencia]);

    // Format data for frontend charts
    // We want to group by sector
    const data = res.rows.reduce((acc: any, row) => {
      const sector = row.sector === 'Minería' ? 'mineria' : 'hidrocarburos';
      if (!acc[sector]) acc[sector] = [];
      
      acc[sector].push({
        mes: new Date(row.mes_fecha).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }),
        pbc: Number(row.pbc),
        recaudo: Number(row.recaudo)
      });
      return acc;
    }, { mineria: [], hidrocarburos: [] });

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching PBC data:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

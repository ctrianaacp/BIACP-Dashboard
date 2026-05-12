import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const text = `
      SELECT 
        anio,
        extraccion,
        refinacion,
        total
      FROM hecho_pib_participacion
      ORDER BY id ASC
    `;
    const res = await query(text);
    return NextResponse.json(res.rows);
  } catch (error) {
    console.error('Error fetching pib participacion data:', error);
    return NextResponse.json({ error: 'Error fetching data' }, { status: 500 });
  }
}

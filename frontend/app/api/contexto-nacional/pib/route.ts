import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const text = `
      SELECT 
        trimestre,
        anio,
        pib_total,
        pib_og
      FROM hecho_pib
      ORDER BY id ASC
    `;
    const res = await query(text);
    return NextResponse.json(res.rows);
  } catch (error) {
    console.error('Error fetching pib data:', error);
    return NextResponse.json({ error: 'Error fetching data' }, { status: 500 });
  }
}

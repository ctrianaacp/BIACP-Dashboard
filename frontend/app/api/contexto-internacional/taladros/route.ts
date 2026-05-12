import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const text = `
      WITH opec_countries AS (
        SELECT 'ALGERIA' as p UNION ALL
        SELECT 'ANGOLA' UNION ALL
        SELECT 'CONGO' UNION ALL
        SELECT 'EQUATORIAL GUINEA' UNION ALL
        SELECT 'GABON' UNION ALL
        SELECT 'IRAN' UNION ALL
        SELECT 'IRAQ' UNION ALL
        SELECT 'KUWAIT' UNION ALL
        SELECT 'LIBYA' UNION ALL
        SELECT 'NIGERIA' UNION ALL
        SELECT 'SAUDI ARABIA' UNION ALL
        SELECT 'UAE - ABU DHABI' UNION ALL
        SELECT 'UAE - DUBAI' UNION ALL
        SELECT 'UAE - SHARJAH' UNION ALL
        SELECT 'VENEZUELA'
      ),
      mensual AS (
        SELECT
          fecha_mes,
          SUM(CASE WHEN pais = 'UNITED STATES' THEN taladros_activos ELSE 0 END) as eeuu,
          SUM(CASE WHEN pais IN (SELECT p FROM opec_countries) THEN taladros_activos ELSE 0 END) as opep,
          SUM(CASE WHEN pais NOT IN (SELECT p FROM opec_countries) AND pais != 'UNITED STATES' THEN taladros_activos ELSE 0 END) as no_opep,
          SUM(taladros_activos) as global
        FROM hecho_taladros_internacional
        GROUP BY fecha_mes
      )
      SELECT
        m1.fecha_mes as fecha,
        m1.eeuu,
        m1.opep,
        m1.no_opep,
        m1.global,
        CASE WHEN m12.eeuu > 0 THEN ((m1.eeuu::numeric - m12.eeuu) / m12.eeuu) * 100 ELSE null END as eeuu_yoy,
        CASE WHEN m12.opep > 0 THEN ((m1.opep::numeric - m12.opep) / m12.opep) * 100 ELSE null END as opep_yoy,
        CASE WHEN m12.no_opep > 0 THEN ((m1.no_opep::numeric - m12.no_opep) / m12.no_opep) * 100 ELSE null END as no_opep_yoy,
        CASE WHEN m12.global > 0 THEN ((m1.global::numeric - m12.global) / m12.global) * 100 ELSE null END as global_yoy
      FROM mensual m1
      LEFT JOIN mensual m12 ON m12.fecha_mes = m1.fecha_mes - interval '1 year'
      ORDER BY m1.fecha_mes ASC
    `;
    const res = await query(text);
    return NextResponse.json(res.rows);
  } catch (error) {
    console.error('Error fetching taladros data:', error);
    return NextResponse.json({ error: 'Error fetching data' }, { status: 500 });
  }
}

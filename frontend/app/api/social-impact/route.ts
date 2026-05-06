import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Inversión Social (Seleccionamos solo lo necesario para KPIs y Tabla)
    const resInversion = await query(`
      SELECT hi.anio, hi.empresa_raw, hi.departamento_raw, hi.municipio_raw, hi.valor_cop, 
             hi.num_beneficiarios, hi.beneficiarios_totales, hi.tipo_inversion,
             hi.id, hi.nombre_proyecto, hi.ods_principal,
             COALESCE(de.afiliada_acp, false) as afiliada_acp
      FROM hecho_inversion_social hi
      LEFT JOIN dim_empresas de ON hi.empresa_id = de.id
      LIMIT 10000
    `);
    
    // 2. Empleo
    const resEmpleo = await query(`
      SELECT he.anio, he.empresa_raw, he.departamento_raw, he.municipio_raw, 
             he.num_empleos, he.sexo, he.origen_contratacion,
             COALESCE(de.afiliada_acp, false) as afiliada_acp
      FROM hecho_empleo he
      LEFT JOIN dim_empresas de ON he.empresa_id = de.id
      LIMIT 30000
    `);

    // 3. Municipios (para mapa)
    const resMunicipios = await query('SELECT * FROM dim_municipios');

    return NextResponse.json({
      inversion_social: resInversion.rows,
      empleo: resEmpleo.rows,
      municipios: resMunicipios.rows,
      bienes_servicios: [] // Desactivado por volumen (800k+ registros). Usar /api/stats/dashboard?type=bienes-servicios
    });
  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

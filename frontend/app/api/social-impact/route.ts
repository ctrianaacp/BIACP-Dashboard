import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    // 1. Inversión Social (Desactivado temporalmente hasta migrar tabla de Inversión)
    const resInversion = { rows: [] };
    /*
    const resInversion = await query(`
      SELECT anio, empresa_raw, departamento_raw, municipio_raw, valor_cop, 
             tipo_inversion, id, nombre_proyecto, ods_principal
      FROM hecho_inversion_social
      LIMIT 10000
    `);
    */
    
    // 2. Empleo
    const resEmpleo = await query(`
      SELECT anio, empresa_raw, departamento_raw, municipio_raw, 
             num_empleos, sexo, origen_contratacion
      FROM hecho_empleo
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

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get('tipo'); // 'petroleo' o 'gas'
  
  if (!tipo || (tipo !== 'petroleo' && tipo !== 'gas')) {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
  }

  const table = tipo === 'petroleo' ? 'hecho_produccion' : 'hecho_produccion_gas';
  const metricColumn = tipo === 'petroleo' ? 'produccion_bpd' : 'produccion_mpcd';

  try {
    const res = await query(`
      SELECT 
        hp.departamento_raw as "Departamento",
        hp.municipio_raw as "Municipio",
        COALESCE(de.nombre_oficial, hp.empresa_raw) as "Operadora",
        hp.campo as "Campo",
        hp.contrato as "Contrato",
        hp.mes as "Mes",
        hp.${metricColumn} as "Produccion",
        TO_CHAR(hp.fecha, 'YYYY-MM-DD') as "Fecha",
        (CASE WHEN de.afiliada_acp = true THEN 'Sí' ELSE 'No' END) as "AfiliadaACP",
        hp.municipio_raw || ' / ' || hp.departamento_raw as "MunicipioDepartamento"
      FROM ${table} hp
      LEFT JOIN dim_empresas de ON hp.empresa_id = de.id
      ORDER BY hp.fecha DESC
    `);
    
    return NextResponse.json(res.rows);
  } catch (err: any) {
    console.error(`Error fetching produccion ${tipo}:`, err);
    return NextResponse.json({ error: 'Error de base de datos' }, { status: 500 });
  }
}

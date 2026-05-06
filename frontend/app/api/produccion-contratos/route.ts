import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Endpoint que distribuye la producción de petróleo según la participación
 * registrada en dim_contratos.
 * 
 * Lógica:
 *   - Si el contrato tiene socios en dim_contratos:
 *       • Operadora recibe: produccion_bpd × (1 - %cont1 - %cont2)
 *       • Contratista 1 recibe: produccion_bpd × %cont1
 *       • Contratista 2 recibe: produccion_bpd × %cont2
 *   - Si el contrato NO está en dim_contratos:
 *       • La operadora recibe el 100% de la producción
 */
export async function GET() {
  try {
    const res = await query(`
      -- 1. Participación del OPERADOR (su porción después de descontar contratistas)
      SELECT 
        hp.departamento_raw                                          AS "Departamento",
        hp.municipio_raw                                             AS "Municipio",
        COALESCE(de_op.nombre_oficial, de.nombre_oficial, hp.empresa_raw) AS "Operadora",
        hp.campo                                                     AS "Campo",
        hp.contrato                                                  AS "Contrato",
        hp.mes                                                       AS "Mes",
        ROUND(
          hp.produccion_bpd * (
            1 - COALESCE(dc.participacion_cont1, 0) 
              - COALESCE(dc.participacion_cont2, 0)
          ), 2
        )                                                            AS "Produccion",
        TO_CHAR(hp.fecha, 'YYYY-MM-DD')                              AS "Fecha",
        CASE 
          WHEN COALESCE(de_op.afiliada_acp, de.afiliada_acp) = true THEN 'Sí' 
          ELSE 'No' 
        END                                                          AS "AfiliadaACP",
        'Operadora'                                                  AS "Rol"
      FROM hecho_produccion hp
      LEFT JOIN dim_contratos dc  ON hp.contrato = dc.contrato
      LEFT JOIN dim_empresas  de  ON hp.empresa_id = de.id
      LEFT JOIN dim_empresas  de_op ON dc.operador_id = de_op.id

      UNION ALL

      -- 2. Participación del CONTRATISTA 1
      SELECT 
        hp.departamento_raw                                          AS "Departamento",
        hp.municipio_raw                                             AS "Municipio",
        COALESCE(de_c1.nombre_oficial, dc.contratista1_raw)          AS "Operadora",
        hp.campo                                                     AS "Campo",
        hp.contrato                                                  AS "Contrato",
        hp.mes                                                       AS "Mes",
        ROUND(hp.produccion_bpd * dc.participacion_cont1, 2)         AS "Produccion",
        TO_CHAR(hp.fecha, 'YYYY-MM-DD')                              AS "Fecha",
        CASE WHEN de_c1.afiliada_acp = true THEN 'Sí' ELSE 'No' END AS "AfiliadaACP",
        'Contratista'                                                AS "Rol"
      FROM hecho_produccion hp
      INNER JOIN dim_contratos dc  ON hp.contrato = dc.contrato
        AND dc.contratista1_id IS NOT NULL
        AND dc.participacion_cont1 > 0
      LEFT JOIN dim_empresas de_c1 ON dc.contratista1_id = de_c1.id

      UNION ALL

      -- 3. Participación del CONTRATISTA 2
      SELECT 
        hp.departamento_raw                                          AS "Departamento",
        hp.municipio_raw                                             AS "Municipio",
        COALESCE(de_c2.nombre_oficial, dc.contratista2_raw)          AS "Operadora",
        hp.campo                                                     AS "Campo",
        hp.contrato                                                  AS "Contrato",
        hp.mes                                                       AS "Mes",
        ROUND(hp.produccion_bpd * dc.participacion_cont2, 2)         AS "Produccion",
        TO_CHAR(hp.fecha, 'YYYY-MM-DD')                              AS "Fecha",
        CASE WHEN de_c2.afiliada_acp = true THEN 'Sí' ELSE 'No' END AS "AfiliadaACP",
        'Contratista'                                                AS "Rol"
      FROM hecho_produccion hp
      INNER JOIN dim_contratos dc  ON hp.contrato = dc.contrato
        AND dc.contratista2_id IS NOT NULL
        AND dc.participacion_cont2 > 0
      LEFT JOIN dim_empresas de_c2 ON dc.contratista2_id = de_c2.id

      ORDER BY "Fecha" DESC
    `);

    return NextResponse.json(res.rows);
  } catch (err: any) {
    console.error('Error fetching produccion-contratos:', err);
    return NextResponse.json({ error: 'Error de base de datos' }, { status: 500 });
  }
}

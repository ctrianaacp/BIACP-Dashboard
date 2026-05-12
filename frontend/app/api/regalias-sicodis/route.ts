import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const vigencia = searchParams.get("vigencia") || "2025 - 2026";

  try {
    // 1. Obtener los agregados históricos por bienio para el gráfico
    const historicoQuery = `
      SELECT 
        vigencia,
        SUM(COALESCE(presupuesto_corriente, 0) + COALESCE(rendimientos_financieros, 0)) as presupuesto_total
      FROM hecho_regalias_sicodis
      GROUP BY vigencia
      ORDER BY vigencia
    `;

    // 2. Obtener el detalle de los registros para la vigencia seleccionada
    const detalleQuery = `
      SELECT 
        departamento_raw as departamento,
        region,
        tipo_entidad as entidad,
        concepto as proyecto,
        municipio_raw as municipio,
        COALESCE(presupuesto_total, 0) as presupuesto_total,
        COALESCE(presupuesto_corriente, 0) as presupuesto_corriente,
        COALESCE(rendimientos_financieros, 0) as rendimientos_financieros,
        COALESCE(recaudo_total, 0) as recaudo_total,
        COALESCE(recaudo_corriente, 0) as recaudo_corriente,
        COALESCE(avance_recaudo_total, 0) as avance_recaudo_total
      FROM hecho_regalias_sicodis
      WHERE vigencia = $1
    `;

    // 3. Obtener todas las vigencias disponibles para el filtro
    const vigenciasQuery = `
      SELECT DISTINCT vigencia 
      FROM hecho_regalias_sicodis 
      ORDER BY vigencia DESC
    `;

    const [historicoRes, detalleRes, vigenciasRes] = await Promise.all([
      pool.query(historicoQuery),
      pool.query(detalleQuery, [vigencia]),
      pool.query(vigenciasQuery)
    ]);

    return NextResponse.json({
      registros: detalleRes.rows,
      historico: historicoRes.rows,
      vigencias: vigenciasRes.rows.map(r => r.vigencia),
      vigencia_activa: vigencia,
      total: detalleRes.rowCount
    });

  } catch (error) {
    console.error("Error en API regalias-sicodis:", error);
    return NextResponse.json(
      { error: "Error consultando base de datos SICODIS", registros: [], historico: [], vigencias: [] },
      { status: 500 }
    );
  }
}

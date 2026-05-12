import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const vigencia = searchParams.get("vigencia") || "2025 - 2026";

  try {
    // 1. Histórico por bienio — usamos presupuesto_total (que incluye todo: corriente + disp. inicial + rendimientos + adiciones)
    //    Esta es la cifra más comparable entre bienios y la que se usa en presentaciones oficiales del SGR.
    const historicoQuery = `
      SELECT 
        vigencia,
        SUM(COALESCE(presupuesto_total, 0)) as presupuesto_total,
        SUM(COALESCE(presupuesto_corriente, 0)) as presupuesto_corriente,
        SUM(COALESCE(rendimientos_financieros, 0)) as rendimientos_financieros,
        SUM(COALESCE(disponibilidad_inicial, 0)) as disponibilidad_inicial,
        SUM(COALESCE(recaudo_total, 0)) as recaudo_total,
        SUM(COALESCE(recaudo_corriente, 0)) as recaudo_corriente
      FROM hecho_regalias_sicodis
      GROUP BY vigencia
      ORDER BY vigencia
    `;

    // 2. Detalle de registros para la vigencia seleccionada
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
        COALESCE(disponibilidad_inicial, 0) as disponibilidad_inicial,
        COALESCE(recaudo_total, 0) as recaudo_total,
        COALESCE(recaudo_corriente, 0) as recaudo_corriente,
        COALESCE(avance_recaudo_total, 0) as avance_recaudo_total,
        COALESCE(avance_recaudo_corriente, 0) as avance_recaudo_corriente
      FROM hecho_regalias_sicodis
      WHERE vigencia = $1
    `;

    // 3. Vigencias disponibles
    const vigenciasQuery = `
      SELECT DISTINCT vigencia 
      FROM hecho_regalias_sicodis 
      ORDER BY vigencia DESC
    `;

    // 4. Agregados de la vigencia activa (para KPIs globales calculados en DB)
    const kpisQuery = `
      SELECT
        SUM(COALESCE(presupuesto_total, 0)) as presupuesto_total,
        SUM(COALESCE(presupuesto_corriente, 0)) as presupuesto_corriente,
        SUM(COALESCE(rendimientos_financieros, 0)) as rendimientos_financieros,
        SUM(COALESCE(disponibilidad_inicial, 0)) as disponibilidad_inicial,
        SUM(COALESCE(recaudo_total, 0)) as recaudo_total,
        SUM(COALESCE(recaudo_corriente, 0)) as recaudo_corriente
      FROM hecho_regalias_sicodis
      WHERE vigencia = $1
    `;

    const [historicoRes, detalleRes, vigenciasRes, kpisRes] = await Promise.all([
      pool.query(historicoQuery),
      pool.query(detalleQuery, [vigencia]),
      pool.query(vigenciasQuery),
      pool.query(kpisQuery, [vigencia])
    ]);

    const kpisRow = kpisRes.rows[0] || {};

    return NextResponse.json({
      registros: detalleRes.rows,
      historico: historicoRes.rows,
      vigencias: vigenciasRes.rows.map((r: any) => r.vigencia),
      vigencia_activa: vigencia,
      total: detalleRes.rowCount,
      // KPIs pre-calculados desde la DB (la fuente de verdad)
      kpis: {
        presupuesto_total: Number(kpisRow.presupuesto_total || 0),
        presupuesto_corriente: Number(kpisRow.presupuesto_corriente || 0),
        rendimientos_financieros: Number(kpisRow.rendimientos_financieros || 0),
        disponibilidad_inicial: Number(kpisRow.disponibilidad_inicial || 0),
        recaudo_total: Number(kpisRow.recaudo_total || 0),
        recaudo_corriente: Number(kpisRow.recaudo_corriente || 0),
      }
    });

  } catch (error) {
    console.error("Error en API regalias-sicodis:", error);
    return NextResponse.json(
      { error: "Error consultando base de datos SICODIS", registros: [], historico: [], vigencias: [], kpis: {} },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const vigencia = searchParams.get("vigencia") || "2025-2026";
  const regiones = searchParams.getAll("region");
  const departamentos = searchParams.getAll("departamento");

  try {
    let filterClause = "WHERE vigencia = $1";
    const queryParams: any[] = [vigencia];
    let paramIndex = 2;

    if (regiones.length > 0) {
      filterClause += ` AND region = ANY($${paramIndex})`;
      queryParams.push(regiones);
      paramIndex++;
    }
    
    if (departamentos.length > 0) {
      filterClause += ` AND departamento_raw = ANY($${paramIndex})`;
      queryParams.push(departamentos);
      paramIndex++;
    }

    // 1. Histórico por bienio — Valores REALES de la DB, sin datos sintéticos.
    // Aplicando los mismos filtros espaciales (region, depto) sobre todo el histórico,
    // excepto el de vigencia.
    let historicoFilterClause = "WHERE 1=1";
    const historicoParams: any[] = [];
    let hParamIndex = 1;
    if (regiones.length > 0) {
      historicoFilterClause += ` AND region = ANY($${hParamIndex})`;
      historicoParams.push(regiones);
      hParamIndex++;
    }
    if (departamentos.length > 0) {
      historicoFilterClause += ` AND departamento_raw = ANY($${hParamIndex})`;
      historicoParams.push(departamentos);
      hParamIndex++;
    }

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
      ${historicoFilterClause}
      GROUP BY vigencia
      ORDER BY vigencia ASC
    `;

    // 2. Detalle de registros para la vigencia seleccionada (Limitado para no colapsar frontend)
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
      ${filterClause}
      LIMIT 2000
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
        SUM(COALESCE(recaudo_corriente, 0)) as recaudo_corriente,
        COUNT(*) as total_registros
      FROM hecho_regalias_sicodis
      ${filterClause}
    `;

    // 5. Opciones de filtros completos (para que los dropdowns tengan todas las opciones, sin afectarse por el LIMIT)
    const opcionesQuery = `
      SELECT DISTINCT region, departamento_raw as departamento
      FROM hecho_regalias_sicodis
      WHERE region IS NOT NULL AND region != 'N/A' 
        AND departamento_raw IS NOT NULL AND departamento_raw != 'N/A'
    `;

    const [detalleRes, vigenciasRes, kpisRes, historicoRes, opcionesRes] = await Promise.all([
      pool.query(detalleQuery, queryParams),
      pool.query(vigenciasQuery),
      pool.query(kpisQuery, queryParams),
      pool.query(historicoQuery, historicoParams),
      pool.query(opcionesQuery)
    ]);

    const kpisRow = kpisRes.rows[0] || {};
    
    // Extraer valores únicos para los filtros
    const regionesUnicas = Array.from(new Set(opcionesRes.rows.map(r => r.region))).sort();
    const departamentosUnicos = Array.from(new Set(opcionesRes.rows.map(r => r.departamento))).sort();

    return NextResponse.json({
      registros: detalleRes.rows,
      historico: historicoRes.rows,
      vigencias: vigenciasRes.rows.map((r: any) => r.vigencia),
      regiones: regionesUnicas,
      departamentos: departamentosUnicos,
      vigencia_activa: vigencia,
      total: Number(kpisRow.total_registros || 0),
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

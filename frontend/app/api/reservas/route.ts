import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const producto = searchParams.get("producto") || "Petroleo";

    const aniosParam = searchParams.get("anios");
    const operadorasParam = searchParams.get("operadoras");
    const camposParam = searchParams.get("campos");
    const contratosParam = searchParams.get("contratos");

    const colName = producto === "Petroleo" ? "liquido" : "gas";

    // --- Filtros para KPIs / Top Campos / Top Operadoras (incluye año) ---
    const mainConditions: string[] = [];
    const mainValues: any[] = [];
    let mainIdx = 1;

    if (aniosParam) {
      const aniosList = aniosParam.split(",").filter(a => a !== "Todos").map(Number).filter(n => !isNaN(n));
      if (aniosList.length > 0) {
        mainConditions.push(`ano = ANY($${mainIdx}::int[])`);
        mainValues.push(aniosList);
        mainIdx++;
      }
    }
    if (operadorasParam) {
      const ops = operadorasParam.split(",").filter(o => o !== "Todas" && o !== "Todos");
      if (ops.length > 0) {
        mainConditions.push(`empresa_raw = ANY($${mainIdx}::text[])`);
        mainValues.push(ops);
        mainIdx++;
      }
    }
    if (camposParam) {
      const campos = camposParam.split(",").filter(c => c !== "Todos");
      if (campos.length > 0) {
        mainConditions.push(`campo_raw = ANY($${mainIdx}::text[])`);
        mainValues.push(campos);
        mainIdx++;
      }
    }
    if (contratosParam) {
      const contratos = contratosParam.split(",").filter(c => c !== "Todos");
      if (contratos.length > 0) {
        mainConditions.push(`contrato_raw = ANY($${mainIdx}::text[])`);
        mainValues.push(contratos);
        mainIdx++;
      }
    }

    // Condiciones sin el filtro de año (para subquery MAX(ano))
    const condSinAno = mainConditions.filter(c => !c.startsWith("ano ="));
    const valsSinAno = mainValues.filter((_, i) => {
      const cond = mainConditions[i];
      return !cond.startsWith("ano =");
    });

    // Renumerar condiciones sin año desde $1
    let renumIdx = 1;
    const condSinAnoRenumerado: string[] = [];
    for (const c of condSinAno) {
      condSinAnoRenumerado.push(c.replace(/\$\d+/g, () => `$${renumIdx++}`));
    }

    // Si el usuario filtró por año explícitamente, usamos ese filtro (que es el primer valor en condMainRenumerado que empieza con ano=)
    // De lo contrario, buscamos el MAX(ano) válido.
    const hasAnoFilter = mainConditions.some(c => c.startsWith("ano ="));
    const whereSinAno = condSinAnoRenumerado.length > 0 ? `WHERE ${condSinAnoRenumerado.join(" AND ")}` : "";
    
    // MAX(ano) usando solo los filtros sin año, y exigiendo que haya reservas 1P reales (>0)
    const maxAnoSql = `(SELECT MAX(ano) FROM hecho_reservas_resumen WHERE descripcion = 'TOTAL RESERVA PROBADA (1P):' AND ${colName} > 0 ${whereSinAno ? "AND " + whereSinAno.replace("WHERE ", "") : ""})`;

    // Reconstruir mainConditions renumeradas correctamente para kpis/tops
    let mainRenumIdx = 1;
    const condMainRenumerado: string[] = [];
    for (const c of mainConditions) {
      condMainRenumerado.push(c.replace(/\$\d+/g, () => `$${mainRenumIdx++}`));
    }

    const condTop = hasAnoFilter
      ? condMainRenumerado.join(" AND ")
      : (condSinAnoRenumerado.length > 0
          ? `ano = ${maxAnoSql} AND ${condSinAnoRenumerado.join(" AND ")}`
          : `ano = ${maxAnoSql}`);

    const valsTop = hasAnoFilter ? mainValues : valsSinAno;

    // --- 1. KPIs ---
    const kpisQuery = `
      SELECT 
        ano,
        SUM(CASE WHEN descripcion = 'TOTAL RESERVA PROBADA (1P):' THEN ${colName} ELSE 0 END) as reservas_1p,
        SUM(CASE WHEN descripcion = 'Producción Acumulada  a 31 de Diciembre' THEN ${colName} ELSE 0 END) as produccion_acumulada
      FROM hecho_reservas_resumen
      WHERE ${condTop}
      GROUP BY ano
    `;
    const { rows: kpisRes } = await pool.query(kpisQuery, valsTop);
    const kpis = kpisRes.map(k => ({
      ano: k.ano,
      reservas_remanentes: parseFloat(k.reservas_1p),
      produccion_acumulada: parseFloat(k.produccion_acumulada),
      estimado_maximo_reservas: parseFloat(k.reservas_1p) + parseFloat(k.produccion_acumulada)
    }));

    // --- 2. Top 10 Campos ---
    const topCamposQuery = `
      SELECT 
        campo_raw as nombre,
        SUM(CASE WHEN descripcion = 'TOTAL RESERVA PROBADA (1P):' THEN ${colName} ELSE 0 END) as reservas_remanentes,
        SUM(CASE WHEN descripcion = 'Producción Acumulada  a 31 de Diciembre' THEN ${colName} ELSE 0 END) as produccion_acumulada
      FROM hecho_reservas_resumen
      WHERE ${condTop} AND campo_raw IS NOT NULL
      GROUP BY campo_raw
      ORDER BY reservas_remanentes DESC
      LIMIT 10
    `;
    const { rows: topCampos } = await pool.query(topCamposQuery, valsTop);

    // --- 3. Top 10 Operadoras ---
    const topOperadorasQuery = `
      SELECT 
        empresa_raw as nombre,
        SUM(CASE WHEN descripcion = 'TOTAL RESERVA PROBADA (1P):' THEN ${colName} ELSE 0 END) as reservas_remanentes,
        SUM(CASE WHEN descripcion = 'Producción Acumulada  a 31 de Diciembre' THEN ${colName} ELSE 0 END) as produccion_acumulada
      FROM hecho_reservas_resumen
      WHERE ${condTop} AND empresa_raw IS NOT NULL
      GROUP BY empresa_raw
      ORDER BY reservas_remanentes DESC
      LIMIT 10
    `;
    const { rows: topOperadoras } = await pool.query(topOperadorasQuery, valsTop);

    // --- 4. Histórico (sin filtro de año, para ver curva completa) ---
    let histIdx = 1;
    const histValues: any[] = [];
    const histConditions: string[] = [];

    if (operadorasParam) {
      const ops = operadorasParam.split(",").filter(o => o !== "Todas" && o !== "Todos");
      if (ops.length > 0) {
        histConditions.push(`empresa_raw = ANY($${histIdx}::text[])`);
        histValues.push(ops);
        histIdx++;
      }
    }
    if (camposParam) {
      const campos = camposParam.split(",").filter(c => c !== "Todos");
      if (campos.length > 0) {
        histConditions.push(`campo_raw = ANY($${histIdx}::text[])`);
        histValues.push(campos);
        histIdx++;
      }
    }
    if (contratosParam) {
      const contratos = contratosParam.split(",").filter(c => c !== "Todos");
      if (contratos.length > 0) {
        histConditions.push(`contrato_raw = ANY($${histIdx}::text[])`);
        histValues.push(contratos);
        histIdx++;
      }
    }

    const histWhereResumen = histConditions.length > 0 ? `WHERE ${histConditions.join(" AND ")}` : "";
    const histWhereProd = histConditions.length > 0
      ? `WHERE ${histConditions
          .map(c => c.replace(/empresa_raw/g, "COALESCE(empresa_raw, '')").replace(/campo_raw/g, "campo").replace(/contrato_raw/g, "contrato"))
          .join(" AND ")}`
      : "";

    const prodCol = producto === "Petroleo" ? "produccion_bpd" : "produccion_mpcd";
    const prodTable = producto === "Petroleo" ? "hecho_produccion" : "hecho_produccion_gas";

    const historicoQuery = `
      WITH res AS (
        SELECT 
          ano,
          SUM(CASE WHEN descripcion = 'TOTAL RESERVA PROBADA (1P):' THEN ${colName} ELSE 0 END) as reservas_1p,
          SUM(CASE WHEN descripcion LIKE '%Reservas Probables (PRB)%' THEN ${colName} ELSE 0 END) as reservas_probables,
          SUM(CASE WHEN descripcion LIKE '%Reservas Posibles (PS)%' THEN ${colName} ELSE 0 END) as reservas_posibles
        FROM hecho_reservas_resumen
        ${histWhereResumen}
        GROUP BY ano
      ), prod AS (
        SELECT 
          EXTRACT(YEAR FROM fecha)::int as ano, 
          (SUM(${prodCol}) / 12) * 365 as prod_anual 
        FROM ${prodTable}
        ${histWhereProd}
        GROUP BY ano
      )
      SELECT 
        COALESCE(r.ano, p.ano) as ano,
        COALESCE(r.reservas_1p, 0) as reservas_1p,
        COALESCE(r.reservas_probables, 0) as reservas_probables,
        COALESCE(r.reservas_posibles, 0) as reservas_posibles,
        COALESCE(p.prod_anual, 0) as prod_anual
      FROM res r
      FULL OUTER JOIN prod p ON r.ano = p.ano
      WHERE COALESCE(r.ano, p.ano) >= 2016 AND COALESCE(r.reservas_1p, 0) > 0
      ORDER BY ano ASC
    `;
    const { rows: historico } = await pool.query(historicoQuery, histValues);

    return NextResponse.json({
      kpis: kpis[0] || { estimado_maximo_reservas: 0, produccion_acumulada: 0, reservas_remanentes: 0 },
      top_campos: topCampos,
      top_operadoras: topOperadoras,
      historico: historico
    });

  } catch (error) {
    console.error("Error en API reservas:", error);
    return NextResponse.json({ error: "Error interno", detail: String(error) }, { status: 500 });
  }
}

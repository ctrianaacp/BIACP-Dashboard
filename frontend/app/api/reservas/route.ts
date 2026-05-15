import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const producto = searchParams.get("producto") || "Petroleo"; // 'Petroleo' o 'Gas'

    const aniosParam = searchParams.get("anios");
    const operadorasParam = searchParams.get("operadoras");
    const camposParam = searchParams.get("campos");
    const contratosParam = searchParams.get("contratos");

    // Construir condicionales
    const filterConditions = [];
    const filterValues: any[] = [producto];
    let paramIndex = 2; // El producto es el $1

    if (aniosParam) {
      // Ignoramos 'Todos' si viene en la lista
      const aniosList = aniosParam.split(',').filter(a => a !== 'Todos').map(Number).filter(n => !isNaN(n));
      if (aniosList.length > 0) {
        filterConditions.push(`ano = ANY($${paramIndex}::int[])`);
        filterValues.push(aniosList);
        paramIndex++;
      }
    }

    if (operadorasParam) {
      const ops = operadorasParam.split(',').filter(o => o !== 'Todas' && o !== 'Todos');
      if (ops.length > 0) {
        filterConditions.push(`empresa_raw = ANY($${paramIndex}::text[])`);
        filterValues.push(ops);
        paramIndex++;
      }
    }

    if (camposParam) {
      const campos = camposParam.split(',').filter(c => c !== 'Todos');
      if (campos.length > 0) {
        filterConditions.push(`campo_raw = ANY($${paramIndex}::text[])`);
        filterValues.push(campos);
        paramIndex++;
      }
    }

    if (contratosParam) {
      const contratos = contratosParam.split(',').filter(c => c !== 'Todos');
      if (contratos.length > 0) {
        filterConditions.push(`contrato_raw = ANY($${paramIndex}::text[])`);
        filterValues.push(contratos);
        paramIndex++;
      }
    }

    const whereClause = filterConditions.length > 0 ? ` AND ${filterConditions.join(' AND ')}` : '';

    // 1. KPI Globales (Sumatoria del último año filtrado o absoluto)
    const kpisQuery = `
      SELECT 
        ano,
        SUM(estimado_maximo_reservas) as estimado_maximo_reservas,
        SUM(produccion_acumulada) as produccion_acumulada,
        (SUM(estimado_maximo_reservas) - SUM(produccion_acumulada)) as reservas_remanentes
      FROM hecho_reservas_yacimientos
      WHERE producto_nombre = $1 ${whereClause}
      GROUP BY ano
      ORDER BY ano DESC
      LIMIT 1
    `;
    const { rows: kpis } = await pool.query(kpisQuery, filterValues);

    // 2. Top 10 Campos con Mayores Reservas Remanentes (para el último año filtrado)
    let maxAnoCondition = `(SELECT MAX(ano) FROM hecho_reservas_yacimientos WHERE producto_nombre = $1 ${whereClause})`;
    // Si ya filtramos por un año, no hace falta buscar el MAX, pero usar la misma subquery garantiza coherencia
    const topCamposQuery = `
      SELECT 
        campo_raw as nombre,
        SUM(estimado_maximo_reservas) as estimado_maximo_reservas,
        SUM(produccion_acumulada) as produccion_acumulada,
        (SUM(estimado_maximo_reservas) - SUM(produccion_acumulada)) as reservas_remanentes
      FROM hecho_reservas_yacimientos
      WHERE producto_nombre = $1 AND ano = ${maxAnoCondition} ${whereClause}
      GROUP BY campo_raw
      ORDER BY reservas_remanentes DESC
      LIMIT 10
    `;
    const { rows: topCampos } = await pool.query(topCamposQuery, filterValues);

    // 3. Top 10 Operadoras con Mayores Reservas Remanentes (para el último año filtrado)
    const topOperadorasQuery = `
      SELECT 
        empresa_raw as nombre,
        SUM(estimado_maximo_reservas) as estimado_maximo_reservas,
        SUM(produccion_acumulada) as produccion_acumulada,
        (SUM(estimado_maximo_reservas) - SUM(produccion_acumulada)) as reservas_remanentes
      FROM hecho_reservas_yacimientos
      WHERE producto_nombre = $1 AND ano = ${maxAnoCondition} ${whereClause}
      GROUP BY empresa_raw
      ORDER BY reservas_remanentes DESC
      LIMIT 10
    `;
    const { rows: topOperadoras } = await pool.query(topOperadorasQuery, filterValues);

    // 4. Histórico de Reservas (1P, 2P, 3P) - ignoramos el filtro de años para ver la curva completa
    const colName = producto === 'Petroleo' ? 'liquido' : 'gas';
    const filterConditionsSinAno = filterConditions.filter(c => !c.startsWith('ano ='));
    const whereResumen = filterConditionsSinAno.length > 0 ? ` WHERE ${filterConditionsSinAno.map(c => c.replace(/\$([0-9]+)/g, (match, p1) => `$${parseInt(p1)-1}`)).join(' AND ')}` : '';
    // Param values need to exclude `producto` and the `aniosList`
    // Since `aniosList` was pushed right after `producto` if it existed, we need to carefully extract the values.
    // The easiest way is to re-evaluate the parameters for the historical query without `ano`.
    
    let histParamIndex = 1;
    const histValues: any[] = [];
    const histConditions = [];

    if (operadorasParam) {
      const ops = operadorasParam.split(',').filter(o => o !== 'Todas' && o !== 'Todos');
      if (ops.length > 0) {
        histConditions.push(`empresa_raw = ANY($${histParamIndex}::text[])`);
        histValues.push(ops);
        histParamIndex++;
      }
    }

    if (camposParam) {
      const campos = camposParam.split(',').filter(c => c !== 'Todos');
      if (campos.length > 0) {
        histConditions.push(`campo_raw = ANY($${histParamIndex}::text[])`);
        histValues.push(campos);
        histParamIndex++;
      }
    }

    if (contratosParam) {
      const contratos = contratosParam.split(',').filter(c => c !== 'Todos');
      if (contratos.length > 0) {
        histConditions.push(`contrato_raw = ANY($${histParamIndex}::text[])`);
        histValues.push(contratos);
        histParamIndex++;
      }
    }

    const histWhereResumen = histConditions.length > 0 ? ` WHERE ${histConditions.join(' AND ')}` : '';
    const histWhereProd = histConditions.length > 0 ? ` WHERE ${histConditions.map(c => c.replace(/empresa_raw/g, 'COALESCE(empresa_raw, \'\')').replace(/campo_raw/g, 'campo').replace(/contrato_raw/g, 'contrato')).join(' AND ')}` : '';

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
          (SUM(${producto === 'Petroleo' ? 'produccion_bpd' : 'produccion_mpcd'}) / 12) * 365 as prod_anual 
        FROM ${producto === 'Petroleo' ? 'hecho_produccion' : 'hecho_produccion_gas'}
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
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:REusFdvkAnx4O49NuRMqjzKpQwNfvCx47tuFxazGjJGx3gVacuuy4lEqXBseVfSx@localhost:5433/postgres' });

async function check() {
  try {
    const producto = "Petroleo";
    const colName = "liquido";
    
    // Simulate no filters first
    const mainConditions = [];
    const mainValues = [];
    
    const condSinAnoRenumerado = [];
    const valsSinAno = [];
    
    const whereSinAno = condSinAnoRenumerado.length > 0 ? `WHERE ${condSinAnoRenumerado.join(" AND ")}` : "";
    const maxAnoSql = `(SELECT MAX(ano) FROM hecho_reservas_resumen ${whereSinAno})`;
    const condTop = condSinAnoRenumerado.length > 0
      ? `ano = ${maxAnoSql} AND ${condSinAnoRenumerado.join(" AND ")}`
      : `ano = ${maxAnoSql}`;
      
    const kpisQuery = `
      SELECT 
        ano,
        SUM(CASE WHEN descripcion = 'TOTAL RESERVA PROBADA (1P):' THEN ${colName} ELSE 0 END) as reservas_1p,
        SUM(CASE WHEN descripcion = 'Producción Acumulada  a 31 de Diciembre' THEN ${colName} ELSE 0 END) as produccion_acumulada
      FROM hecho_reservas_resumen
      WHERE ${condTop}
      GROUP BY ano
    `;
    console.log("kpisQuery:\n", kpisQuery);
    const kpisRes = await pool.query(kpisQuery, valsSinAno);
    console.log("KPIs OK", kpisRes.rowCount);
    
    const histWhereResumen = "";
    const histWhereProd = "";
    const prodCol = "produccion_bpd";
    const prodTable = "hecho_produccion";
    const histValues = [];
    
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
    console.log("historicoQuery:\n", historicoQuery);
    const histRes = await pool.query(historicoQuery, histValues);
    console.log("Hist OK", histRes.rowCount);

  } catch (e) {
    console.error("ERROR:", e);
  } finally {
    pool.end();
  }
}
check();

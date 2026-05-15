const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:REusFdvkAnx4O49NuRMqjzKpQwNfvCx47tuFxazGjJGx3gVacuuy4lEqXBseVfSx@localhost:5433/postgres' });

async function check() {
    const filterConditions = [];
    const filterValues = [];
    let paramIndex = 1;

    filterConditions.push(`ano = ANY($${paramIndex}::int[])`);
    filterValues.push([2024]);
    paramIndex++;

    filterConditions.push(`empresa_raw = ANY($${paramIndex}::text[])`);
    filterValues.push(['ECOPETROL S.A.']);
    paramIndex++;

    const whereClause = filterConditions.length > 0 ? ` WHERE ${filterConditions.join(' AND ')}` : '';
    const colName = 'liquido';

    let kpisQueryAno = `(SELECT MAX(ano) FROM hecho_reservas_resumen ${whereClause})`;
    const kpisQuery = `
      SELECT 
        ano,
        SUM(CASE WHEN descripcion = 'TOTAL RESERVA PROBADA (1P):' THEN ${colName} ELSE 0 END) as reservas_1p,
        SUM(CASE WHEN descripcion = 'Producción Acumulada  a 31 de Diciembre' THEN ${colName} ELSE 0 END) as produccion_acumulada
      FROM hecho_reservas_resumen
      WHERE ano = ${kpisQueryAno} ${filterConditions.length > 0 ? ' AND ' + filterConditions.filter(c => !c.startsWith('ano')).join(' AND ') : ''}
      GROUP BY ano
    `;
    console.log("KPI Query:", kpisQuery);
    const kpisRes = await pool.query(kpisQuery, filterValues);
    console.log(kpisRes.rows);

    const filterConditionsSinAno = filterConditions.filter(c => !c.startsWith('ano ='));
    const histWhereResumen = filterConditionsSinAno.length > 0 ? ` WHERE ${filterConditionsSinAno.join(' AND ')}` : '';

    const historicoQuery = `
      WITH res AS (
        SELECT 
          ano,
          SUM(CASE WHEN descripcion = 'TOTAL RESERVA PROBADA (1P):' THEN ${colName} ELSE 0 END) as reservas_1p
        FROM hecho_reservas_resumen
        ${histWhereResumen}
        GROUP BY ano
      )
      SELECT * FROM res ORDER BY ano DESC LIMIT 3
    `;
    console.log("Hist Query:", historicoQuery);
    const histRes = await pool.query(historicoQuery, filterValues);
    console.log(histRes.rows);

    pool.end();
}
check();

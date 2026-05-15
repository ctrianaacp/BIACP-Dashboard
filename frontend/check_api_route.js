const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:REusFdvkAnx4O49NuRMqjzKpQwNfvCx47tuFxazGjJGx3gVacuuy4lEqXBseVfSx@localhost:5433/postgres' });

async function check() {
  const colName = 'liquido';
  const q = `
    WITH res AS (
      SELECT 
        ano,
        SUM(CASE WHEN descripcion = 'TOTAL RESERVA PROBADA (1P):' THEN ${colName} ELSE 0 END) as reservas_1p,
        SUM(CASE WHEN descripcion LIKE '%Reservas Probables (PRB)%' THEN ${colName} ELSE 0 END) as reservas_probables,
        SUM(CASE WHEN descripcion LIKE '%Reservas Posibles (PS)%' THEN ${colName} ELSE 0 END) as reservas_posibles
      FROM hecho_reservas_resumen
      GROUP BY ano
    ), prod AS (
      SELECT 
        EXTRACT(YEAR FROM fecha)::int as ano, 
        (SUM(produccion_bpd) / 12) * 365 as prod_anual 
      FROM hecho_produccion
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
    WHERE COALESCE(r.ano, p.ano) >= 2016 AND COALESCE(r.ano, p.ano) <= 2025
    ORDER BY ano ASC
  `;
  const res = await pool.query(q);
  console.log(res.rows);
  
  const d2025 = await pool.query(`SELECT DISTINCT descripcion, sum(liquido) FROM hecho_reservas_resumen WHERE ano = 2025 GROUP BY descripcion`);
  console.log('2025 descriptions:', d2025.rows);

  pool.end();
}
check();

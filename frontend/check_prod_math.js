const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:REusFdvkAnx4O49NuRMqjzKpQwNfvCx47tuFxazGjJGx3gVacuuy4lEqXBseVfSx@localhost:5433/postgres' });

async function check() {
  const t1 = await pool.query(`
    SELECT 
      EXTRACT(YEAR FROM fecha)::int as ano, 
      (SUM(produccion_bpd) / 12) * 365 as prod_anual_petroleo 
    FROM hecho_produccion
    GROUP BY ano ORDER BY ano
  `);
  console.log('Prod petroleo anual:', t1.rows);

  const t2 = await pool.query(`
    SELECT 
      EXTRACT(YEAR FROM fecha)::int as ano, 
      (SUM(produccion_mpcd) / 12) * 365 as prod_anual_gas 
    FROM hecho_produccion_gas
    GROUP BY ano ORDER BY ano
  `);
  console.log('Prod gas anual:', t2.rows);

  pool.end();
}
check();

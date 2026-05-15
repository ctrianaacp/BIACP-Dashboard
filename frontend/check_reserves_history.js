const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:REusFdvkAnx4O49NuRMqjzKpQwNfvCx47tuFxazGjJGx3gVacuuy4lEqXBseVfSx@localhost:5433/postgres' });

async function check() {
  const t1 = await pool.query("SELECT ano, sum(liquido) as sum_liquido, sum(gas) as sum_gas FROM hecho_reservas_resumen GROUP BY ano ORDER BY ano");
  console.log('hecho_reservas_resumen por ano:', t1.rows);
  
  const d1 = await pool.query("SELECT * FROM hecho_reservas_resumen WHERE liquido > 0 OR gas > 0 LIMIT 5");
  console.log('sample data:', d1.rows);
  pool.end();
}
check();

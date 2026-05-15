const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:REusFdvkAnx4O49NuRMqjzKpQwNfvCx47tuFxazGjJGx3gVacuuy4lEqXBseVfSx@localhost:5433/postgres' });

async function check() {
  const d = await pool.query("SELECT ano, count(*) FROM hecho_reservas_yacimientos GROUP BY ano");
  console.log('Años en yacimientos:', d.rows);
  pool.end();
}
check();

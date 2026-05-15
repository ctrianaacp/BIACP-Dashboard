const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:REusFdvkAnx4O49NuRMqjzKpQwNfvCx47tuFxazGjJGx3gVacuuy4lEqXBseVfSx@localhost:5433/postgres' });

async function check() {
  const t1 = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'hecho_reservas_resumen'");
  console.log('hecho_reservas_resumen cols:', t1.rows);
  
  const d1 = await pool.query("SELECT * FROM hecho_reservas_resumen LIMIT 3");
  console.log('hecho_reservas_resumen data:', d1.rows);

  const t2 = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'hecho_reservas_yacimientos'");
  console.log('hecho_reservas_yacimientos cols:', t2.rows);

  const d2 = await pool.query("SELECT * FROM hecho_reservas_yacimientos LIMIT 3");
  console.log('hecho_reservas_yacimientos data:', d2.rows);

  pool.end();
}
check();

const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:REusFdvkAnx4O49NuRMqjzKpQwNfvCx47tuFxazGjJGx3gVacuuy4lEqXBseVfSx@localhost:5433/postgres' });

async function run() {
  const res1 = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'hecho_sgr_presupuesto';");
  console.log("hecho_sgr_presupuesto columns:", res1.rows.map(r => r.column_name).join(", "));
  
  const res2 = await pool.query("SELECT * FROM hecho_sgr_presupuesto LIMIT 1;");
  console.log("hecho_sgr_presupuesto data:", res2.rows);

  const res3 = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'hecho_regalias_sicodis';");
  console.log("hecho_regalias_sicodis columns:", res3.rows.map(r => r.column_name).join(", "));
  
  pool.end();
}
run();

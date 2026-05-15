const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:REusFdvkAnx4O49NuRMqjzKpQwNfvCx47tuFxazGjJGx3gVacuuy4lEqXBseVfSx@localhost:5433/postgres' });

async function check() {
  const d = await pool.query("SELECT DISTINCT descripcion FROM hecho_reservas_resumen ORDER BY descripcion");
  console.log('Descripciones:', d.rows.map(r => r.descripcion));
  pool.end();
}
check();

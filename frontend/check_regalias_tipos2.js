const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:REusFdvkAnx4O49NuRMqjzKpQwNfvCx47tuFxazGjJGx3gVacuuy4lEqXBseVfSx@localhost:5433/postgres' });

async function check() {
  try {
    const res = await pool.query(`
      SELECT tipo_hidrocarburo, sum(valor_regalia_cop) 
      FROM hecho_regalias 
      WHERE EXTRACT(YEAR FROM fecha_mes) IN (2024, 2025)
      GROUP BY tipo_hidrocarburo
    `);
    console.log(res.rows);
  } finally {
    pool.end();
  }
}
check();

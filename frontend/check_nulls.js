const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:REusFdvkAnx4O49NuRMqjzKpQwNfvCx47tuFxazGjJGx3gVacuuy4lEqXBseVfSx@localhost:5433/postgres' });

async function check() {
  try {
    const res = await pool.query(`
      SELECT tipo_hidrocarburo, sum(regalia_cop) 
      FROM hecho_regalias_campo 
      WHERE EXTRACT(YEAR FROM fecha_mes) = 2024 
        AND campo_raw IS NULL
      GROUP BY 1
    `);
    console.log(res.rows);
  } finally {
    pool.end();
  }
}
check();

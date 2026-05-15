const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:REusFdvkAnx4O49NuRMqjzKpQwNfvCx47tuFxazGjJGx3gVacuuy4lEqXBseVfSx@localhost:5433/postgres' });

async function check() {
  try {
    const tipos = await pool.query(`
      SELECT 
        CASE 
          WHEN tipo_hidrocarburo = 'O' THEN 'PETROLEO'
          WHEN tipo_hidrocarburo = 'G' THEN 'GAS'
          ELSE tipo_hidrocarburo
        END as nombre,
        EXTRACT(YEAR FROM fecha_mes) as anio,
        SUM(regalia_cop) as valor
      FROM hecho_regalias_campo
      WHERE EXTRACT(YEAR FROM fecha_mes) IN (2024, 2025)
      GROUP BY 1, 2
    `);
    console.log('Tipos:', tipos.rows);
  } finally {
    pool.end();
  }
}
check();

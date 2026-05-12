const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:REusFdvkAnx4O49NuRMqjzKpQwNfvCx47tuFxazGjJGx3gVacuuy4lEqXBseVfSx@localhost:5433/postgres' });

async function run() {
  const res = await pool.query(`
    SELECT 
      vigencia, 
      sum(COALESCE(presupuesto_corriente, 0)) as corriente,
      sum(COALESCE(disponibilidad_inicial, 0)) as disponibilidad,
      sum(COALESCE(rendimientos_financieros, 0)) as rendimientos,
      sum(COALESCE(presupuesto_total, 0)) as total_sicodis,
      sum(COALESCE(presupuesto_corriente, 0) + COALESCE(disponibilidad_inicial, 0) + COALESCE(rendimientos_financieros, 0)) as formula_usuario
    FROM hecho_regalias_sicodis 
    GROUP BY vigencia ORDER BY vigencia;
  `);
  console.table(res.rows);
  pool.end();
}
run();

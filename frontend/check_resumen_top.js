const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:REusFdvkAnx4O49NuRMqjzKpQwNfvCx47tuFxazGjJGx3gVacuuy4lEqXBseVfSx@localhost:5433/postgres' });

async function check() {
  const d = await pool.query(`
    SELECT ano, campo_raw, sum(liquido) as reservas_1p
    FROM hecho_reservas_resumen
    WHERE descripcion = 'TOTAL RESERVA PROBADA (1P):' AND liquido > 0 AND ano = 2024
    GROUP BY ano, campo_raw
    ORDER BY reservas_1p DESC
    LIMIT 5
  `);
  console.log('Top Campos 2024 (1P):', d.rows);

  const d2 = await pool.query(`
    SELECT ano, empresa_raw, sum(liquido) as reservas_1p
    FROM hecho_reservas_resumen
    WHERE descripcion = 'TOTAL RESERVA PROBADA (1P):' AND liquido > 0 AND ano = 2024
    GROUP BY ano, empresa_raw
    ORDER BY reservas_1p DESC
    LIMIT 5
  `);
  console.log('Top Operadoras 2024 (1P):', d2.rows);

  pool.end();
}
check();

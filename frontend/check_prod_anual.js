const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:REusFdvkAnx4O49NuRMqjzKpQwNfvCx47tuFxazGjJGx3gVacuuy4lEqXBseVfSx@localhost:5433/postgres' });

async function check() {
  const t1 = await pool.query(`
    SELECT substring(fecha::text, 1, 4) as ano, SUM(produccion) as prod_anual
    FROM hecho_produccion_petroleo_mensual
    GROUP BY substring(fecha::text, 1, 4)
    ORDER BY ano
  `);
  console.log('Prod petroleo anual:', t1.rows);

  const t2 = await pool.query(`
    SELECT substring(fecha::text, 1, 4) as ano, SUM(produccion) as prod_anual
    FROM hecho_produccion_gas_mensual
    GROUP BY substring(fecha::text, 1, 4)
    ORDER BY ano
  `);
  console.log('Prod gas anual:', t2.rows);

  pool.end();
}
check();

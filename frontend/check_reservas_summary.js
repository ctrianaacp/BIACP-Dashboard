const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:REusFdvkAnx4O49NuRMqjzKpQwNfvCx47tuFxazGjJGx3gVacuuy4lEqXBseVfSx@localhost:5433/postgres' });

async function check() {
  const t1 = await pool.query("SELECT producto_nombre, ano, sum(estimado_maximo_reservas) as max_res, sum(produccion_acumulada) as prod_acum FROM hecho_reservas_yacimientos GROUP BY producto_nombre, ano ORDER BY ano, producto_nombre");
  console.log('summary:', t1.rows);
  pool.end();
}
check();

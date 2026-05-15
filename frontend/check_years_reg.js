const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:REusFdvkAnx4O49NuRMqjzKpQwNfvCx47tuFxazGjJGx3gVacuuy4lEqXBseVfSx@localhost:5433/postgres' });

async function check() {
  try {
    const asignacion = await pool.query(`SELECT EXTRACT(YEAR FROM fecha_mes) as ano, SUM(asignacion_cop) as val FROM hecho_regalias_asignacion WHERE tipo_beneficiario = 'MUNICIPIO PRODUCTOR' GROUP BY ano`);
    console.log('Años en asignacion Municipio Productor:', asignacion.rows);
    
    const hField = await pool.query(`SELECT EXTRACT(YEAR FROM fecha_mes) as ano, sum(regalia_cop) as reg FROM hecho_regalias_campo GROUP BY ano`);
    console.log('Años en regalias campo:', hField.rows);
  } finally {
    pool.end();
  }
}
check();

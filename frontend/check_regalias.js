const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:REusFdvkAnx4O49NuRMqjzKpQwNfvCx47tuFxazGjJGx3gVacuuy4lEqXBseVfSx@localhost:5433/postgres' });

async function check() {
  try {
    const tipos = await pool.query(`SELECT tipo_beneficiario, COUNT(*) FROM hecho_regalias_asignacion GROUP BY tipo_beneficiario`);
    console.log('Tipos de beneficiario en asignacion:', tipos.rows);
    
    const tiposHidro = await pool.query(`SELECT tipo_hidrocarburo, sum(regalia_cop) as reg FROM hecho_regalias_campo GROUP BY tipo_hidrocarburo`);
    console.log('Tipos hidrocarburo en campo:', tiposHidro.rows);
  } finally {
    pool.end();
  }
}
check();

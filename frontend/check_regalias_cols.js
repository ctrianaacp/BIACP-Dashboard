const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:REusFdvkAnx4O49NuRMqjzKpQwNfvCx47tuFxazGjJGx3gVacuuy4lEqXBseVfSx@localhost:5433/postgres' });

async function check() {
  try {
    const res = await pool.query(`SELECT table_name, column_name FROM information_schema.columns WHERE table_name LIKE 'hecho_regalias%'`);
    console.log(res.rows.filter(r => r.column_name.includes('tipo_hidrocarburo') || r.column_name.includes('producto')));
  } finally {
    pool.end();
  }
}
check();

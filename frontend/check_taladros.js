const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:REusFdvkAnx4O49NuRMqjzKpQwNfvCx47tuFxazGjJGx3gVacuuy4lEqXBseVfSx@localhost:5433/postgres' });

async function check() {
  try {
    const res = await pool.query(`SELECT global, global_yoy FROM hecho_taladros LIMIT 3`);
    console.log(res.rows);
  } finally {
    pool.end();
  }
}
check();

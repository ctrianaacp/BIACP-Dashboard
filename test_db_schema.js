const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5433/postgres'
});

async function run() {
  try {
    const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'hecho_regalias';");
    console.log("Columns in hecho_regalias:", res.rows);
    
    const res2 = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'dim_campos';");
    console.log("Columns in dim_campos:", res2.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

run();

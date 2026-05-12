const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5433/postgres'
});

async function run() {
  try {
    const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'hecho_regalias_sicodis';");
    console.log("Columns in hecho_regalias_sicodis:");
    res.rows.forEach(r => console.log(`${r.column_name}: ${r.data_type}`));
    
    const countRes = await pool.query("SELECT COUNT(*) FROM hecho_regalias_sicodis");
    console.log("Total rows:", countRes.rows[0].count);

    const sampleRes = await pool.query("SELECT * FROM hecho_regalias_sicodis LIMIT 1");
    console.log("Sample row:", sampleRes.rows[0]);
  } catch (err) {
    console.error("Error querying:", err.message);
  } finally {
    pool.end();
  }
}

run();

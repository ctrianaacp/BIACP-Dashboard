import { pool } from './frontend/lib/db.js';

async function checkData() {
  try {
    const res = await pool.query('SELECT * FROM hecho_regalias LIMIT 5');
    console.log("hecho_regalias:", res.rows);
    const campos = await pool.query('SELECT * FROM dim_campos LIMIT 5');
    console.log("dim_campos:", campos.rows);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    pool.end();
  }
}

checkData();

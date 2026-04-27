import { Pool } from 'pg';

const pool = new Pool({
  user: 'biacp',
  host: 'localhost',
  database: 'inversion_bienes_servicios',
  password: 'biacp2024',
  port: 5436,
});

async function test() {
  try {
    const res = await pool.query(`SELECT COUNT(*) FROM hecho_empleo`);
    console.log(`TABLA hecho_empleo: ${res.rows[0].count} registros`);
    if (res.rows[0].count > 0) {
      const sample = await pool.query(`SELECT * FROM hecho_empleo LIMIT 1`);
      console.log('MUESTRA:', JSON.stringify(sample.rows[0], null, 2));
    }
    process.exit(0);
  } catch (err) {
    console.error('ERROR EN DB:', err);
    process.exit(1);
  }
}

test();

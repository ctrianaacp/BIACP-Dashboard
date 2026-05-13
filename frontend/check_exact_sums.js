const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:REusFdvkAnx4O49NuRMqjzKpQwNfvCx47tuFxazGjJGx3gVacuuy4lEqXBseVfSx@localhost:5433/postgres' });

pool.query(`
  SELECT SUM(presupuesto_corriente) FROM hecho_regalias_sicodis WHERE vigencia = '2025-2026'
`).then(r => { console.log("2025-2026:", r.rows); });

pool.query(`
  SELECT SUM(presupuesto_corriente) FROM hecho_regalias_sicodis WHERE vigencia = '2025 - 2026'
`).then(r => { console.log("2025 - 2026:", r.rows); pool.end(); });

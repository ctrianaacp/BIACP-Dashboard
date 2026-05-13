const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:REusFdvkAnx4O49NuRMqjzKpQwNfvCx47tuFxazGjJGx3gVacuuy4lEqXBseVfSx@localhost:5433/postgres' });

pool.query(`
  SELECT * FROM hecho_regalias_sicodis ORDER BY cargado_en DESC LIMIT 1
`).then(r => { console.log(r.rows); pool.end(); });

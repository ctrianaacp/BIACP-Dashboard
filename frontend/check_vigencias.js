const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:REusFdvkAnx4O49NuRMqjzKpQwNfvCx47tuFxazGjJGx3gVacuuy4lEqXBseVfSx@localhost:5433/postgres' });

pool.query(`
  SELECT 
    vigencia,
    SUM(presupuesto_corriente) as p_corr
  FROM hecho_regalias_sicodis
  GROUP BY vigencia
`).then(r => { console.log(r.rows); pool.end(); });

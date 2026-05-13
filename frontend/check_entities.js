const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:REusFdvkAnx4O49NuRMqjzKpQwNfvCx47tuFxazGjJGx3gVacuuy4lEqXBseVfSx@localhost:5433/postgres' });

pool.query(`
  SELECT tipo_entidad, SUM(presupuesto_corriente) as p_corr
  FROM hecho_regalias_sicodis
  WHERE vigencia = '2025-2026'
  GROUP BY tipo_entidad
`).then(r => { console.log(r.rows); pool.end(); });

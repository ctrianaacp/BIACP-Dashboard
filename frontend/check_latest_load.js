const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:REusFdvkAnx4O49NuRMqjzKpQwNfvCx47tuFxazGjJGx3gVacuuy4lEqXBseVfSx@localhost:5433/postgres' });

pool.query(`
  SELECT 
    vigencia,
    SUM(presupuesto_corriente) as p_corr,
    SUM(rendimientos_financieros) as rend
  FROM hecho_regalias_sicodis
  WHERE vigencia LIKE '2025%' AND cargado_en = '2026-05-13T22:00:18.538Z'
  GROUP BY vigencia
`).then(r => { console.log(r.rows); pool.end(); });

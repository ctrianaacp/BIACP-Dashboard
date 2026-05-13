const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:REusFdvkAnx4O49NuRMqjzKpQwNfvCx47tuFxazGjJGx3gVacuuy4lEqXBseVfSx@localhost:5433/postgres' });

pool.query(`
  SELECT 
    COUNT(*) as total_rows,
    SUM(presupuesto_corriente) as p_corr
  FROM hecho_regalias_sicodis
  WHERE vigencia LIKE '2025%'
`).then(r => { console.log("All rows:", r.rows); });

pool.query(`
  SELECT 
    COUNT(*) as total_rows,
    SUM(presupuesto_corriente) as p_corr
  FROM hecho_regalias_sicodis
  WHERE vigencia LIKE '2025%' AND region IS NULL
`).then(r => { console.log("Null region rows:", r.rows); pool.end(); });

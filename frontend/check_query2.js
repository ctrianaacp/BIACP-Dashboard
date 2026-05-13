const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:REusFdvkAnx4O49NuRMqjzKpQwNfvCx47tuFxazGjJGx3gVacuuy4lEqXBseVfSx@localhost:5433/postgres' });
pool.query(`
      SELECT tipo_beneficiario, EXTRACT(YEAR FROM fecha_mes) as anio, COUNT(*) 
      FROM hecho_regalias_asignacion 
      WHERE EXTRACT(YEAR FROM fecha_mes) IN (2024, 2025)
      GROUP BY 1, 2
`).then(r => { console.log(r.rows); pool.end(); });

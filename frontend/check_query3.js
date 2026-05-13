const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:REusFdvkAnx4O49NuRMqjzKpQwNfvCx47tuFxazGjJGx3gVacuuy4lEqXBseVfSx@localhost:5433/postgres' });
pool.query(`
      SELECT EXTRACT(YEAR FROM fecha_mes) as anio, COUNT(*) 
      FROM hecho_regalias_campo 
      WHERE EXTRACT(YEAR FROM fecha_mes) IN (2024, 2025)
      GROUP BY 1
`).then(r => { console.log("hecho_regalias_campo:", r.rows); pool.end(); });

const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:REusFdvkAnx4O49NuRMqjzKpQwNfvCx47tuFxazGjJGx3gVacuuy4lEqXBseVfSx@localhost:5433/postgres' });
pool.query("SELECT EXTRACT(YEAR FROM fecha_mes) as anio, COUNT(*) FROM hecho_regalias_asignacion GROUP BY anio").then(r => { console.log(r.rows); pool.end(); });

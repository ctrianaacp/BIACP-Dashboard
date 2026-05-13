const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:REusFdvkAnx4O49NuRMqjzKpQwNfvCx47tuFxazGjJGx3gVacuuy4lEqXBseVfSx@localhost:5433/postgres' });
pool.query("SELECT * FROM hecho_regalias_campo LIMIT 1").then(r => console.log("campo:", r.rows));
pool.query("SELECT * FROM hecho_regalias_operadora LIMIT 1").then(r => console.log("operadora:", r.rows));
pool.query("SELECT * FROM hecho_regalias_pxq LIMIT 1").then(r => { console.log("pxq:", r.rows); pool.end(); });

const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:REusFdvkAnx4O49NuRMqjzKpQwNfvCx47tuFxazGjJGx3gVacuuy4lEqXBseVfSx@localhost:5433/postgres' });
pool.query("SELECT COUNT(*) FROM hecho_produccion").then(r => { console.log("hecho_produccion count: ", r.rows); pool.end(); });
pool.query("SELECT COUNT(*) FROM hecho_produccion_gas").then(r => { console.log("hecho_produccion_gas count: ", r.rows); });

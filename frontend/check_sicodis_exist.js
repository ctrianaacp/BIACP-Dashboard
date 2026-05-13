const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:REusFdvkAnx4O49NuRMqjzKpQwNfvCx47tuFxazGjJGx3gVacuuy4lEqXBseVfSx@localhost:5433/postgres' });
pool.query("SELECT table_name FROM information_schema.tables WHERE table_name = 'hecho_regalias_sicodis'").then(r => { console.log(r.rows); pool.end(); });

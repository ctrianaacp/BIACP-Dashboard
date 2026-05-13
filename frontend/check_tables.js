const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:REusFdvkAnx4O49NuRMqjzKpQwNfvCx47tuFxazGjJGx3gVacuuy4lEqXBseVfSx@localhost:5433/postgres' });
pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
  .then(r => { console.log(r.rows.map(x => x.table_name)); pool.end(); })
  .catch(e => { console.error(e); pool.end(); });

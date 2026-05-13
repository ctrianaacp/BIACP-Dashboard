const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:REusFdvkAnx4O49NuRMqjzKpQwNfvCx47tuFxazGjJGx3gVacuuy4lEqXBseVfSx@localhost:5433/postgres' });
Promise.all([
  pool.query("SELECT COUNT(*) FROM hecho_empleo").then(r => console.log("empleo:", r.rows)),
  pool.query("SELECT COUNT(*) FROM hecho_bienes_servicios").then(r => console.log("bienes:", r.rows)),
  pool.query("SELECT COUNT(*) FROM hecho_inversion_social").then(r => console.log("social:", r.rows))
]).then(() => pool.end());

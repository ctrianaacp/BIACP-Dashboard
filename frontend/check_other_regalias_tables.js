const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:REusFdvkAnx4O49NuRMqjzKpQwNfvCx47tuFxazGjJGx3gVacuuy4lEqXBseVfSx@localhost:5433/postgres' });

async function getSummary() {
  const tables = [
    'hecho_regalias',
    'hecho_regalias_asignacion',
    'hecho_regalias_campo',
    'hecho_regalias_operadora',
    'hecho_regalias_pxq',
    'hecho_sgr_presupuesto'
  ];
  
  for (const table of tables) {
    try {
      const countRes = await pool.query(`SELECT COUNT(*) as c FROM ${table}`);
      const columnsRes = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1
      `, [table]);
      const columns = columnsRes.rows.map(r => r.column_name).join(', ');
      
      console.log(`\nTable: ${table}`);
      console.log(`Rows: ${countRes.rows[0].c}`);
      console.log(`Columns: ${columns}`);
    } catch(e) {
      console.log(`\nTable: ${table} - Error/No existe`);
    }
  }
  pool.end();
}

getSummary();

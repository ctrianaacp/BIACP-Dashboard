const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:REusFdvkAnx4O49NuRMqjzKpQwNfvCx47tuFxazGjJGx3gVacuuy4lEqXBseVfSx@localhost:5433/postgres' });

async function run() {
  // 1. Check SGR presupuesto data
  const r1 = await pool.query("SELECT COUNT(*) as total, MIN(mes_fecha) as min_fecha, MAX(mes_fecha) as max_fecha FROM hecho_sgr_presupuesto;");
  console.log("=== hecho_sgr_presupuesto stats ===");
  console.log(r1.rows[0]);

  const r2 = await pool.query("SELECT DISTINCT sector FROM hecho_sgr_presupuesto;");
  console.log("Sectors:", r2.rows.map(r => r.sector));
  
  const r3 = await pool.query("SELECT DISTINCT vigencia FROM hecho_sgr_presupuesto;");
  console.log("Vigencias:", r3.rows.map(r => r.vigencia));

  // 2. Sample SGR data
  const r4 = await pool.query("SELECT * FROM hecho_sgr_presupuesto ORDER BY mes_fecha LIMIT 5;");
  console.log("\n=== Sample rows ===");
  console.table(r4.rows);

  // 3. Check SICODIS recaudo_corriente
  const r5 = await pool.query(`
    SELECT 
      vigencia,
      SUM(COALESCE(presupuesto_corriente, 0)) as p_corriente,
      SUM(COALESCE(rendimientos_financieros, 0)) as rendimientos,
      SUM(COALESCE(presupuesto_corriente, 0) + COALESCE(rendimientos_financieros, 0)) as p_oficial,
      SUM(COALESCE(recaudo_corriente, 0)) as r_corriente,
      SUM(COALESCE(recaudo_total, 0)) as r_total,
      CASE WHEN SUM(COALESCE(presupuesto_corriente, 0) + COALESCE(rendimientos_financieros, 0)) > 0 
           THEN ROUND(SUM(COALESCE(recaudo_total, 0)) / SUM(COALESCE(presupuesto_corriente, 0) + COALESCE(rendimientos_financieros, 0)) * 100, 2)
           ELSE 0 END as avance_pct
    FROM hecho_regalias_sicodis
    WHERE vigencia = '2025 - 2026'
    GROUP BY vigencia;
  `);
  console.log("\n=== SICODIS 2025-2026 KPIs ===");
  console.table(r5.rows);

  // 4. Check all vigencias for historico chart
  const r6 = await pool.query(`
    SELECT vigencia,
      ROUND(SUM(COALESCE(presupuesto_corriente, 0) + COALESCE(rendimientos_financieros, 0)) / 1000000000000, 1) as billones
    FROM hecho_regalias_sicodis
    GROUP BY vigencia ORDER BY vigencia;
  `);
  console.log("\n=== Historico (Billones) ===");
  console.table(r6.rows);

  pool.end();
}
run();

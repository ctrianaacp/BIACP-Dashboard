const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:REusFdvkAnx4O49NuRMqjzKpQwNfvCx47tuFxazGjJGx3gVacuuy4lEqXBseVfSx@localhost:5433/postgres' });

pool.query(`
  SELECT 
    SUM(presupuesto_corriente) as pc,
    SUM(rendimientos_financieros) as rf,
    SUM(mineral_sin_identificacion) as msi,
    SUM(reintegros) as reintegros,
    SUM(recursos_sin_distribuir) as rsd,
    SUM(multas_sanciones) as ms,
    SUM(excedentes_faep_fonpet) as faep,
    SUM(modificacion_liquidacion) as ml,
    SUM(mayor_recaudo) as mr,
    SUM(adicion_asign_directas) as aad,
    SUM(controversias_judiciales) as cj,
    SUM(desahorro_fae) as fae
  FROM hecho_regalias_sicodis
  WHERE vigencia = '2025-2026'
`).then(r => { console.log(r.rows); pool.end(); });

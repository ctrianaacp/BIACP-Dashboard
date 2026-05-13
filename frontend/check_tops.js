const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:REusFdvkAnx4O49NuRMqjzKpQwNfvCx47tuFxazGjJGx3gVacuuy4lEqXBseVfSx@localhost:5433/postgres' });

async function run() {
  const deptosQuery = `
    SELECT 
      COALESCE(departamento_raw, 'SIN ASIGNAR') as nombre,
      EXTRACT(YEAR FROM fecha_mes) as anio,
      SUM(regalia_cop) as valor
    FROM hecho_regalias_campo
    WHERE EXTRACT(YEAR FROM fecha_mes) IN (2024, 2025)
    GROUP BY 1, 2
    ORDER BY valor DESC LIMIT 10
  `;
  const res = await pool.query(deptosQuery);
  console.log("Departamentos from campo:", res.rows);
  
  const munAsignacionQuery = `
    SELECT 
      entidad as nombre,
      EXTRACT(YEAR FROM fecha_mes) as anio,
      SUM(asignacion_cop) as valor
    FROM hecho_regalias_asignacion
    WHERE tipo_beneficiario = 'MUNICIPIO PRODUCTOR' AND EXTRACT(YEAR FROM fecha_mes) IN (2024, 2025)
    GROUP BY 1, 2
    ORDER BY valor DESC LIMIT 10
  `;
  const res2 = await pool.query(munAsignacionQuery);
  console.log("Municipios from asignacion:", res2.rows);

  pool.end();
}
run();

const { Client } = require('pg'); 
const client = new Client({ connectionString: 'postgresql://postgres:REusFdvkAnx4O49NuRMqjzKpQwNfvCx47tuFxazGjJGx3gVacuuy4lEqXBseVfSx@localhost:5433/postgres' }); 
client.connect().then(async () => { 
  const res = await client.query('SELECT hb.anio, hb.departamento_raw as departamento, hb.municipio_raw as municipio, (CASE WHEN de.afiliada_acp = true THEN \'Sí\' ELSE \'No\' END) as afiliada_acp, SUM(hb.valor_cop) as total_cop, COUNT(*) as registros FROM hecho_bienes_servicios hb LEFT JOIN dim_empresas de ON hb.empresa_id = de.id GROUP BY hb.anio, hb.departamento_raw, hb.municipio_raw, de.afiliada_acp'); 
  console.log('BYS Size:', JSON.stringify(res.rows).length); 
  client.end(); 
}).catch(console.error);

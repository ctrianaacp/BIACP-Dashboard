const fs = require('fs');
const { Client } = require('pg');

const env = fs.readFileSync('.env.local', 'utf8').split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=')[1].trim();

const client = new Client({ connectionString: env });

async function seed() {
  await client.connect();
  
  // Seed Inversión Extranjera Directa
  await client.query('DELETE FROM hecho_inversion_directa;');
  const iedData = [
    { m: '2023-01-01', p: 847, t: 4164 },
    { m: '2023-04-01', p: 1058, t: 5335 },
    { m: '2023-07-01', p: 696, t: 3838 },
    { m: '2023-10-01', p: 458, t: 3457 },
    { m: '2024-01-01', p: 623, t: 3547 },
    { m: '2024-04-01', p: 614, t: 2766 },
    { m: '2024-07-01', p: 435, t: 3305 },
    { m: '2024-10-01', p: 394, t: 4066 },
    { m: '2025-01-01', p: 569, t: 2766 },
    { m: '2025-04-01', p: 681, t: 3298 },
    { m: '2025-07-01', p: 615, t: 2883 },
    { m: '2025-10-01', p: 634, t: 2522 }
  ];
  
  for (const d of iedData) {
    await client.query('INSERT INTO hecho_inversion_directa (fecha_mes, serie_id, valor_inversion_millones_usd) VALUES ($1, $2, $3)', [d.m, 'Petrolero', d.p]);
    await client.query('INSERT INTO hecho_inversion_directa (fecha_mes, serie_id, valor_inversion_millones_usd) VALUES ($1, $2, $3)', [d.m, 'Total', d.t]);
  }
  
  // Seed Regalías
  await client.query('DELETE FROM hecho_regalias;');
  const regaliasData = [
    { y: '2004-12-01', val: 2.6 },
    { y: '2005-12-01', val: 2.9 },
    { y: '2006-12-01', val: 3.7 },
    { y: '2007-12-01', val: 3.6 },
    { y: '2008-12-01', val: 5.5 },
    { y: '2009-12-01', val: 3.8 },
    { y: '2010-12-01', val: 5.5 },
    { y: '2011-12-01', val: 8.2 },
    { y: '2012-12-01', val: 8.6 },
    { y: '2013-12-01', val: 8.2 },
    { y: '2014-12-01', val: 7.4 },
    { y: '2015-12-01', val: 5.8 },
    { y: '2016-12-01', val: 4.0 },
    { y: '2017-12-01', val: 5.0 },
    { y: '2018-12-01', val: 6.5 },
    { y: '2019-12-01', val: 6.5 },
    { y: '2020-12-01', val: 3.9 },
    { y: '2021-12-01', val: 7.0 },
    { y: '2022-12-01', val: 11.2 },
    { y: '2023-12-01', val: 9.0 },
    { y: '2024-12-01', val: 8.1 },
    { y: '2025-12-01', val: 8.5 }
  ];
  
  for (const r of regaliasData) {
    const copVal = r.val * 1000000000000; // Billones to exact COP
    await client.query('INSERT INTO hecho_regalias (fecha_mes, municipio_id, tipo_hidrocarburo, valor_regalia_cop, volumen_produccion) VALUES ($1, $2, $3, $4, $5)', [r.y, 0, 'Total', copVal, 0]);
  }
  
  console.log('IED and Regalias populated successfully!');
  await client.end();
}

seed().catch(console.error);

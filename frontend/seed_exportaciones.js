const fs = require('fs');
const { Client } = require('pg');

const env = fs.readFileSync('.env.local', 'utf8').split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=')[1].trim();

const client = new Client({ connectionString: env });

async function seed() {
  await client.connect();
  
  await client.query(`
    DROP TABLE IF EXISTS hecho_exportaciones CASCADE;
    CREATE TABLE hecho_exportaciones (
      id SERIAL PRIMARY KEY,
      fecha_mes DATE NOT NULL,
      producto VARCHAR(100) NOT NULL,
      valor_fob_miles_usd NUMERIC NOT NULL,
      volumen_toneladas NUMERIC,
      cargado_en TIMESTAMPTZ DEFAULT NOW()
    );

    INSERT INTO hecho_exportaciones (fecha_mes, producto, valor_fob_miles_usd, volumen_toneladas) VALUES 
    ('2023-07-01', 'Petróleo y derivados', 1430000, 0),
    ('2023-08-01', 'Petróleo y derivados', 1437000, 0),
    ('2023-09-01', 'Petróleo y derivados', 1515000, 0),
    ('2023-10-01', 'Petróleo y derivados', 1543000, 0),
    ('2023-11-01', 'Petróleo y derivados', 1214000, 0),
    ('2023-12-01', 'Petróleo y derivados', 1462000, 0),
    ('2024-01-01', 'Petróleo y derivados', 1061000, 0),
    ('2024-02-01', 'Petróleo y derivados', 1119000, 0),
    ('2024-03-01', 'Petróleo y derivados', 1361000, 0),
    ('2024-04-01', 'Petróleo y derivados', 1370000, 0),
    ('2024-05-01', 'Petróleo y derivados', 1416000, 0),
    ('2024-06-01', 'Petróleo y derivados', 1314000, 0),
    ('2024-07-01', 'Petróleo y derivados', 1339000, 0),
    ('2024-08-01', 'Petróleo y derivados', 1293000, 0),
    ('2024-09-01', 'Petróleo y derivados', 1188000, 0),
    ('2024-10-01', 'Petróleo y derivados', 1230000, 0),
    ('2024-11-01', 'Petróleo y derivados', 1102000, 0),
    ('2024-12-01', 'Petróleo y derivados', 1243000, 0),
    ('2025-01-01', 'Petróleo y derivados', 1086000, 0),
    ('2025-02-01', 'Petróleo y derivados', 865000, 0),
    ('2025-03-01', 'Petróleo y derivados', 1459000, 0),
    ('2025-04-01', 'Petróleo y derivados', 940000, 0),
    ('2025-05-01', 'Petróleo y derivados', 1063000, 0),
    ('2025-06-01', 'Petróleo y derivados', 1076000, 0),
    ('2025-07-01', 'Petróleo y derivados', 1107000, 0),
    ('2025-08-01', 'Petróleo y derivados', 989000, 0),
    ('2025-09-01', 'Petróleo y derivados', 1053000, 0),
    ('2025-10-01', 'Petróleo y derivados', 956000, 0),
    ('2025-11-01', 'Petróleo y derivados', 923000, 0),
    ('2025-12-01', 'Petróleo y derivados', 966000, 0);
  `);
  
  console.log('hecho_exportaciones recreated and populated');
  await client.end();
}

seed().catch(console.error);

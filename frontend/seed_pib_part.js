const fs = require('fs');
const { Client } = require('pg');

const env = fs.readFileSync('.env.local', 'utf8').split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=')[1].trim();

const client = new Client({ connectionString: env });

async function seed() {
  await client.connect();
  
  await client.query(`
    DROP TABLE IF EXISTS hecho_pib_participacion CASCADE;
    CREATE TABLE hecho_pib_participacion (
      id SERIAL PRIMARY KEY,
      anio VARCHAR(10),
      extraccion NUMERIC,
      refinacion NUMERIC,
      total NUMERIC,
      cargado_en TIMESTAMPTZ DEFAULT NOW()
    );
    INSERT INTO hecho_pib_participacion (anio, extraccion, refinacion, total) VALUES 
    ('2012', 4.4, 1.2, 5.6),
    ('2013', 4.5, 1.2, 5.7),
    ('2014', 4.2, 1.0, 5.3),
    ('2015', 4.1, 1.0, 5.0),
    ('2016', 3.6, 1.1, 4.7),
    ('2017', 3.4, 1.2, 4.6),
    ('2018', 3.4, 1.2, 4.6),
    ('2019', 3.4, 1.2, 4.5),
    ('2020', 3.2, 1.1, 4.3),
    ('2021', 2.7, 1.2, 3.9),
    ('2022', 2.6, 1.1, 3.7),
    ('2023', 2.6, 1.2, 3.9),
    ('2024p', 2.6, 1.1, 3.7),
    ('2025pr', 2.4, 1.1, 3.5);
  `);
  
  console.log('hecho_pib_participacion recreated and populated');
  await client.end();
}

seed().catch(console.error);

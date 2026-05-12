const fs = require('fs');
const { Client } = require('pg');

const env = fs.readFileSync('.env.local', 'utf8').split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=')[1].trim();

const client = new Client({ connectionString: env });

async function seed() {
  await client.connect();
  
  await client.query(`
    DROP TABLE IF EXISTS hecho_pib CASCADE;
    CREATE TABLE hecho_pib (
      id SERIAL PRIMARY KEY,
      trimestre VARCHAR(10),
      anio VARCHAR(10),
      pib_total NUMERIC,
      pib_og NUMERIC,
      cargado_en TIMESTAMPTZ DEFAULT NOW()
    );
    INSERT INTO hecho_pib (trimestre, anio, pib_total, pib_og) VALUES 
    ('III', '2023p', -0.4, 2.8),
    ('IV', '2023p', 0.7, 2.8),
    ('I', '2024pr', 0.3, -0.2),
    ('II', '2024pr', 1.6, -1.3),
    ('III', '2024pr', 1.6, -3.5),
    ('IV', '2024pr', 2.4, -3.4),
    ('I', '2025pr', 2.6, -5.0),
    ('II', '2025pr', 2.1, -5.8),
    ('III', '2025pr', 3.6, -0.4),
    ('IV', '2025pr', 2.3, -1.2);
  `);
  
  console.log('hecho_pib recreated and populated');
  await client.end();
}

seed().catch(console.error);

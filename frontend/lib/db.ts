import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
    ?? 'postgresql://biacp:biacp2024@localhost:5436/inversion_bienes_servicios',
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});

export const query = (text: string, params?: any[]) => pool.query(text, params);

export default pool;

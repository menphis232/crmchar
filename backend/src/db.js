import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tramites_vehiculares',
  waitForConnections: true,
  connectionLimit: 10,
});

export async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

export async function get(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] ?? null;
}

export async function run(sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return result;
}

export async function testConnection() {
  const conn = await pool.getConnection();
  conn.release();
}

export default pool;

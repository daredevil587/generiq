import { Pool } from 'pg';

// Prevent multiple pool instances during Next.js hot reload in development
const globalForPg = global as typeof globalThis & { _pgPool?: Pool };

function createPool(): Pool {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
}

const pool: Pool =
  process.env.NODE_ENV === 'development'
    ? (globalForPg._pgPool ??= createPool())
    : createPool();

export default pool;

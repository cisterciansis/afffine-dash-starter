import { Pool } from 'pg';

// Singleton Postgres connection pool for serverless environments (Vercel)
// Reuses connections across invocations within the same lambda instance.
let pool;

/**
 * Get or initialize the global Pool instance.
 */
export function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL env var is not set. Configure it in Vercel Project Settings.');
    }

    pool = new Pool({
      connectionString,
      // RDS requires SSL; rejectUnauthorized false for simplicity in serverless.
      ssl: { rejectUnauthorized: false },
      // Conservative pool settings for serverless
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });

    pool.on('error', (err) => {
      console.error('Postgres pool error', err);
    });
  }
  return pool;
}

/**
 * Helper to run a query with optional params.
 */
export async function query(text, params = []) {
  const p = getPool();
  return p.query(text, params);
}

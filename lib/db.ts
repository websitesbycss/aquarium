import { Pool, type QueryResultRow } from 'pg';

// pg treats sslmode=require as verify-full, which fails on Tiger Cloud's certificate chain.
// uselibpqcompat=true gives standard libpq semantics (encrypted, no chain verification).
function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  if (url.includes('uselibpqcompat')) return url;
  return url + (url.includes('?') ? '&' : '?') + 'uselibpqcompat=true';
}

const globalForPool = globalThis as unknown as { __aquariumPool?: Pool };

export function pool(): Pool {
  if (!globalForPool.__aquariumPool) {
    globalForPool.__aquariumPool = new Pool({
      connectionString: connectionString(),
      max: 5,
      idleTimeoutMillis: 10_000,
    });
  }
  return globalForPool.__aquariumPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await pool().query<T>(text, params);
  return res.rows;
}

export async function closePool(): Promise<void> {
  await globalForPool.__aquariumPool?.end();
  globalForPool.__aquariumPool = undefined;
}

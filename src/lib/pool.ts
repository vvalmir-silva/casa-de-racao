import { Pool } from "@neondatabase/serverless";

/** Pool (WebSocket) para transações interativas. Requer Node 22+ (WebSocket global). */
const globalForPool = globalThis as unknown as { __crPool?: Pool };

export function getPool() {
  if (!globalForPool.__crPool) {
    globalForPool.__crPool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return globalForPool.__crPool;
}

/** Executa fn dentro de uma transação; faz rollback em erro. */
export async function comTransacao<T>(fn: (q: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const r = await fn((text, params) => client.query(text, params as never));
    await client.query("COMMIT");
    return r;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

import { Pool as NeonPool } from "@neondatabase/serverless";

type Q = (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
type PoolLike = { connect(): Promise<{ query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>; release(): void }> };

/** Pool para transações interativas. Neon (WebSocket, Node 22+) em produção; `pg` quando DB_DRIVER=pg. */
const g = globalThis as unknown as { __crPool?: PoolLike };

export function getPool(): PoolLike {
  if (!g.__crPool) {
    if (process.env.DB_DRIVER === "pg") {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Pool } = require("pg") as typeof import("pg");
      g.__crPool = new Pool({ connectionString: process.env.DATABASE_URL }) as unknown as PoolLike;
    } else {
      g.__crPool = new NeonPool({ connectionString: process.env.DATABASE_URL }) as unknown as PoolLike;
    }
  }
  return g.__crPool;
}

/** Executa fn dentro de uma transação; faz rollback em erro. */
export async function comTransacao<T>(fn: (q: Q) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const r = await fn((text, params) => client.query(text, params));
    await client.query("COMMIT");
    return r;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

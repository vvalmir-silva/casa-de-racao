import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL não definida");
}

export type Row = Record<string, unknown>;

type SqlFn = {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<Row[]>;
  query(text: string, params?: unknown[]): Promise<Row[]>;
};

/** Em desenvolvimento local com Postgres comum, defina DB_DRIVER=pg. Em produção (Neon) deixe vazio. */
function criarSql(): SqlFn {
  if (process.env.DB_DRIVER === "pg") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require("pg") as typeof import("pg");
    const g = globalThis as unknown as { __pgPool?: import("pg").Pool };
    g.__pgPool ??= new Pool({ connectionString: process.env.DATABASE_URL });
    const pool = g.__pgPool;
    const fn = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.reduce((acc, s, i) => acc + s + (i < values.length ? `$${i + 1}` : ""), "");
      const r = await pool.query(text, values);
      return r.rows as Row[];
    }) as SqlFn;
    fn.query = async (text, params) => (await pool.query(text, params ?? [])).rows as Row[];
    return fn;
  }
  const n = neon(process.env.DATABASE_URL!);
  const fn = ((strings: TemplateStringsArray, ...values: unknown[]) => n(strings, ...values) as unknown as Promise<Row[]>) as SqlFn;
  fn.query = (text, params) => n.query(text, params ?? []) as unknown as Promise<Row[]>;
  return fn;
}

/** Cliente SQL. Use como tagged template: sql`SELECT ... ${valor}` */
export const sql: SqlFn = criarSql();

/** Lê todas as configurações como mapa chave → valor. */
export async function getConfig(): Promise<Record<string, string>> {
  const rows = (await sql`SELECT chave, valor FROM configuracoes`) as { chave: string; valor: string }[];
  return Object.fromEntries(rows.map((r) => [r.chave, r.valor]));
}

export function cfgInt(cfg: Record<string, string>, chave: string, padrao: number): number {
  const v = Number(cfg[chave]);
  return Number.isFinite(v) ? v : padrao;
}

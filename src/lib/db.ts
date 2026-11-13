import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL não definida");
}

/** Cliente Neon (HTTP). Use como tagged template: sql`SELECT ... ${valor}` */
export const sql = neon(process.env.DATABASE_URL);

export type Row = Record<string, unknown>;

/** Lê todas as configurações como mapa chave → valor. */
export async function getConfig(): Promise<Record<string, string>> {
  const rows = (await sql`SELECT chave, valor FROM configuracoes`) as { chave: string; valor: string }[];
  return Object.fromEntries(rows.map((r) => [r.chave, r.valor]));
}

export function cfgInt(cfg: Record<string, string>, chave: string, padrao: number): number {
  const v = Number(cfg[chave]);
  return Number.isFinite(v) ? v : padrao;
}

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "./db";
import { splitStatements } from "./migrar-split";
export { splitStatements };

/** Aplica db/migrations/*.sql ainda não registradas em `migracoes`. */
export async function aplicarMigracoes() {
  await sql`CREATE TABLE IF NOT EXISTS migracoes (nome text PRIMARY KEY, aplicada_em timestamptz NOT NULL DEFAULT now())`;
  const feitas = new Set(((await sql`SELECT nome FROM migracoes`) as { nome: string }[]).map((r) => r.nome));
  const dir = join(process.cwd(), "db", "migrations");
  const arquivos = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const aplicadas: string[] = [];
  for (const f of arquivos) {
    if (feitas.has(f)) continue;
    for (const st of splitStatements(readFileSync(join(dir, f), "utf8"))) await sql.query(st);
    await sql`INSERT INTO migracoes (nome) VALUES (${f})`;
    aplicadas.push(f);
  }
  return { aplicadas, ja_feitas: [...feitas] };
}

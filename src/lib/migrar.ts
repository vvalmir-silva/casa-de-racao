import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "./db";

export function splitStatements(text: string) {
  const out: string[] = [];
  let buf = "";
  let inDollar = false;
  const src = text.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    buf += ch;
    if (ch === "$" && src[i + 1] === "$") { inDollar = !inDollar; buf += "$"; i++; continue; }
    if (ch === ";" && !inDollar) { if (buf.trim()) out.push(buf.trim()); buf = ""; }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

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

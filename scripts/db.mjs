// Aplica arquivos .sql no banco (DATABASE_URL).
// Uso: node scripts/db.mjs db/schema.sql db/seed.sql
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL");
  process.exit(1);
}
const sql = neon(url);

function splitStatements(text) {
  const out = [];
  let buf = "";
  let inDollar = false;
  const src = text
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    buf += ch;
    if (src[i] === "$" && src[i + 1] === "$") {
      inDollar = !inDollar;
      buf += "$";
      i++;
      continue;
    }
    if (ch === ";" && !inDollar) {
      if (buf.trim()) out.push(buf.trim());
      buf = "";
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

for (const f of process.argv.slice(2)) {
  const stmts = splitStatements(readFileSync(f, "utf8"));
  for (const s of stmts) await sql.query(s);
  console.log(`ok ${f} (${stmts.length} comandos)`);
}

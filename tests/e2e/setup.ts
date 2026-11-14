import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { splitStatements } from "../../src/lib/migrar-split";

/** Recria o banco de testes do zero: schema + seed + migrações + CEP de teste. */
export default async function setup() {
  const url = process.env.E2E_DATABASE_URL ?? "postgresql://cr@localhost:5433/cr_e2e?host=/tmp";
  const c = new Client({ connectionString: url });
  await c.connect();
  await c.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  const run = async (f: string) => { for (const st of splitStatements(readFileSync(f, "utf8"))) await c.query(st); };
  await run("db/schema.sql");
  await run("db/seed.sql");
  for (const f of readdirSync("db/migrations").filter((x) => x.endsWith(".sql")).sort()) await run(join("db/migrations", f));
  await c.query("INSERT INTO zona_ceps (zona_id, prefixo) VALUES (1, '02225') ON CONFLICT DO NOTHING");
  // fluxos gerais testam pagar na entrega/loja já no 1º pedido; as proteções têm teste próprio (vendas.spec)
  await c.query("UPDATE configuracoes SET valor = '0' WHERE chave IN ('pagar_depois_min_pedidos', 'pagar_depois_max_centavos')");
  await c.end();
}

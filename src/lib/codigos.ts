import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { sql } from "./db";

const VALIDADE_MIN = 10;
const MAX_TENTATIVAS = 5;
const MAX_CODIGOS_JANELA = 3; // por 15 minutos

function hash(codigo: string) {
  return createHmac("sha256", process.env.SESSION_SECRET ?? "dev").update(codigo).digest("hex");
}

export function whatsappConfigurado() {
  const p = (process.env.WHATSAPP_PROVIDER ?? "none").toLowerCase();
  return p === "evolution" || p === "zapi";
}

/** Gera um código para o usuário. Retorna null se excedeu o limite. */
export async function gerarCodigo(usuarioId: string): Promise<string | null> {
  const [r] = (await sql`
    SELECT count(*)::int AS n FROM codigos_acesso WHERE usuario_id = ${usuarioId} AND criado_em > now() - interval '15 minutes'
  `) as { n: number }[];
  if (r.n >= MAX_CODIGOS_JANELA) return null;
  const codigo = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await sql`UPDATE codigos_acesso SET usado_em = now() WHERE usuario_id = ${usuarioId} AND usado_em IS NULL`;
  await sql`
    INSERT INTO codigos_acesso (usuario_id, codigo_hash, expira_em)
    VALUES (${usuarioId}, ${hash(codigo)}, now() + make_interval(mins => ${VALIDADE_MIN}))
  `;
  return codigo;
}

/** Valida e consome o código. */
export async function validarCodigo(usuarioId: string, codigo: string): Promise<"ok" | "invalido" | "expirado" | "bloqueado"> {
  const rows = (await sql`
    SELECT id, codigo_hash, expira_em, tentativas FROM codigos_acesso
    WHERE usuario_id = ${usuarioId} AND usado_em IS NULL ORDER BY criado_em DESC LIMIT 1
  `) as { id: number; codigo_hash: string; expira_em: string; tentativas: number }[];
  const c = rows[0];
  if (!c) return "invalido";
  if (new Date(c.expira_em) < new Date()) return "expirado";
  if (c.tentativas >= MAX_TENTATIVAS) return "bloqueado";
  const a = Buffer.from(c.codigo_hash, "hex");
  const b = Buffer.from(hash(codigo.replace(/\D/g, "")), "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await sql`UPDATE codigos_acesso SET tentativas = tentativas + 1 WHERE id = ${c.id}`;
    return c.tentativas + 1 >= MAX_TENTATIVAS ? "bloqueado" : "invalido";
  }
  await sql`UPDATE codigos_acesso SET usado_em = now() WHERE id = ${c.id}`;
  return "ok";
}

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { sql } from "./db";

export type Papel = "cliente" | "admin" | "motorista";
export type Sessao = { id: string; nome: string; papel: Papel; telefone: string };

const COOKIE = "cr_sessao";
const DIAS = 30;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET ausente ou curto");
  return new TextEncoder().encode(s);
}

export async function criarSessao(u: Sessao) {
  const token = await new SignJWT(u)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DIAS}d`)
    .sign(secret());
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DIAS * 24 * 3600,
  });
}

export async function encerrarSessao() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSessao(): Promise<Sessao | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      id: String(payload.id),
      nome: String(payload.nome),
      papel: payload.papel as Papel,
      telefone: String(payload.telefone),
    };
  } catch {
    return null;
  }
}

/** Exige login; opcionalmente exige papel. Redireciona para /login. */
export async function exigirSessao(papeis?: Papel[]): Promise<Sessao> {
  const s = await getSessao();
  if (!s) redirect("/login");
  if (papeis && !papeis.includes(s.papel)) redirect("/");
  return s;
}

export function normalizarTelefone(t: string) {
  return t.replace(/\D/g, "").replace(/^55(\d{10,11})$/, "$1");
}

export async function autenticar(telefone: string, senha: string): Promise<Sessao | null> {
  const tel = normalizarTelefone(telefone);
  const rows = (await sql`
    SELECT id, nome, papel, telefone, senha_hash FROM usuarios WHERE telefone = ${tel} AND ativo
  `) as { id: string; nome: string; papel: Papel; telefone: string; senha_hash: string }[];
  const u = rows[0];
  if (!u) return null;
  // pgcrypto gera $2a$; bcryptjs valida normalmente
  const ok = await bcrypt.compare(senha, u.senha_hash);
  if (!ok) return null;
  if (u.papel !== "cliente" && SENHAS_INICIAIS.includes(senha)) {
    await sql`UPDATE usuarios SET senha_padrao = true WHERE id = ${u.id}`.catch(() => {});
  }
  return { id: u.id, nome: u.nome, papel: u.papel, telefone: u.telefone };
}

/** Senhas do seed; enquanto estiverem em uso, o painel mostra um alerta. */
export const SENHAS_INICIAIS = ["admin123", "moto123"];

export async function hashSenha(senha: string) {
  return bcrypt.hash(senha, 10);
}

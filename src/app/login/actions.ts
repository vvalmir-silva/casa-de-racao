"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { autenticar, criarSessao, encerrarSessao, hashSenha, normalizarTelefone } from "@/lib/auth";
import { sql } from "@/lib/db";

export type EstadoForm = { erro?: string } | undefined;

export async function loginAction(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const telefone = String(fd.get("telefone") ?? "");
  const senha = String(fd.get("senha") ?? "");
  const next = String(fd.get("next") ?? "") || null;
  const s = await autenticar(telefone, senha);
  if (!s) return { erro: "Telefone ou senha inválidos." };
  await criarSessao(s);
  redirect(next ?? (s.papel === "admin" ? "/admin" : s.papel === "motorista" ? "/motorista" : "/"));
}

const cadastroSchema = z.object({
  nome: z.string().trim().min(3, "Informe seu nome"),
  telefone: z.string().transform(normalizarTelefone).refine((t) => t.length >= 10 && t.length <= 11, "Telefone inválido"),
  email: z.string().trim().email("E-mail inválido").optional().or(z.literal("")),
  senha: z.string().min(6, "Senha com pelo menos 6 caracteres"),
});

export async function cadastroAction(_: EstadoForm, fd: FormData): Promise<EstadoForm> {
  const parsed = cadastroSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { erro: parsed.error.issues[0].message };
  const { nome, telefone, email, senha } = parsed.data;
  const next = String(fd.get("next") ?? "") || "/";
  const ex = await sql`SELECT 1 FROM usuarios WHERE telefone = ${telefone}`;
  if (ex.length) return { erro: "Já existe conta com este telefone." };
  const hash = await hashSenha(senha);
  const rows = (await sql`
    INSERT INTO usuarios (nome, telefone, email, senha_hash) VALUES (${nome}, ${telefone}, ${email || null}, ${hash})
    RETURNING id, nome, papel, telefone
  `) as { id: string; nome: string; papel: "cliente"; telefone: string }[];
  await criarSessao(rows[0]);
  redirect(next);
}

export async function logoutAction() {
  await encerrarSessao();
  redirect("/");
}

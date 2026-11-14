"use server";

import { redirect } from "next/navigation";
import { sql, getConfig } from "@/lib/db";
import { criarSessao, hashSenha, normalizarTelefone, type Papel } from "@/lib/auth";
import { gerarCodigo, validarCodigo, whatsappConfigurado } from "@/lib/codigos";
import { enviarWhatsApp } from "@/lib/whatsapp";

export type EstadoRecuperar =
  | { etapa: "telefone"; erro?: string; contatoLoja?: string }
  | { etapa: "codigo"; telefone: string; erro?: string; aviso?: string };

export async function solicitarCodigoAction(_: EstadoRecuperar | undefined, fd: FormData): Promise<EstadoRecuperar> {
  const tel = normalizarTelefone(String(fd.get("telefone") ?? ""));
  if (tel.length < 10) return { etapa: "telefone", erro: "Informe o telefone com DDD." };

  if (!whatsappConfigurado()) {
    const cfg = await getConfig();
    return { etapa: "telefone", erro: "O envio de código ainda não está ativo. Fale com a loja para trocar sua senha.", contatoLoja: cfg.loja_whatsapp ?? "" };
  }

  const rows = (await sql`SELECT id, nome FROM usuarios WHERE telefone = ${tel} AND ativo`) as { id: string; nome: string }[];
  const u = rows[0];
  // Resposta igual para telefone com ou sem cadastro (não revela quem é cliente)
  const resposta: EstadoRecuperar = { etapa: "codigo", telefone: tel, aviso: "Se esse número tiver cadastro, enviamos um código de 6 dígitos no WhatsApp." };
  if (!u) return resposta;

  const codigo = await gerarCodigo(u.id);
  if (!codigo) return { etapa: "codigo", telefone: tel, erro: "Muitos códigos pedidos. Aguarde 15 minutos e tente de novo." };
  await enviarWhatsApp({
    telefone: tel,
    texto: `Seu código da Casa de Ração: *${codigo}*\nVale por 10 minutos. Se não foi você, ignore esta mensagem.`,
    tipo: "codigo_acesso",
    usuarioId: u.id,
    textoLog: "Código de acesso enviado (oculto no log).",
  });
  return resposta;
}

export async function redefinirSenhaAction(_: EstadoRecuperar | undefined, fd: FormData): Promise<EstadoRecuperar> {
  const tel = normalizarTelefone(String(fd.get("telefone") ?? ""));
  const codigo = String(fd.get("codigo") ?? "").replace(/\D/g, "");
  const senha = String(fd.get("senha") ?? "");
  if (codigo.length !== 6) return { etapa: "codigo", telefone: tel, erro: "O código tem 6 dígitos." };
  if (senha.length < 6) return { etapa: "codigo", telefone: tel, erro: "A nova senha precisa de pelo menos 6 caracteres." };

  const rows = (await sql`SELECT id, nome, papel, telefone FROM usuarios WHERE telefone = ${tel} AND ativo`) as { id: string; nome: string; papel: Papel; telefone: string }[];
  const u = rows[0];
  if (!u) return { etapa: "codigo", telefone: tel, erro: "Código inválido." };

  const r = await validarCodigo(u.id, codigo);
  if (r === "expirado") return { etapa: "codigo", telefone: tel, erro: "Código expirado. Peça um novo." };
  if (r === "bloqueado") return { etapa: "codigo", telefone: tel, erro: "Muitas tentativas erradas. Peça um novo código." };
  if (r !== "ok") return { etapa: "codigo", telefone: tel, erro: "Código inválido." };

  await sql`UPDATE usuarios SET senha_hash = ${await hashSenha(senha)} WHERE id = ${u.id}`;
  await criarSessao({ id: u.id, nome: u.nome, papel: u.papel, telefone: u.telefone });
  redirect(u.papel === "admin" ? "/admin" : u.papel === "motorista" ? "/motorista" : "/conta?senha=1");
}

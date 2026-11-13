"use server";

import { revalidatePath } from "next/cache";
import { exigirSessao } from "@/lib/auth";
import { sql } from "@/lib/db";
import { cancelarPedido, ErroPedido, enderecoSchema } from "@/lib/pedidos";
import { partesLocais, somarDias } from "@/lib/frete";

export async function cancelarMeuPedido(id: string) {
  const s = await exigirSessao();
  try {
    await cancelarPedido(id, s.id, false);
  } catch (e) {
    return { erro: e instanceof ErroPedido ? e.message : "Erro ao cancelar." };
  }
  revalidatePath("/conta");
  return { ok: true };
}

export async function salvarEndereco(fd: FormData) {
  const s = await exigirSessao();
  const parsed = enderecoSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { erro: parsed.error.issues[0].message };
  const e = parsed.data;
  await sql`
    INSERT INTO enderecos (usuario_id, apelido, cep, logradouro, numero, complemento, bairro, cidade, uf, referencia, padrao)
    VALUES (${s.id}, ${e.apelido}, ${e.cep}, ${e.logradouro}, ${e.numero}, ${e.complemento || null}, ${e.bairro}, ${e.cidade}, ${e.uf}, ${e.referencia || null},
            NOT EXISTS (SELECT 1 FROM enderecos WHERE usuario_id = ${s.id}))
  `;
  revalidatePath("/conta");
  return { ok: true };
}

export async function excluirEndereco(id: string) {
  const s = await exigirSessao();
  await sql`UPDATE assinaturas SET ativa = false WHERE endereco_id = ${id} AND cliente_id = ${s.id}`;
  await sql`DELETE FROM enderecos WHERE id = ${id} AND usuario_id = ${s.id}`;
  revalidatePath("/conta");
}

export async function criarAssinatura(fd: FormData) {
  const s = await exigirSessao();
  const produto_id = String(fd.get("produto_id"));
  const endereco_id = String(fd.get("endereco_id"));
  const qtd = Math.max(1, Number(fd.get("qtd") ?? 1));
  const intervalo = Math.min(120, Math.max(7, Number(fd.get("intervalo_dias") ?? 30)));
  const forma = String(fd.get("forma_pagamento") ?? "pix");
  const ok = await sql`SELECT 1 FROM enderecos WHERE id = ${endereco_id} AND usuario_id = ${s.id}`;
  if (!ok.length) return { erro: "Endereço inválido." };
  const proxima = somarDias(partesLocais().data, intervalo);
  await sql`
    INSERT INTO assinaturas (cliente_id, endereco_id, produto_id, qtd, intervalo_dias, proxima_data, forma_pagamento)
    VALUES (${s.id}, ${endereco_id}, ${produto_id}, ${qtd}, ${intervalo}, ${proxima}, ${forma})
  `;
  revalidatePath("/conta/assinaturas");
  return { ok: true };
}

export async function alternarAssinatura(id: string, ativa: boolean) {
  const s = await exigirSessao();
  await sql`UPDATE assinaturas SET ativa = ${ativa} WHERE id = ${id} AND cliente_id = ${s.id}`;
  revalidatePath("/conta/assinaturas");
}

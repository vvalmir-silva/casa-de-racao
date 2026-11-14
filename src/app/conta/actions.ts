"use server";

import { revalidatePath } from "next/cache";
import { exigirSessao } from "@/lib/auth";
import { sql } from "@/lib/db";
import { cancelarPedido, ErroPedido, enderecoSchema } from "@/lib/pedidos";
import { partesLocais, somarDias } from "@/lib/frete";
import { notificarPedido } from "@/lib/whatsapp";

export async function cancelarMeuPedido(id: string) {
  const s = await exigirSessao();
  try {
    await cancelarPedido(id, s.id, false);
    await notificarPedido(id, "cancelado").catch(() => {});
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

export async function alternarLembretes(ativo: boolean) {
  const s = await exigirSessao();
  await sql`UPDATE usuarios SET aceita_lembretes = ${ativo} WHERE id = ${s.id}`;
  revalidatePath("/conta");
}

/** Cliente avalia um pedido entregue (uma vez). Notas 4–5 com comentário podem ir direto à vitrine. */
export async function avaliarPedido(fd: FormData): Promise<{ ok?: true; erro?: string }> {
  const s = await exigirSessao();
  const pedidoId = String(fd.get("pedido_id") ?? "");
  const nota = Math.round(Number(fd.get("nota")));
  const comentario = String(fd.get("comentario") ?? "").trim().slice(0, 500) || null;
  if (!(nota >= 1 && nota <= 5)) return { erro: "Escolha de 1 a 5 estrelas." };
  const [p] = (await sql`SELECT status FROM pedidos WHERE id = ${pedidoId} AND cliente_id = ${s.id}`) as { status: string }[];
  if (!p) return { erro: "Pedido não encontrado." };
  if (p.status !== "entregue") return { erro: "Você poderá avaliar assim que o pedido for entregue." };
  const [cfg] = (await sql`SELECT valor FROM configuracoes WHERE chave = 'avaliacao_auto_publicar'`) as { valor: string }[];
  const publicar = (cfg?.valor ?? "true") === "true" && nota >= 4 && !!comentario;
  const r = await sql`
    INSERT INTO avaliacoes (pedido_id, cliente_id, nota, comentario, publicada)
    VALUES (${pedidoId}, ${s.id}, ${nota}, ${comentario}, ${publicar})
    ON CONFLICT (pedido_id) DO NOTHING RETURNING id
  `;
  if (!r.length) return { erro: "Este pedido já foi avaliado." };
  revalidatePath(`/conta/pedido/${pedidoId}`); revalidatePath("/"); revalidatePath("/admin/avaliacoes");
  return { ok: true };
}

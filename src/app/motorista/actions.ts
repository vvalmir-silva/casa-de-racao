"use server";

import { revalidatePath } from "next/cache";
import { exigirSessao } from "@/lib/auth";
import { sql } from "@/lib/db";
import { notificarPedido } from "@/lib/whatsapp";
import { after } from "next/server";

export async function iniciarRota(id: string) {
  const s = await exigirSessao(["motorista", "admin"]);
  await sql`UPDATE rotas SET status = 'em_andamento', iniciada_em = now() WHERE id = ${id} AND status = 'planejada' AND (motorista_id = ${s.id} OR ${s.papel === "admin"})`;
  const peds = (await sql`UPDATE pedidos SET status = 'em_rota' WHERE rota_id = ${id} AND status = 'separado' RETURNING id`) as { id: string }[];
  await Promise.allSettled(peds.map((p) => notificarPedido(p.id, "em_rota")));
  revalidatePath("/motorista"); revalidatePath("/admin/rotas");
}

export async function concluirRota(id: string) {
  const s = await exigirSessao(["motorista", "admin"]);
  await sql`UPDATE rotas SET status = 'concluida', concluida_em = now() WHERE id = ${id} AND (motorista_id = ${s.id} OR ${s.papel === "admin"})`;
  revalidatePath("/motorista"); revalidatePath("/admin/rotas");
}

/** Marca a parada como entregue, com foto e nome de quem recebeu (opcionais, salvo se a loja exigir a foto). */
export async function confirmarEntrega(fd: FormData): Promise<{ ok?: true; erro?: string }> {
  const s = await exigirSessao(["motorista", "admin"]);
  const pedidoId = String(fd.get("pedido_id") ?? "");
  const recebidoPor = String(fd.get("recebido_por") ?? "").trim().slice(0, 80) || null;
  const foto = fd.get("foto");

  const [p] = (await sql`
    SELECT p.status, r.motorista_id, r.status AS rota_status FROM pedidos p LEFT JOIN rotas r ON r.id = p.rota_id WHERE p.id = ${pedidoId}
  `) as { status: string; motorista_id: string | null; rota_status: string | null }[];
  if (!p) return { erro: "Pedido não encontrado." };
  if (s.papel === "motorista" && p.motorista_id !== s.id) return { erro: "Esta entrega é de outra rota." };
  if (p.status === "entregue") return { ok: true };
  if (!["em_rota", "separado"].includes(p.status)) return { erro: "Este pedido não está em rota." };

  const [cfg] = (await sql`SELECT valor FROM configuracoes WHERE chave = 'comprovante_obrigatorio'`) as { valor: string }[];
  const temFoto = foto instanceof File && foto.size > 0;
  if (cfg?.valor === "true" && !temFoto) return { erro: "Tire a foto da entrega para concluir." };

  let url: string | null = null;
  if (temFoto) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) return { erro: "Envio de foto indisponível no momento. Conclua sem foto." };
    if (foto.size > 4 * 1024 * 1024) return { erro: "Foto muito grande. Tente de novo." };
    if (!/^image\//.test(foto.type)) return { erro: "Arquivo não é uma imagem." };
    const { put } = await import("@vercel/blob");
    const blob = await put(`entregas/${pedidoId}-${Date.now()}.jpg`, foto, { access: "public", contentType: foto.type });
    url = blob.url;
  }

  await sql`UPDATE pedidos SET status = 'entregue', entregue_em = now(), comprovante_url = coalesce(${url}, comprovante_url), recebido_por = ${recebidoPor} WHERE id = ${pedidoId}`;
  await notificarPedido(pedidoId, "entregue").catch(() => {});
  after(() => import("@/lib/indicacao").then((m) => m.premiarIndicacao(pedidoId)).catch((e) => console.error("premiarIndicacao", e)));
  revalidatePath("/motorista"); revalidatePath("/admin/rotas"); revalidatePath("/admin/pedidos");
  return { ok: true };
}

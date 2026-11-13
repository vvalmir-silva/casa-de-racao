"use server";

import { getSessao } from "@/lib/auth";
import { criarPedido, novoPedidoSchema, ErroPedido } from "@/lib/pedidos";
import { notificarPedido, notificarAdminNovoPedido } from "@/lib/whatsapp";

export async function finalizarPedidoAction(payload: unknown): Promise<{ ok: true; id: string; numero: number } | { ok: false; erro: string }> {
  const s = await getSessao();
  if (!s) return { ok: false, erro: "Faça login para finalizar." };
  const parsed = novoPedidoSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0].message };
  try {
    const r = await criarPedido(s.id, parsed.data);
    await Promise.allSettled([notificarPedido(r.id, "pedido_recebido"), notificarAdminNovoPedido(r.id)]);
    return { ok: true, ...r };
  } catch (e) {
    if (e instanceof ErroPedido) return { ok: false, erro: e.message };
    console.error(e);
    return { ok: false, erro: "Não foi possível concluir o pedido. Tente novamente." };
  }
}

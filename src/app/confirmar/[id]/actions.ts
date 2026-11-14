"use server";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { tokenValido } from "@/lib/confirmacao";
import { enviarPush } from "@/lib/push";

export async function responderConfirmacao(fd: FormData): Promise<{ ok?: true; erro?: string }> {
  const id = String(fd.get("id") ?? "");
  const t = String(fd.get("t") ?? "");
  const resposta = fd.get("resposta") === "sim" ? "sim" : "nao";
  if (!/^[0-9a-f-]{36}$/i.test(id) || !tokenValido(id, t)) return { erro: "Link inválido ou vencido." };
  const [p] = (await sql`SELECT numero, status, rota_id FROM pedidos WHERE id = ${id}`) as { numero: number; status: string; rota_id: string | null }[];
  if (!p) return { erro: "Pedido não encontrado." };
  if (!["pago", "separado", "em_rota"].includes(p.status)) return { erro: "Este pedido não está mais aguardando entrega." };

  if (resposta === "sim") {
    await sql`UPDATE pedidos SET confirmacao = 'sim', confirmacao_em = now() WHERE id = ${id}`;
  } else {
    // Ainda não saiu: tira da rota e volta para "a montar" — a loja reagenda com o cliente.
    // Já em rota: só marca; o motorista vê o ✗ e pula a parada.
    if (p.status === "em_rota") {
      await sql`UPDATE pedidos SET confirmacao = 'nao', confirmacao_em = now() WHERE id = ${id}`;
    } else {
      await sql`UPDATE pedidos SET confirmacao = 'nao', confirmacao_em = now(), rota_id = NULL, ordem_rota = NULL WHERE id = ${id}`;
    }
    await enviarPush({ titulo: `Pedido #${p.numero}: cliente não vai estar em casa`, corpo: p.status === "em_rota" ? "O motorista já saiu — avise para pular a parada." : "Saiu da rota. Combine outro dia com o cliente.", url: "/admin/rotas", tag: `confirmacao-${id}` });
  }
  revalidatePath("/admin/rotas"); revalidatePath("/motorista"); revalidatePath(`/confirmar/${id}`);
  return { ok: true };
}

import { createHmac, timingSafeEqual } from "node:crypto";
import { sql, getConfig } from "./db";
import { urlSite } from "./site";

/** Token do link de confirmação (sem login): HMAC do id do pedido. */
export function tokenConfirmacao(pedidoId: string) {
  return createHmac("sha256", process.env.SESSION_SECRET ?? "dev").update(`confirmar:${pedidoId}`).digest("base64url").slice(0, 22);
}
export function tokenValido(pedidoId: string, t: string | undefined) {
  if (!t) return false;
  const a = Buffer.from(tokenConfirmacao(pedidoId)), b = Buffer.from(t);
  return a.length === b.length && timingSafeEqual(a, b);
}
export const linkConfirmacao = (pedidoId: string) => `${urlSite()}/confirmar/${pedidoId}?t=${tokenConfirmacao(pedidoId)}`;

const hm = (t?: string | null) => (t ? t.slice(0, 5) : "");

/** Manda o WhatsApp "vai estar em casa?" para as paradas ainda sem resposta. `reenviar` inclui quem já recebeu e não respondeu. */
export async function pedirConfirmacao(rotaId: string, reenviar = false) {
  const cfg = await getConfig();
  const alvos = (await sql`
    SELECT p.id, p.numero, u.id AS cliente_id, u.nome, u.telefone, j.inicio::text, j.fim::text, p.data_entrega::text
    FROM pedidos p JOIN usuarios u ON u.id = p.cliente_id LEFT JOIN janelas j ON j.id = p.janela_id
    WHERE p.rota_id = ${rotaId} AND p.status IN ('separado', 'em_rota') AND p.confirmacao IS NULL
      AND (${reenviar}::boolean OR p.confirmacao_pedida_em IS NULL)
  `) as { id: string; numero: number; cliente_id: string; nome: string; telefone: string; inicio: string | null; fim: string | null; data_entrega: string | null }[];
  const { enviarWhatsApp } = await import("./whatsapp");
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  for (const a of alvos) {
    const quando = a.data_entrega === hoje ? "hoje" : a.data_entrega ? `dia ${a.data_entrega.slice(8, 10)}/${a.data_entrega.slice(5, 7)}` : "em breve";
    const texto = `Oi, ${a.nome.split(" ")[0]}! Seu pedido #${a.numero} da ${cfg.loja_nome ?? "Casa de Ração"} sai ${quando}${a.inicio ? ` entre ${hm(a.inicio)} e ${hm(a.fim)}` : ""} 🚗\nVai ter alguém para receber? Toque e confirme (leva 2 segundos):\n${linkConfirmacao(a.id)}`;
    await enviarWhatsApp({ telefone: a.telefone, texto, tipo: "confirmacao_entrega", pedidoId: a.id, usuarioId: a.cliente_id });
    await sql`UPDATE pedidos SET confirmacao_pedida_em = now() WHERE id = ${a.id}`;
  }
  return alvos.length;
}

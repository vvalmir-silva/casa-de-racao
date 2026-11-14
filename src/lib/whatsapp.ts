import { sql, getConfig } from "./db";

/**
 * Envio de WhatsApp via Evolution API ou Z-API. Configure no .env:
 *   WHATSAPP_PROVIDER=evolution | zapi | none
 *   Evolution: WHATSAPP_API_URL, WHATSAPP_API_KEY, WHATSAPP_INSTANCE
 *   Z-API:     ZAPI_INSTANCE, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN
 * Sem configuração, as mensagens ficam registradas em `notificacoes` com status 'desativado'.
 */

export type TipoNotificacao =
  | "pedido_recebido" | "pagamento_confirmado" | "separado" | "em_rota" | "entregue" | "cancelado"
  | "novo_pedido_admin" | "recompra" | "assinatura_gerada" | "teste" | "codigo_acesso";

function numeroE164(telefone: string) {
  const d = telefone.replace(/\D/g, "");
  return d.startsWith("55") ? d : `55${d}`;
}

async function enviarViaProvedor(telefone: string, texto: string): Promise<{ ok: boolean; erro?: string; desativado?: boolean }> {
  const provider = (process.env.WHATSAPP_PROVIDER ?? "none").toLowerCase();
  const numero = numeroE164(telefone);
  try {
    if (provider === "evolution") {
      const base = process.env.WHATSAPP_API_URL?.replace(/\/$/, "");
      const key = process.env.WHATSAPP_API_KEY;
      const inst = process.env.WHATSAPP_INSTANCE;
      if (!base || !key || !inst) return { ok: false, erro: "Evolution API não configurada", desativado: true };
      const r = await fetch(`${base}/message/sendText/${inst}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: key },
        body: JSON.stringify({ number: numero, text: texto }),
      });
      if (!r.ok) return { ok: false, erro: `Evolution ${r.status}: ${(await r.text()).slice(0, 300)}` };
      return { ok: true };
    }
    if (provider === "zapi") {
      const inst = process.env.ZAPI_INSTANCE, token = process.env.ZAPI_TOKEN, client = process.env.ZAPI_CLIENT_TOKEN;
      if (!inst || !token) return { ok: false, erro: "Z-API não configurada", desativado: true };
      const r = await fetch(`https://api.z-api.io/instances/${inst}/token/${token}/send-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(client ? { "Client-Token": client } : {}) },
        body: JSON.stringify({ phone: numero, message: texto }),
      });
      if (!r.ok) return { ok: false, erro: `Z-API ${r.status}: ${(await r.text()).slice(0, 300)}` };
      return { ok: true };
    }
    return { ok: false, erro: "WHATSAPP_PROVIDER=none", desativado: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

/** Envia e registra. Nunca lança — falha de WhatsApp não pode quebrar o pedido. */
export async function enviarWhatsApp(params: {
  telefone: string; texto: string; tipo: TipoNotificacao; pedidoId?: string | null; usuarioId?: string | null;
  /** texto gravado no log, quando a mensagem tem dado sigiloso (ex.: código) */
  textoLog?: string;
}) {
  const cfg = await getConfig();
  const log = params.textoLog ?? params.texto;
  const essencial = params.tipo === "teste" || params.tipo === "codigo_acesso";
  if ((cfg.whatsapp_notificacoes ?? "true") !== "true" && !essencial) {
    await sql`INSERT INTO notificacoes (pedido_id, usuario_id, telefone, tipo, mensagem, status, erro)
      VALUES (${params.pedidoId ?? null}, ${params.usuarioId ?? null}, ${params.telefone}, ${params.tipo}, ${log}, 'desativado', 'notificações desligadas nas configurações')`;
    return { ok: false, desativado: true };
  }
  const r = await enviarViaProvedor(params.telefone, params.texto);
  await sql`INSERT INTO notificacoes (pedido_id, usuario_id, telefone, tipo, mensagem, status, erro)
    VALUES (${params.pedidoId ?? null}, ${params.usuarioId ?? null}, ${params.telefone}, ${params.tipo}, ${log},
            ${r.ok ? "enviada" : r.desativado ? "desativado" : "erro"}, ${r.erro ?? null})`;
  return r;
}

/* ---------- mensagens prontas ---------- */

type PedidoMsg = {
  id: string; numero: number; cliente: string; telefone: string; total_centavos: number; tipo_entrega: string;
  data_entrega: string | null; forma_pagamento: string; inicio?: string | null; fim?: string | null;
};

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
const hm = (t?: string | null) => (t ? t.slice(0, 5) : "");

async function carregarPedido(pedidoId: string): Promise<PedidoMsg | null> {
  const rows = (await sql`
    SELECT p.id, p.numero, u.nome AS cliente, u.telefone, p.total_centavos, p.tipo_entrega, p.data_entrega::text, p.forma_pagamento,
           j.inicio::text, j.fim::text
    FROM pedidos p JOIN usuarios u ON u.id = p.cliente_id LEFT JOIN janelas j ON j.id = p.janela_id WHERE p.id = ${pedidoId}
  `) as PedidoMsg[];
  return rows[0] ?? null;
}

function linhaEntrega(p: PedidoMsg) {
  if (p.tipo_entrega === "retirada") return "Retirada na loja.";
  if (p.tipo_entrega === "expresso") return "Entrega expressa hoje.";
  return `Entrega ${dataBR(p.data_entrega)}${p.inicio ? ` entre ${hm(p.inicio)} e ${hm(p.fim)}` : ""}.`;
}

function urlBase() {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
}

export async function notificarPedido(pedidoId: string, evento: Exclude<TipoNotificacao, "novo_pedido_admin" | "recompra" | "teste" | "assinatura_gerada">) {
  const p = await carregarPedido(pedidoId);
  if (!p) return;
  const cfg = await getConfig();
  const loja = cfg.loja_nome ?? "Casa de Ração";
  const nome = p.cliente.split(" ")[0];
  const link = urlBase() ? `${urlBase()}/conta/pedido/${p.id}` : "";
  let texto = "";
  switch (evento) {
    case "pedido_recebido":
      texto = p.forma_pagamento === "pix"
        ? `Olá, ${nome}! Recebemos seu pedido #${p.numero} na ${loja} (${brl(p.total_centavos)}).\nPara confirmar, pague o PIX pelo link:\n${link}\n${linhaEntrega(p)}`
        : `Olá, ${nome}! Pedido #${p.numero} confirmado na ${loja} (${brl(p.total_centavos)}, pagamento na entrega).\n${linhaEntrega(p)}\n${link}`;
      break;
    case "pagamento_confirmado":
      texto = `Pagamento do pedido #${p.numero} confirmado ✅\n${linhaEntrega(p)}\nObrigado, ${nome}!`;
      break;
    case "separado":
      texto = p.tipo_entrega === "retirada"
        ? `${nome}, seu pedido #${p.numero} está pronto para retirada na ${loja}. 🛍️\n${cfg.loja_endereco ?? ""}`
        : `${nome}, seu pedido #${p.numero} foi separado e sai na próxima rota. 📦`;
      break;
    case "em_rota":
      texto = `🚗 Seu pedido #${p.numero} saiu para entrega, ${nome}!${p.inicio ? ` Previsão: ${hm(p.inicio)}–${hm(p.fim)}.` : ""}${p.forma_pagamento !== "pix" ? ` Pagamento na entrega: ${brl(p.total_centavos)}.` : ""}`;
      break;
    case "entregue":
      texto = `Pedido #${p.numero} entregue ✅ Obrigado pela compra, ${nome}! Qualquer coisa, é só chamar aqui. 🐾`;
      break;
    case "cancelado":
      texto = `Seu pedido #${p.numero} foi cancelado. Se não foi você, fale com a gente por aqui.`;
      break;
  }
  await enviarWhatsApp({ telefone: p.telefone, texto, tipo: evento, pedidoId: p.id });
}

/** Avisa a loja (loja_whatsapp) de um pedido novo. */
export async function notificarAdminNovoPedido(pedidoId: string) {
  const p = await carregarPedido(pedidoId);
  const cfg = await getConfig();
  if (!p || !cfg.loja_whatsapp) return;
  const itens = (await sql`SELECT string_agg(qtd || 'x ' || nome, ', ') AS s FROM pedido_itens WHERE pedido_id = ${pedidoId}`) as { s: string }[];
  const texto = `🆕 Pedido #${p.numero} — ${p.cliente} (${p.telefone})\n${itens[0]?.s ?? ""}\n${brl(p.total_centavos)} · ${p.forma_pagamento.toUpperCase()}\n${linhaEntrega(p)}\n${urlBase()}/admin/pedidos`;
  await enviarWhatsApp({ telefone: cfg.loja_whatsapp, texto, tipo: "novo_pedido_admin", pedidoId });
}

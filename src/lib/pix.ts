import { sql, getConfig, cfgInt } from "./db";
import { comTransacao } from "./pool";
import { notificarPedido } from "./whatsapp";

/**
 * PIX via Mercado Pago. .env: MP_ACCESS_TOKEN (produção ou teste), opcional MP_WEBHOOK_SECRET.
 * Sem token → retorna null e a página mostra a chave PIX manual das configurações.
 */

export type PixCobranca = {
  id: number; pedido_id: string; externo_id: string; valor_centavos: number; qr_code: string | null; qr_code_base64: string | null;
  status: string; expira_em: string | null; pago_em: string | null;
};

export function pixAutomaticoAtivo() {
  return !!process.env.MP_ACCESS_TOKEN;
}

const MP = "https://api.mercadopago.com";

async function mp<T>(path: string, init?: RequestInit & { idempotencyKey?: string }): Promise<T> {
  const r = await fetch(`${MP}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      ...(init?.idempotencyKey ? { "X-Idempotency-Key": init.idempotencyKey } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Mercado Pago ${r.status}: ${JSON.stringify(j).slice(0, 400)}`);
  return j as T;
}

type MPPayment = {
  id: number; status: string; date_of_expiration?: string; date_approved?: string | null;
  point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string } };
  external_reference?: string;
};

/** Retorna cobrança ativa do pedido ou cria uma nova. */
export async function obterOuCriarPix(pedidoId: string): Promise<PixCobranca | null> {
  if (!pixAutomaticoAtivo()) return null;
  const existentes = (await sql`
    SELECT id, pedido_id, externo_id, valor_centavos, qr_code, qr_code_base64, status, expira_em::text, pago_em::text
    FROM pagamentos_pix WHERE pedido_id = ${pedidoId} ORDER BY criado_em DESC LIMIT 1
  `) as PixCobranca[];
  const atual = existentes[0];
  if (atual && (atual.status === "approved" || (atual.status === "pending" && (!atual.expira_em || new Date(atual.expira_em) > new Date())))) {
    return atual;
  }

  const rows = (await sql`
    SELECT p.id, p.numero, p.total_centavos, p.status, u.nome, u.email, u.telefone
    FROM pedidos p JOIN usuarios u ON u.id = p.cliente_id WHERE p.id = ${pedidoId}
  `) as { id: string; numero: number; total_centavos: number; status: string; nome: string; email: string | null; telefone: string }[];
  const p = rows[0];
  if (!p || p.status !== "aguardando_pagamento") return atual ?? null;

  const cfg = await getConfig();
  const minutos = cfgInt(cfg, "pix_expiracao_minutos", 60);
  const expira = new Date(Date.now() + minutos * 60_000);
  const [primeiro, ...resto] = p.nome.trim().split(/\s+/);
  const webhook = process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/api/webhooks/mercadopago` : undefined;

  const pay = await mp<MPPayment>("/v1/payments", {
    method: "POST",
    idempotencyKey: `${pedidoId}-${Date.now()}`,
    body: JSON.stringify({
      transaction_amount: Number((p.total_centavos / 100).toFixed(2)),
      description: `Pedido #${p.numero} - ${cfg.loja_nome ?? "Casa de Ração"}`,
      payment_method_id: "pix",
      external_reference: p.id,
      date_of_expiration: expira.toISOString().replace("Z", "-00:00"),
      ...(webhook ? { notification_url: webhook } : {}),
      payer: {
        email: p.email || `${p.telefone}@cliente.casaderacao.local`,
        first_name: primeiro,
        last_name: resto.join(" ") || primeiro,
      },
    }),
  });

  const td = pay.point_of_interaction?.transaction_data ?? {};
  const ins = (await sql`
    INSERT INTO pagamentos_pix (pedido_id, externo_id, valor_centavos, qr_code, qr_code_base64, status, expira_em, payload)
    VALUES (${p.id}, ${String(pay.id)}, ${p.total_centavos}, ${td.qr_code ?? null}, ${td.qr_code_base64 ?? null}, ${pay.status}, ${pay.date_of_expiration ?? expira.toISOString()}, ${JSON.stringify(pay)})
    RETURNING id, pedido_id, externo_id, valor_centavos, qr_code, qr_code_base64, status, expira_em::text, pago_em::text
  `) as PixCobranca[];
  return ins[0];
}

/** Consulta o MP e, se aprovado, marca o pedido como pago (idempotente). */
export async function sincronizarPagamento(externoId: string): Promise<{ status: string; pedido_id: string | null }> {
  const pay = await mp<MPPayment>(`/v1/payments/${externoId}`);
  const rows = (await sql`SELECT pedido_id, status FROM pagamentos_pix WHERE externo_id = ${externoId}`) as { pedido_id: string; status: string }[];
  const reg = rows[0];
  if (!reg) return { status: pay.status, pedido_id: pay.external_reference ?? null };

  await sql`UPDATE pagamentos_pix SET status = ${pay.status}, payload = ${JSON.stringify(pay)}, atualizado_em = now(),
            pago_em = CASE WHEN ${pay.status} = 'approved' THEN coalesce(pago_em, now()) ELSE pago_em END WHERE externo_id = ${externoId}`;

  if (pay.status === "approved" && reg.status !== "approved") {
    const mudou = await comTransacao(async (q) => {
      const r = await q(`UPDATE pedidos SET status = 'pago' WHERE id = $1 AND status = 'aguardando_pagamento' RETURNING id`, [reg.pedido_id]);
      return (r.rowCount ?? 0) > 0;
    });
    if (mudou) await notificarPedido(reg.pedido_id, "pagamento_confirmado");
    else await avisarPixEmPedidoCancelado(reg.pedido_id).catch(() => {});
  }
  return { status: pay.status, pedido_id: reg.pedido_id };
}

/** PIX aprovado num pedido que já tinha sido cancelado (ex.: expirou): avisa a loja para reativar ou devolver. */
async function avisarPixEmPedidoCancelado(pedidoId: string) {
  const [p] = (await sql`SELECT numero, status, total_centavos, cancelado_motivo FROM pedidos WHERE id = ${pedidoId}`) as { numero: number; status: string; total_centavos: number; cancelado_motivo: string | null }[];
  if (!p || p.status !== "cancelado") return;
  const valor = (p.total_centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const texto = `⚠️ PIX de ${valor} caiu no pedido #${p.numero}, que já estava cancelado (${p.cancelado_motivo ?? "sem motivo"}). Fale com o cliente: reative o pedido ou devolva o valor.`;
  const { enviarPush } = await import("./push");
  await enviarPush({ titulo: `PIX em pedido cancelado #${p.numero}`, corpo: texto, url: "/admin/pedidos?status=cancelado", tag: `pix-cancelado-${p.numero}` }).catch(() => {});
  const { getConfig } = await import("./db");
  const cfg = await getConfig();
  if (cfg.loja_whatsapp) {
    const { enviarWhatsApp } = await import("./whatsapp");
    await enviarWhatsApp({ telefone: cfg.loja_whatsapp, texto, tipo: "novo_pedido_admin", pedidoId });
  }
}

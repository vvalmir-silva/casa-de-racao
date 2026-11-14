import { sql, getConfig, cfgInt } from "./db";
import { cancelarPedido } from "./pedidos";

/**
 * Regras que protegem a loja quando o pagamento fica para depois (dinheiro/cartão na entrega ou pagar na loja).
 */
export const PAGA_DEPOIS = ["dinheiro", "cartao_entrega", "na_loja"];
export const MOTIVOS_FALTA = ["nao_retirado", "nao_recebido"];

export type RegraPagarDepois = { liberado: boolean; motivo?: string; valorMax: number };

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Pode pagar depois? (sem olhar o valor; o valor é conferido em `conferirPagarDepois`) */
export async function regraPagarDepois(clienteId: string): Promise<RegraPagarDepois> {
  const cfg = await getConfig();
  const minPedidos = cfgInt(cfg, "pagar_depois_min_pedidos", 1);
  const valorMax = cfgInt(cfg, "pagar_depois_max_centavos", 30000);
  const limiteFaltas = cfgInt(cfg, "faltas_bloqueio", 2);
  const [h] = (await sql`
    SELECT count(*) FILTER (WHERE status = 'entregue')::int AS entregues,
           count(*) FILTER (WHERE status = 'cancelado' AND cancelado_motivo = ANY(${MOTIVOS_FALTA}))::int AS faltas
    FROM pedidos WHERE cliente_id = ${clienteId}
  `) as { entregues: number; faltas: number }[];
  if (limiteFaltas > 0 && h.faltas >= limiteFaltas) {
    return { liberado: false, valorMax, motivo: "Como houve pedidos não retirados ou não recebidos, por enquanto o pagamento é só por PIX pelo app." };
  }
  if (h.entregues < minPedidos) {
    return { liberado: false, valorMax, motivo: minPedidos === 1 ? "No primeiro pedido, o pagamento é por PIX pelo app. Depois você pode pagar na entrega ou na loja." : `Pagar na entrega ou na loja libera depois de ${minPedidos} pedidos entregues.` };
  }
  return { liberado: true, valorMax };
}

/** Lança mensagem amigável se a forma escolhida não é permitida para este cliente/valor. */
export async function conferirPagarDepois(clienteId: string, forma: string, total: number): Promise<string | null> {
  if (!PAGA_DEPOIS.includes(forma)) return null;
  const r = await regraPagarDepois(clienteId);
  if (!r.liberado) return r.motivo ?? "Escolha PIX pelo app.";
  if (r.valorMax > 0 && total > r.valorMax) return `Pedidos acima de ${brl(r.valorMax)} são pagos por PIX pelo app.`;
  return null;
}

/* ---------- limpeza automática ---------- */

let ultimaLimpeza = 0;

/**
 * Cancela o que travou estoque: PIX não pago depois do prazo e "pagar na loja" não retirado.
 * Manda lembrete de retirada antes. Roda no cron diário e, no máximo 1x/minuto, ao abrir a loja/checkout/painel.
 */
export async function expirarPendencias(forcar = false) {
  if (!forcar && Date.now() - ultimaLimpeza < 60_000) return { pulou: true };
  ultimaLimpeza = Date.now();
  const cfg = await getConfig();
  const pixMin = cfgInt(cfg, "pix_expiracao_minutos", 60) + 10; // folga para o banco compensar
  const prazoRet = cfgInt(cfg, "retirada_prazo_cancelar_horas", 48);
  const lembreteRet = cfgInt(cfg, "retirada_lembrete_horas", 24);

  const pix = (await sql`
    SELECT id FROM pedidos WHERE status = 'aguardando_pagamento' AND forma_pagamento = 'pix'
      AND criado_em < now() - make_interval(mins => ${pixMin})
      AND NOT EXISTS (SELECT 1 FROM pagamentos_pix pp WHERE pp.pedido_id = pedidos.id AND (pp.status = 'approved' OR (pp.status = 'pending' AND pp.expira_em > now())))
    LIMIT 50
  `.catch(() => [])) as { id: string }[];

  const retirada = prazoRet > 0 ? ((await sql`
    SELECT id FROM pedidos WHERE tipo_entrega = 'retirada' AND forma_pagamento = 'na_loja' AND status IN ('pago', 'separado')
      AND criado_em < now() - make_interval(hours => ${prazoRet})
    LIMIT 50
  `.catch(() => [])) as { id: string }[]) : [];

  const { notificarPedido, enviarWhatsApp } = await import("./whatsapp");
  let cancelados = 0;
  for (const [lista, motivo] of [[pix, "pix_expirado"], [retirada, "nao_retirado"]] as const) {
    for (const p of lista) {
      try {
        await cancelarPedido(p.id, null, true, motivo);
        await notificarPedido(p.id, "cancelado").catch(() => {});
        cancelados++;
      } catch { /* segue com os outros */ }
    }
  }

  // lembrete de retirada (uma vez)
  let lembretes = 0;
  if (lembreteRet > 0 && prazoRet > lembreteRet) {
    const alvos = (await sql`
      SELECT p.id, p.numero, p.total_centavos, u.id AS cliente_id, u.nome, u.telefone, p.criado_em
      FROM pedidos p JOIN usuarios u ON u.id = p.cliente_id
      WHERE p.tipo_entrega = 'retirada' AND p.forma_pagamento = 'na_loja' AND p.status IN ('pago', 'separado')
        AND p.lembrete_retirada_em IS NULL AND p.criado_em < now() - make_interval(hours => ${lembreteRet})
      LIMIT 50
    `.catch(() => [])) as { id: string; numero: number; total_centavos: number; cliente_id: string; nome: string; telefone: string; criado_em: string }[];
    for (const a of alvos) {
      const limite = new Date(new Date(a.criado_em).getTime() + prazoRet * 3600_000);
      const quando = limite.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", hour: "2-digit", minute: "2-digit" });
      const texto = `Oi, ${a.nome.split(" ")[0]}! Seu pedido #${a.numero} (${brl(a.total_centavos)}) está separado esperando você na ${cfg.loja_nome ?? "Casa de Ração"} 🛍️\nDá para retirar até ${quando}. Depois disso o pedido é cancelado.\n${cfg.loja_endereco ?? ""}`;
      await enviarWhatsApp({ telefone: a.telefone, texto, tipo: "lembrete_retirada", pedidoId: a.id, usuarioId: a.cliente_id });
      await sql`UPDATE pedidos SET lembrete_retirada_em = now() WHERE id = ${a.id}`;
      lembretes++;
    }
  }
  return { cancelados, lembretes };
}

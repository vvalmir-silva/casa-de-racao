import { sql } from "./db";

export type Esperado = { dinheiro: number; cartao: number; entregues: number; qtdDinheiro: number; qtdCartao: number; troco: number };

/** Quanto o motorista deve trazer: pedidos entregues da rota pagos em dinheiro ou cartão na entrega. */
export async function esperadoDaRota(rotaId: string): Promise<Esperado | null> {
  const [r] = (await sql`
    SELECT
      count(*) FILTER (WHERE p.status = 'entregue')::int AS entregues,
      coalesce(sum(p.total_centavos) FILTER (WHERE p.status = 'entregue' AND p.forma_pagamento = 'dinheiro'), 0)::int AS dinheiro,
      coalesce(sum(p.total_centavos) FILTER (WHERE p.status = 'entregue' AND p.forma_pagamento = 'cartao_entrega'), 0)::int AS cartao,
      count(*) FILTER (WHERE p.status = 'entregue' AND p.forma_pagamento = 'dinheiro')::int AS "qtdDinheiro",
      count(*) FILTER (WHERE p.status = 'entregue' AND p.forma_pagamento = 'cartao_entrega')::int AS "qtdCartao",
      coalesce(sum(greatest(coalesce(p.troco_para_centavos, 0) - p.total_centavos, 0)) FILTER (WHERE p.forma_pagamento = 'dinheiro' AND p.status IN ('separado','em_rota','entregue')), 0)::int AS troco,
      (SELECT 1 FROM rotas WHERE id = ${rotaId}) AS existe
    FROM pedidos p WHERE p.rota_id = ${rotaId}
  `) as (Esperado & { existe: number | null })[];
  if (!r?.existe) return null;
  const { existe: _e, ...esp } = r;
  return esp;
}

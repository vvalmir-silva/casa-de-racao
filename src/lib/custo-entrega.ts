import { sql, getConfig } from "./db";

export type PedidoCusto = {
  id: string; numero: number; cliente: string; tipo_entrega: string; zona: string | null; status: string;
  total: number; frete: number; custo_produtos: number; custo_completo: boolean; custo_entrega: number; lucro: number;
};
export type ResumoEntrega = {
  configurado: boolean;
  custoEntregas: number; freteCobrado: number; entregas: number;
  tentativasFalhas: number; custoFalhas: number;
  custoProdutos: number; lucroReal: number; lucroCompleto: boolean;
  prejuizo: PedidoCusto[]; fretesNoVermelho: number;
  porZona: { zona: string; entregas: number; frete: number; custo: number }[];
};

/**
 * Custo de cada entrega:
 *  - pedido em rota: custo por parada + (custo fixo da rota ÷ paradas visitadas)
 *  - expresso fora de rota: custo da expressa
 *  - retirada: zero
 * Tentativas que falharam (cliente não recebeu) também custam e entram como perda.
 */
export async function custosDeEntrega(de: string, ate: string): Promise<ResumoEntrega> {
  const cfg = await getConfig();
  const cEnt = Number(cfg.custo_entrega_centavos ?? 0), cRota = Number(cfg.custo_rota_centavos ?? 0), cExp = Number(cfg.custo_expresso_centavos ?? 0);
  const linhas = (await sql`
    WITH visitas AS (
      SELECT rota_id, count(*) AS n FROM pedidos
      WHERE rota_id IS NOT NULL AND (status = 'entregue' OR cancelado_motivo = 'nao_recebido') GROUP BY rota_id
    ), itens AS (
      SELECT i.pedido_id, sum(i.qtd * coalesce(pr.custo_centavos, 0))::int AS custo, bool_and(pr.custo_centavos IS NOT NULL) AS completo
      FROM pedido_itens i LEFT JOIN produtos pr ON pr.id = i.produto_id GROUP BY i.pedido_id
    )
    SELECT p.id, p.numero, u.nome AS cliente, p.tipo_entrega, z.nome AS zona, p.status,
      p.total_centavos AS total, p.frete_centavos AS frete,
      coalesce(it.custo, 0) AS custo_produtos, coalesce(it.completo, false) AS custo_completo,
      (CASE
        WHEN p.tipo_entrega = 'retirada' THEN 0
        WHEN p.rota_id IS NOT NULL THEN ${cEnt}::int + coalesce(round(${cRota}::numeric / nullif(v.n, 0)), 0)
        WHEN p.tipo_entrega = 'expresso' THEN ${cExp}::int
        ELSE ${cEnt}::int
      END)::int AS custo_entrega
    FROM pedidos p JOIN usuarios u ON u.id = p.cliente_id LEFT JOIN zonas z ON z.id = p.zona_id
    LEFT JOIN visitas v ON v.rota_id = p.rota_id LEFT JOIN itens it ON it.pedido_id = p.id
    WHERE (p.criado_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN ${de}::date AND ${ate}::date
      AND (p.status <> 'cancelado' OR (p.cancelado_motivo = 'nao_recebido' AND p.rota_id IS NOT NULL))
  `) as Omit<PedidoCusto, "lucro">[];

  const vendas: PedidoCusto[] = [];
  let tentativasFalhas = 0, custoFalhas = 0;
  for (const l of linhas) {
    if (l.status === "cancelado") { tentativasFalhas++; custoFalhas += l.custo_entrega; continue; }
    vendas.push({ ...l, lucro: l.total - l.custo_produtos - l.custo_entrega });
  }
  const entregues = vendas.filter((v) => v.tipo_entrega !== "retirada");
  const zonas = new Map<string, { zona: string; entregas: number; frete: number; custo: number }>();
  for (const v of entregues) {
    const k = v.zona ?? (v.tipo_entrega === "expresso" ? "Expresso" : "Sem zona");
    const z = zonas.get(k) ?? { zona: k, entregas: 0, frete: 0, custo: 0 };
    z.entregas++; z.frete += v.frete; z.custo += v.custo_entrega; zonas.set(k, z);
  }
  const custoEntregas = entregues.reduce((a, v) => a + v.custo_entrega, 0);
  const custoProdutos = vendas.reduce((a, v) => a + v.custo_produtos, 0);
  return {
    configurado: cEnt + cRota + cExp > 0,
    custoEntregas, freteCobrado: entregues.reduce((a, v) => a + v.frete, 0), entregas: entregues.length,
    tentativasFalhas, custoFalhas,
    custoProdutos,
    lucroReal: vendas.reduce((a, v) => a + v.total, 0) - custoProdutos - custoEntregas - custoFalhas,
    lucroCompleto: vendas.every((v) => v.custo_completo),
    prejuizo: vendas.filter((v) => v.custo_completo && v.lucro < 0).sort((a, b) => a.lucro - b.lucro).slice(0, 20),
    fretesNoVermelho: entregues.filter((v) => v.frete < v.custo_entrega).length,
    porZona: [...zonas.values()].sort((a, b) => (a.frete - a.custo) - (b.frete - b.custo)),
  };
}

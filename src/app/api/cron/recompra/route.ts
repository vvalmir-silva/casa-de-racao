import { NextRequest, NextResponse } from "next/server";
import { sql, getConfig, cfgInt } from "@/lib/db";
import { enviarWhatsApp } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Lembrete de recompra (diário). Para cada item entregue cujo produto tem duracao_dias,
 * quando faltam `recompra_dias_antes` dias para acabar, envia WhatsApp com link do produto.
 * Não envia se: cliente desativou lembretes, já recebeu lembrete desse produto nos últimos
 * (duracao - 2) dias, tem assinatura ativa do produto, ou já comprou de novo depois da entrega.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }
  const cfg = await getConfig();
  const antes = cfgInt(cfg, "recompra_dias_antes", 3);
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  const loja = cfg.loja_nome ?? "Casa de Ração";

  const alvos = (await sql`
    WITH ultimas AS (
      SELECT DISTINCT ON (p.cliente_id, i.produto_id)
        p.cliente_id, i.produto_id, i.qtd, p.entregue_em, pr.nome, pr.slug, pr.duracao_dias, pr.estoque, u.nome AS cliente, u.telefone, u.aceita_lembretes
      FROM pedidos p
      JOIN pedido_itens i ON i.pedido_id = p.id
      JOIN produtos pr ON pr.id = i.produto_id
      JOIN usuarios u ON u.id = p.cliente_id
      WHERE p.status = 'entregue' AND p.entregue_em IS NOT NULL AND pr.duracao_dias IS NOT NULL AND pr.ativo
      ORDER BY p.cliente_id, i.produto_id, p.entregue_em DESC
    )
    SELECT * FROM ultimas ul
    WHERE ul.aceita_lembretes
      AND ul.estoque > 0
      AND (ul.entregue_em + make_interval(days => ul.duracao_dias * ul.qtd - ${antes}))::date <= (now() AT TIME ZONE 'America/Sao_Paulo')::date
      AND (ul.entregue_em + make_interval(days => ul.duracao_dias * ul.qtd + 7))::date >= (now() AT TIME ZONE 'America/Sao_Paulo')::date
      AND NOT EXISTS (SELECT 1 FROM assinaturas a WHERE a.cliente_id = ul.cliente_id AND a.produto_id = ul.produto_id AND a.ativa)
      AND NOT EXISTS (
        SELECT 1 FROM pedidos p2 JOIN pedido_itens i2 ON i2.pedido_id = p2.id
        WHERE p2.cliente_id = ul.cliente_id AND i2.produto_id = ul.produto_id AND p2.criado_em > ul.entregue_em AND p2.status <> 'cancelado')
      AND NOT EXISTS (
        SELECT 1 FROM notificacoes n WHERE n.tipo = 'recompra' AND n.usuario_id = ul.cliente_id
          AND n.mensagem LIKE '%' || ul.nome || '%' AND n.criado_em > ul.entregue_em)
    LIMIT 200
  `) as { cliente_id: string; produto_id: string; nome: string; slug: string; cliente: string; telefone: string }[];

  let enviados = 0;
  for (const a of alvos) {
    const primeiro = a.cliente.split(" ")[0];
    const link = base ? `${base}/produto/${a.slug}` : "";
    const texto = `Oi, ${primeiro}! Aqui é da ${loja} 🐾\nPelas nossas contas, a ${a.nome} deve estar acabando. Quer que a gente leve outra?\n${link}\n\nDica: ative a assinatura e nunca mais fique sem.`;
    const r = await enviarWhatsApp({ telefone: a.telefone, texto, tipo: "recompra", usuarioId: a.cliente_id });
    if (r.ok) enviados++;
  }
  const { expirarPendencias } = await import("@/lib/protecoes");
  const pendencias = await expirarPendencias(true).catch(() => null);
  const carrinho = await lembrarCarrinhos(base, loja, cfgInt(cfg, "carrinho_lembrete_horas", 20));
  return NextResponse.json({ candidatos: alvos.length, enviados, carrinho, pendencias });
}

/**
 * Carrinho abandonado: cliente logado deixou itens há mais de `horas` (e menos de 7 dias), não comprou depois
 * e aceita lembretes. Um lembrete por versão do carrinho (mexeu no carrinho, pode lembrar de novo).
 */
async function lembrarCarrinhos(base: string, loja: string, horas: number) {
  const alvos = (await sql`
    SELECT c.usuario_id, u.nome, u.telefone,
      count(*)::int AS n, sum(LEAST((i->>'qtd')::int, p.estoque) * p.preco_centavos)::int AS total,
      (array_agg(p.nome ORDER BY p.preco_centavos DESC))[1] AS principal
    FROM carrinhos c
    JOIN usuarios u ON u.id = c.usuario_id
    CROSS JOIN LATERAL jsonb_array_elements(c.itens) i
    JOIN produtos p ON p.id = (i->>'id')::uuid AND p.ativo AND p.estoque > 0
    WHERE u.ativo AND u.aceita_lembretes
      AND c.atualizado_em < now() - make_interval(hours => ${horas})
      AND c.atualizado_em > now() - interval '7 days'
      AND (c.lembrado_em IS NULL OR c.lembrado_em < c.atualizado_em)
      AND NOT EXISTS (SELECT 1 FROM pedidos pe WHERE pe.cliente_id = c.usuario_id AND pe.criado_em > c.atualizado_em)
    GROUP BY c.usuario_id, u.nome, u.telefone
    LIMIT 200
  `) as { usuario_id: string; nome: string; telefone: string; n: number; total: number; principal: string }[];
  const brl = (v: number) => (v / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  let enviados = 0;
  for (const a of alvos) {
    const link = base ? `${base}/carrinho` : "";
    const itens = a.n === 1 ? a.principal : `${a.principal} e mais ${a.n - 1} ${a.n - 1 === 1 ? "item" : "itens"}`;
    const texto = `Oi, ${a.nome.split(" ")[0]}! Aqui é da ${loja} 🐾\nVocê deixou ${itens} no carrinho (${brl(a.total)}). Ainda dá tempo de receber no próximo horário:\n${link}`;
    const r = await enviarWhatsApp({ telefone: a.telefone, texto, tipo: "carrinho_abandonado", usuarioId: a.usuario_id });
    // marca mesmo se o WhatsApp estiver desligado, para não repetir o mesmo carrinho
    await sql`UPDATE carrinhos SET lembrado_em = now() WHERE usuario_id = ${a.usuario_id}`;
    if (r.ok) enviados++;
  }
  return { candidatos: alvos.length, enviados };
}

import { sql } from "./db";
import type { ProdutoResumo } from "@/components/ProdutoCard";

export type ItemRepetir = ProdutoResumo & { qtd: number };

/** Itens de um pedido com o preço e o estoque de hoje; separa o que não dá para comprar mais. */
export async function itensParaRepetir(pedidoId: string) {
  const rows = (await sql`
    SELECT pr.id, pr.slug, pr.nome, pr.marca, pr.peso_kg, pr.preco_centavos, pr.preco_de_centavos, pr.estoque, pr.imagem_url, pr.ativo, sum(pi.qtd)::int AS qtd
    FROM pedido_itens pi JOIN produtos pr ON pr.id = pi.produto_id
    WHERE pi.pedido_id = ${pedidoId}
    GROUP BY pr.id ORDER BY min(pi.id)
  `) as (ItemRepetir & { ativo: boolean })[];
  const disponiveis = rows.filter((r) => r.ativo && r.estoque > 0).map(({ ativo: _a, ...r }) => ({ ...r, peso_kg: Number(r.peso_kg) }));
  const faltando = rows.filter((r) => !r.ativo || r.estoque <= 0).map((r) => r.nome);
  return { disponiveis, faltando };
}

/** Produtos que o cliente já comprou (mais recentes primeiro), ainda à venda. */
export async function jaComprados(clienteId: string, limite = 10) {
  return (await sql`
    SELECT pr.id, pr.slug, pr.nome, pr.marca, pr.peso_kg, pr.preco_centavos, pr.preco_de_centavos, pr.estoque, pr.imagem_url
    FROM produtos pr JOIN (
      SELECT pi.produto_id, max(p.criado_em) AS ultima
      FROM pedido_itens pi JOIN pedidos p ON p.id = pi.pedido_id
      WHERE p.cliente_id = ${clienteId} AND p.status <> 'cancelado'
      GROUP BY pi.produto_id
    ) c ON c.produto_id = pr.id
    WHERE pr.ativo
    ORDER BY c.ultima DESC LIMIT ${limite}
  `) as ProdutoResumo[];
}

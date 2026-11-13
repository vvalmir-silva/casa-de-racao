import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { criarPedido, ErroPedido } from "@/lib/pedidos";
import { partesLocais, somarDias, buscarZonaPorCep } from "@/lib/frete";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Roda diariamente (vercel.json). Gera pedidos das assinaturas cuja proxima_data
 * está a até 2 dias, e avança a próxima data pelo intervalo.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }
  const limite = somarDias(partesLocais().data, 2);
  const devidas = (await sql`
    SELECT a.id, a.cliente_id, a.endereco_id, a.produto_id, a.qtd, a.intervalo_dias, a.proxima_data::text, a.forma_pagamento
    FROM assinaturas a WHERE a.ativa AND a.proxima_data <= ${limite} ORDER BY a.proxima_data LIMIT 100
  `) as { id: string; cliente_id: string; endereco_id: string; produto_id: string; qtd: number; intervalo_dias: number; proxima_data: string; forma_pagamento: "pix" | "dinheiro" | "cartao_entrega" }[];

  const resultado: { assinatura: string; ok: boolean; info: string }[] = [];
  for (const a of devidas) {
    try {
      const r = await criarPedidoAssinatura(a);
      await sql`UPDATE assinaturas SET proxima_data = ${somarDias(a.proxima_data, a.intervalo_dias)} WHERE id = ${a.id}`;
      await sql`UPDATE pedidos SET assinatura_id = ${a.id} WHERE id = ${r.id}`;
      resultado.push({ assinatura: a.id, ok: true, info: `pedido #${r.numero}` });
    } catch (e) {
      const msg = e instanceof ErroPedido ? e.message : "erro interno";
      // adia 1 dia para tentar de novo (ex.: sem estoque)
      await sql`UPDATE assinaturas SET proxima_data = ${somarDias(a.proxima_data, 1)} WHERE id = ${a.id}`;
      resultado.push({ assinatura: a.id, ok: false, info: msg });
    }
  }
  return NextResponse.json({ processadas: devidas.length, resultado });
}

async function criarPedidoAssinatura(a: { cliente_id: string; endereco_id: string; produto_id: string; qtd: number; forma_pagamento: "pix" | "dinheiro" | "cartao_entrega" }) {
  const [end] = (await sql`SELECT cep FROM enderecos WHERE id = ${a.endereco_id}`) as { cep: string }[];
  if (!end) throw new ErroPedido("endereço removido");
  const z = await buscarZonaPorCep(end.cep);
  if (!z || z.janelas.length === 0) throw new ErroPedido("CEP fora das zonas de entrega");
  return criarPedido(a.cliente_id, {
    itens: [{ id: a.produto_id, qtd: a.qtd }],
    tipo_entrega: "rota",
    janela_id: z.janelas[0].id,
    endereco_id: a.endereco_id,
    forma_pagamento: a.forma_pagamento,
    observacoes: "Pedido gerado automaticamente pela assinatura",
  });
}

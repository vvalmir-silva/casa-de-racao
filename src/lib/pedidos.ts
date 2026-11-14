import { z } from "zod";
import { PAGAMENTOS_POR_ENTREGA } from "./utils";
import { sql } from "./db";
import { comTransacao } from "./pool";
import { calcularFrete, partesLocais, type OpcaoEntrega } from "./frete";
import { validarCupom } from "./cupons";

const marcado = (v: unknown) => v === true || v === "on" || v === "true";

export const enderecoSchema = z.object({
  apelido: z.string().trim().min(1).default("Casa"),
  cep: z.string().transform((c) => c.replace(/\D/g, "")).refine((c) => c.length === 8, "CEP inválido"),
  logradouro: z.string().trim().min(2, "Informe a rua"),
  numero: z.string().trim().min(1, "Informe o número"),
  complemento: z.string().trim().optional().or(z.literal("")),
  bairro: z.string().trim().min(2, "Informe o bairro"),
  cidade: z.string().trim().min(2, "Informe a cidade"),
  uf: z.string().trim().length(2, "UF inválida").transform((s) => s.toUpperCase()),
  referencia: z.string().trim().optional().or(z.literal("")),
  sem_complemento: z.preprocess(marcado, z.boolean()).optional(),
}).superRefine((e, ctx) => {
  if (!e.complemento && !e.sem_complemento) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["complemento"], message: "Informe o complemento (apto, bloco) ou marque “É casa, sem complemento”." });
  }
}).transform(({ sem_complemento, ...e }) => ({ ...e, complemento: e.complemento || (sem_complemento ? "Casa" : "") }));
export type EnderecoInput = z.infer<typeof enderecoSchema>;

export const novoPedidoSchema = z.object({
  itens: z.array(z.object({ id: z.string().uuid(), qtd: z.number().int().min(1).max(99) })).min(1, "Carrinho vazio"),
  tipo_entrega: z.enum(["retirada", "rota", "expresso"]),
  janela_id: z.number().int().nullable().optional(),
  endereco_id: z.string().uuid().nullable().optional(),
  endereco_novo: enderecoSchema.nullable().optional(),
  salvar_endereco: z.boolean().optional(),
  forma_pagamento: z.enum(["pix", "dinheiro", "cartao_entrega", "na_loja"]),
  troco_para_centavos: z.number().int().positive().nullable().optional(),
  observacoes: z.string().trim().max(500).optional().or(z.literal("")),
  cupom: z.string().trim().max(40).optional().or(z.literal("")),
});
export type NovoPedidoInput = z.infer<typeof novoPedidoSchema>;

export class ErroPedido extends Error {}

type Produto = { id: string; nome: string; preco_centavos: number; peso_kg: string; estoque: number; ativo: boolean };

/**
 * Cria o pedido com validação completa no servidor:
 * recalcula preços/peso/frete, confere estoque e baixa em transação.
 */
export async function criarPedido(clienteId: string, input: NovoPedidoInput, agora: Date = new Date(), opts: { sistema?: boolean } = {}) {
  const ids = input.itens.map((i) => i.id);
  const produtos = (await sql`
    SELECT id, nome, preco_centavos, peso_kg, estoque, ativo FROM produtos WHERE id = ANY(${ids}::uuid[])
  `) as Produto[];
  const mapa = new Map(produtos.map((p) => [p.id, p]));

  let subtotal = 0;
  let peso = 0;
  const linhas = input.itens.map((i) => {
    const p = mapa.get(i.id);
    if (!p || !p.ativo) throw new ErroPedido("Produto indisponível no carrinho.");
    if (p.estoque < i.qtd) throw new ErroPedido(`Estoque insuficiente para ${p.nome} (restam ${p.estoque}).`);
    subtotal += p.preco_centavos * i.qtd;
    peso += Number(p.peso_kg) * i.qtd;
    return { produto_id: p.id, nome: p.nome, preco_centavos: p.preco_centavos, qtd: i.qtd, peso_kg: Number(p.peso_kg) };
  });

  // Endereço
  let endereco: (EnderecoInput & { id?: string }) | null = null;
  if (input.tipo_entrega !== "retirada") {
    if (input.endereco_id) {
      const rows = (await sql`
        SELECT id, apelido, cep, logradouro, numero, complemento, bairro, cidade, uf, referencia
        FROM enderecos WHERE id = ${input.endereco_id} AND usuario_id = ${clienteId}
      `) as (EnderecoInput & { id: string })[];
      if (!rows[0]) throw new ErroPedido("Endereço não encontrado.");
      endereco = rows[0];
    } else if (input.endereco_novo) {
      endereco = input.endereco_novo;
    } else {
      throw new ErroPedido("Informe o endereço de entrega.");
    }
  }

  // Frete (recalculado no servidor)
  let opcao: OpcaoEntrega;
  if (input.tipo_entrega === "retirada") {
    opcao = { tipo: "retirada", titulo: "", descricao: "", taxa_centavos: 0, data_entrega: partesLocais(agora).data, zona_id: null, janela_id: null };
  } else {
    const r = await calcularFrete({ cep: endereco!.cep, subtotal_centavos: subtotal, peso_kg: peso, agora });
    if (!r.atende) throw new ErroPedido("Ainda não entregamos neste CEP. Escolha retirada na loja.");
    const found = r.opcoes.find((o) =>
      input.tipo_entrega === "rota" ? o.tipo === "rota" && o.janela_id === (input.janela_id ?? null) : o.tipo === "expresso",
    );
    if (!found) throw new ErroPedido("Opção de entrega indisponível. Recalcule o frete.");
    opcao = found;
  }

  // Cupom (revalidado no servidor)
  let desconto = 0;
  let cupomCodigo: string | null = null;
  let frete = opcao.taxa_centavos;
  if (input.cupom) {
    const rc = await validarCupom(input.cupom, clienteId, subtotal, frete);
    if (!rc.ok) throw new ErroPedido(rc.erro);
    cupomCodigo = rc.cupom.codigo;
    if (rc.frete_gratis) { desconto = 0; frete = 0; } else desconto = rc.desconto_centavos;
  }

  const total = Math.max(0, subtotal + frete - desconto);
  if (!opts.sistema) {
    const { conferirPagarDepois } = await import("./protecoes");
    const bloqueio = await conferirPagarDepois(clienteId, input.forma_pagamento, total);
    if (bloqueio) throw new ErroPedido(bloqueio);
  }
  if (!(PAGAMENTOS_POR_ENTREGA[input.tipo_entrega] ?? []).includes(input.forma_pagamento)) {
    throw new ErroPedido(input.tipo_entrega === "retirada"
      ? "Na retirada, pague pelo app (PIX) ou na loja."
      : "Pagar na loja só vale para retirada. Escolha PIX, dinheiro ou cartão na entrega.");
  }
  if (input.forma_pagamento === "dinheiro" && input.troco_para_centavos && input.troco_para_centavos < total) {
    throw new ErroPedido("Valor para troco menor que o total.");
  }
  if (input.forma_pagamento === "dinheiro" && input.troco_para_centavos) {
    const { getConfig } = await import("./db");
    const limite = Number((await getConfig()).troco_maximo_centavos ?? 10000);
    if (limite > 0 && input.troco_para_centavos - total > limite) {
      throw new ErroPedido(`O entregador leva no máximo R$ ${(limite / 100).toFixed(2).replace(".", ",")} de troco. Ajuste o valor ou pague por PIX/cartão.`);
    }
  }

  return comTransacao(async (q) => {
    // salva endereço novo se pedido
    let enderecoId: string | null = endereco?.id ?? null;
    if (endereco && !enderecoId && input.salvar_endereco) {
      const r = await q(
        `INSERT INTO enderecos (usuario_id, apelido, cep, logradouro, numero, complemento, bairro, cidade, uf, referencia, padrao)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, NOT EXISTS (SELECT 1 FROM enderecos WHERE usuario_id=$1)) RETURNING id`,
        [clienteId, endereco.apelido, endereco.cep, endereco.logradouro, endereco.numero, endereco.complemento || null, endereco.bairro, endereco.cidade, endereco.uf, endereco.referencia || null],
      );
      enderecoId = String(r.rows[0].id);
    }

    // baixa de estoque atômica
    for (const l of linhas) {
      const r = await q(`UPDATE produtos SET estoque = estoque - $2 WHERE id = $1 AND estoque >= $2 RETURNING id`, [l.produto_id, l.qtd]);
      if (r.rowCount === 0) throw new ErroPedido(`Estoque insuficiente para ${l.nome}.`);
    }

    const snap = endereco
      ? { ...endereco, id: enderecoId ?? undefined, complemento: endereco.complemento || null, referencia: endereco.referencia || null }
      : null;

    if (cupomCodigo) {
      const cu = await q(`UPDATE cupons SET usos = usos + 1 WHERE codigo = $1 AND ativo AND (limite_usos IS NULL OR usos < limite_usos) RETURNING id`, [cupomCodigo]);
      if (cu.rowCount === 0) throw new ErroPedido("Cupom esgotado.");
    }

    const ped = await q(
      `INSERT INTO pedidos (cliente_id, endereco, tipo_entrega, zona_id, janela_id, data_entrega, peso_total_kg,
         subtotal_centavos, frete_centavos, total_centavos, forma_pagamento, troco_para_centavos, observacoes, status, cupom_codigo, desconto_centavos)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id, numero`,
      [
        clienteId, snap ? JSON.stringify(snap) : null, opcao.tipo, opcao.zona_id, opcao.janela_id, opcao.data_entrega, peso.toFixed(2),
        subtotal, frete, total, input.forma_pagamento, input.troco_para_centavos ?? null, input.observacoes || null,
        input.forma_pagamento === "pix" ? "aguardando_pagamento" : "pago", cupomCodigo, desconto,
      ],
    );
    const pedidoId = String(ped.rows[0].id);

    for (const l of linhas) {
      await q(`INSERT INTO pedido_itens (pedido_id, produto_id, nome, preco_centavos, qtd, peso_kg) VALUES ($1,$2,$3,$4,$5,$6)`, [
        pedidoId, l.produto_id, l.nome, l.preco_centavos, l.qtd, l.peso_kg,
      ]);
      await q(`INSERT INTO estoque_movimentos (produto_id, delta, motivo, pedido_id, usuario_id) VALUES ($1,$2,'venda',$3,$4)`, [
        l.produto_id, -l.qtd, pedidoId, clienteId,
      ]);
    }
    return { id: pedidoId, numero: Number(ped.rows[0].numero) };
  });
}

/** Cancela pedido e devolve estoque (cliente só até 'pago'; admin sempre, exceto entregue). */
export async function cancelarPedido(pedidoId: string, porUsuarioId: string | null, admin: boolean, motivo?: string) {
  return comTransacao(async (q) => {
    const r = await q(`SELECT cliente_id, status FROM pedidos WHERE id = $1 FOR UPDATE`, [pedidoId]);
    const p = r.rows[0] as { cliente_id: string; status: string } | undefined;
    if (!p) throw new ErroPedido("Pedido não encontrado.");
    if (!admin && p.cliente_id !== porUsuarioId) throw new ErroPedido("Sem permissão.");
    if (p.status === "cancelado") return;
    if (p.status === "entregue") throw new ErroPedido("Pedido já entregue.");
    if (!admin && !["aguardando_pagamento", "pago"].includes(p.status)) throw new ErroPedido("Pedido já em separação; fale com a loja.");
    const itens = await q(`SELECT produto_id, qtd FROM pedido_itens WHERE pedido_id = $1`, [pedidoId]);
    for (const i of itens.rows as { produto_id: string; qtd: number }[]) {
      await q(`UPDATE produtos SET estoque = estoque + $2 WHERE id = $1`, [i.produto_id, i.qtd]);
      await q(`INSERT INTO estoque_movimentos (produto_id, delta, motivo, pedido_id, usuario_id) VALUES ($1,$2,'cancelamento',$3,$4)`, [
        i.produto_id, i.qtd, pedidoId, porUsuarioId,
      ]);
    }
    await q(`UPDATE cupons SET usos = GREATEST(0, usos - 1) WHERE codigo = (SELECT cupom_codigo FROM pedidos WHERE id = $1)`, [pedidoId]);
    await q(`UPDATE pedidos SET status = 'cancelado', rota_id = NULL, ordem_rota = NULL, cancelado_em = now(), cancelado_motivo = $2 WHERE id = $1`,
      [pedidoId, motivo ?? (admin ? "loja" : "cliente")]);
  });
}

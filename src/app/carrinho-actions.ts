"use server";

import { z } from "zod";
import { getSessao } from "@/lib/auth";
import { sql } from "@/lib/db";

const itensSchema = z.array(z.object({ id: z.string().uuid(), qtd: z.number().int().min(1).max(99) })).max(60);

/** Guarda o carrinho do cliente logado (vazio apaga). */
export async function salvarCarrinho(itens: unknown): Promise<void> {
  const s = await getSessao();
  if (!s) return;
  const parsed = itensSchema.safeParse(itens);
  if (!parsed.success) return;
  if (parsed.data.length === 0) {
    await sql`DELETE FROM carrinhos WHERE usuario_id = ${s.id}`;
    return;
  }
  await sql`
    INSERT INTO carrinhos (usuario_id, itens, atualizado_em) VALUES (${s.id}, ${JSON.stringify(parsed.data)}::jsonb, now())
    ON CONFLICT (usuario_id) DO UPDATE SET itens = EXCLUDED.itens, atualizado_em = now()
  `;
}

export type ItemCarrinhoSalvo = {
  id: string; slug: string; nome: string; preco_centavos: number; peso_kg: number; estoque: number; imagem_url: string | null; qtd: number;
};

/** Carrinho salvo, com preço e estoque de hoje (some o que saiu de linha ou esgotou). */
export async function carregarCarrinho(): Promise<ItemCarrinhoSalvo[]> {
  const s = await getSessao();
  if (!s) return [];
  const rows = (await sql`
    SELECT p.id, p.slug, p.nome, p.preco_centavos, p.peso_kg::float AS peso_kg, p.estoque, p.imagem_url, LEAST((i->>'qtd')::int, p.estoque) AS qtd
    FROM carrinhos c, jsonb_array_elements(c.itens) i JOIN produtos p ON p.id = (i->>'id')::uuid
    WHERE c.usuario_id = ${s.id} AND p.ativo AND p.estoque > 0
  `) as ItemCarrinhoSalvo[];
  return rows;
}

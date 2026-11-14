"use server";

import { revalidatePath } from "next/cache";
import { exigirSessao } from "@/lib/auth";
import { sql } from "@/lib/db";
import { comTransacao } from "@/lib/pool";
import { analisar, lerArquivo, type Categoria, type Existente, type LinhaAnalisada } from "@/lib/planilha";

export type ResultadoPlanilha = { erro?: string; linhas?: LinhaAnalisada[]; importados?: { novos: number; atualizados: number } };

async function preparar(fd: FormData) {
  const arquivo = fd.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Escolha o arquivo da planilha." };
  if (arquivo.size > 5 * 1024 * 1024) return { erro: "Planilha até 5 MB." };
  if (!/\.(csv|xlsx|txt)$/i.test(arquivo.name)) return { erro: "Use .xlsx ou .csv (no Excel: Arquivo → Salvar como → CSV)." };
  let tabela: string[][];
  try { tabela = await lerArquivo(arquivo); } catch { return { erro: "Não consegui ler a planilha. Salve como .xlsx ou .csv e tente de novo." }; }
  if (tabela.length > 2001) return { erro: "Até 2.000 produtos por vez." };
  const categorias = (await sql`SELECT id, nome, slug FROM categorias ORDER BY ordem`) as Categoria[];
  const existentes = (await sql`SELECT id, slug, nome, estoque FROM produtos`) as Existente[];
  const r = analisar(tabela, categorias, existentes);
  if (r.erroGeral) return { erro: r.erroGeral };
  return { linhas: r.linhas };
}

/** Passo 1: lê e valida, sem gravar nada. */
export async function analisarPlanilha(fd: FormData): Promise<ResultadoPlanilha> {
  await exigirSessao(["admin"]);
  return preparar(fd);
}

/** Passo 2: grava as linhas sem erro (tudo ou nada, numa transação). */
export async function importarPlanilha(fd: FormData): Promise<ResultadoPlanilha> {
  const s = await exigirSessao(["admin"]);
  const r = await preparar(fd);
  if (r.erro || !r.linhas) return r;
  const validas = r.linhas.filter((l) => l.acao !== "erro");
  if (!validas.length) return { erro: "Nenhuma linha válida para importar.", linhas: r.linhas };
  let novos = 0, atualizados = 0;
  await comTransacao(async (q) => {
    for (const l of validas) {
      const d = l.dados;
      if (l.acao === "atualizar" && l.produtoId) {
        const sets: string[] = [];
        const vals: unknown[] = [l.produtoId];
        const put = (col: string, v: unknown) => { if (v !== undefined) { vals.push(v); sets.push(`${col} = $${vals.length}`); } };
        put("nome", d.nome || undefined); put("categoria_id", d.categoria_id); put("marca", d.marca); put("preco_centavos", d.preco);
        put("preco_de_centavos", d.preco_de); put("custo_centavos", d.custo); put("peso_kg", d.peso_kg); put("duracao_dias", d.duracao_dias);
        put("descricao", d.descricao); put("imagem_url", d.imagem_url); put("ativo", d.ativo); put("destaque", d.destaque);
        if (sets.length) await q(`UPDATE produtos SET ${sets.join(", ")} WHERE id = $1`, vals);
        if (d.estoque !== undefined) {
          const cur = await q(`SELECT estoque FROM produtos WHERE id = $1 FOR UPDATE`, [l.produtoId]);
          const delta = d.estoque - Number(cur.rows[0]?.estoque ?? 0);
          if (delta) {
            await q(`UPDATE produtos SET estoque = $2 WHERE id = $1`, [l.produtoId, d.estoque]);
            await q(`INSERT INTO estoque_movimentos (produto_id, delta, motivo, usuario_id) VALUES ($1, $2, 'importação de planilha', $3)`, [l.produtoId, delta, s.id]);
          }
        }
        atualizados++;
      } else {
        const ex = await q(`SELECT 1 FROM produtos WHERE slug = $1`, [d.slug]);
        const slug = ex.rows.length ? `${d.slug}-${Date.now().toString(36)}` : d.slug;
        const ins = await q(
          `INSERT INTO produtos (categoria_id, nome, slug, marca, descricao, peso_kg, preco_centavos, preco_de_centavos, custo_centavos, imagem_url, duracao_dias, ativo, destaque, estoque)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
          [d.categoria_id, d.nome, slug, d.marca ?? null, d.descricao ?? null, d.peso_kg ?? 0, d.preco, d.preco_de ?? null, d.custo ?? null,
           d.imagem_url ?? null, d.duracao_dias ?? null, d.ativo ?? true, d.destaque ?? false, d.estoque ?? 0],
        );
        if (d.estoque) await q(`INSERT INTO estoque_movimentos (produto_id, delta, motivo, usuario_id) VALUES ($1, $2, 'importação de planilha', $3)`, [ins.rows[0].id, d.estoque, s.id]);
        novos++;
      }
    }
  });
  revalidatePath("/admin/produtos"); revalidatePath("/");
  return { linhas: r.linhas, importados: { novos, atualizados } };
}

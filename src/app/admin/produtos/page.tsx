import { sql } from "@/lib/db";
import { ImportarPlanilha } from "./ImportarPlanilha";
import { brl } from "@/lib/utils";
import { ProdutoForm, EstoqueAjuste, CategoriaForm } from "./ProdutosClient";

export const dynamic = "force-dynamic";

export type Prod = { id: string; categoria_id: number; nome: string; marca: string | null; descricao: string | null; peso_kg: string; preco_centavos: number; preco_de_centavos: number | null; estoque: number; imagem_url: string | null; duracao_dias: number | null; custo_centavos: number | null; ativo: boolean; destaque: boolean; categoria: string };

export default async function ProdutosAdmin({ searchParams }: { searchParams: Promise<{ baixo?: string; editar?: string }> }) {
  const { baixo, editar } = await searchParams;
  const categorias = (await sql`SELECT id, nome, especie FROM categorias ORDER BY ordem, nome`) as { id: number; nome: string; especie: string }[];
  const produtos = (await sql`
    SELECT p.*, c.nome AS categoria FROM produtos p JOIN categorias c ON c.id = p.categoria_id
    WHERE (${baixo ?? null}::text IS NULL OR p.estoque <= 3)
    ORDER BY p.ativo DESC, c.ordem, p.nome
  `) as Prod[];
  const emEdicao = produtos.find((p) => p.id === editar) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="h1 mr-auto">Produtos</h1>
        <ImportarPlanilha />
        <a href="/admin/produtos?editar=novo" className="btn-primary">+ Produto</a>
      </div>
      {(editar === "novo" || emEdicao) && <ProdutoForm produto={emEdicao} categorias={categorias} />}
      <div className="overflow-x-auto">
        <table className="table table-cards">
          <thead><tr><th>Produto</th><th>Categoria</th><th>Preço</th><th>Estoque</th><th>Ajuste</th><th></th></tr></thead>
          <tbody>
            {produtos.map((p) => (
              <tr key={p.id} className={p.ativo ? "" : "opacity-50"}>
                <td data-label="Produto"><div className="font-medium">{p.nome}</div><div className="text-xs text-ink-3">{p.marca} · {Number(p.peso_kg)} kg{p.destaque ? " · ★" : ""}</div></td>
                <td data-label="Categoria">{p.categoria}</td>
                <td data-label="Preço">{brl(p.preco_centavos)}</td>
                <td data-label="Estoque"><span className={`badge ${p.estoque <= 3 ? "bg-red-100 text-red-700" : "bg-page"}`}>{p.estoque}</span></td>
                <td data-label="Ajuste"><EstoqueAjuste id={p.id} /></td>
                <td><a href={`/admin/produtos?editar=${p.id}`} className="font-semibold text-pine-700 underline">editar</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CategoriaForm categorias={categorias} />
    </div>
  );
}

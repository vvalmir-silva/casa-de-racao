import { sql } from "@/lib/db";
import { brl } from "@/lib/utils";
import { ProdutoForm, EstoqueAjuste, CategoriaForm } from "./ProdutosClient";

export const dynamic = "force-dynamic";

export type Prod = { id: string; categoria_id: number; nome: string; marca: string | null; descricao: string | null; peso_kg: string; preco_centavos: number; estoque: number; imagem_url: string | null; ativo: boolean; destaque: boolean; categoria: string };

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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Produtos</h1>
        <a href="/admin/produtos?editar=novo" className="btn-primary">+ Produto</a>
      </div>
      {(editar === "novo" || emEdicao) && <ProdutoForm produto={emEdicao} categorias={categorias} />}
      <div className="overflow-x-auto">
        <table className="table">
          <thead><tr><th>Produto</th><th>Categoria</th><th>Preço</th><th>Estoque</th><th>Ajuste</th><th></th></tr></thead>
          <tbody>
            {produtos.map((p) => (
              <tr key={p.id} className={p.ativo ? "" : "opacity-50"}>
                <td><div className="font-medium">{p.nome}</div><div className="text-xs text-stone-500">{p.marca} · {Number(p.peso_kg)} kg{p.destaque ? " · ★" : ""}</div></td>
                <td>{p.categoria}</td>
                <td>{brl(p.preco_centavos)}</td>
                <td><span className={`badge ${p.estoque <= 3 ? "bg-red-100 text-red-700" : "bg-stone-100"}`}>{p.estoque}</span></td>
                <td><EstoqueAjuste id={p.id} /></td>
                <td><a href={`/admin/produtos?editar=${p.id}`} className="text-brand-700 underline">editar</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CategoriaForm categorias={categorias} />
    </div>
  );
}

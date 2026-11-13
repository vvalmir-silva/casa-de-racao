import Link from "next/link";
import { sql } from "@/lib/db";
import { ProdutoCard, type ProdutoResumo } from "@/components/ProdutoCard";
import { CepBanner } from "@/components/CepBanner";

export const dynamic = "force-dynamic";

type Categoria = { id: number; nome: string; slug: string; especie: string };

export default async function Home({ searchParams }: { searchParams: Promise<{ cat?: string; q?: string }> }) {
  const { cat, q } = await searchParams;
  const categorias = (await sql`SELECT id, nome, slug, especie FROM categorias ORDER BY ordem, nome`) as Categoria[];
  const busca = q ? `%${q}%` : null;
  const produtos = (await sql`
    SELECT p.id, p.slug, p.nome, p.marca, p.peso_kg, p.preco_centavos, p.estoque, p.imagem_url
    FROM produtos p JOIN categorias c ON c.id = p.categoria_id
    WHERE p.ativo
      AND (${cat ?? null}::text IS NULL OR c.slug = ${cat ?? null})
      AND (${busca}::text IS NULL OR p.nome ILIKE ${busca} OR p.marca ILIKE ${busca})
    ORDER BY p.destaque DESC, p.estoque = 0, p.nome
  `) as ProdutoResumo[];

  return (
    <div className="space-y-6">
      <CepBanner />
      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar ração, marca..." className="input" />
        {cat && <input type="hidden" name="cat" value={cat} />}
        <button className="btn-primary">Buscar</button>
      </form>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <Link href="/" className={`badge whitespace-nowrap px-3 py-1.5 ${!cat ? "bg-brand-600 text-white" : "bg-white border"}`}>Todos</Link>
        {categorias.map((c) => (
          <Link
            key={c.id}
            href={`/?cat=${c.slug}`}
            className={`badge whitespace-nowrap px-3 py-1.5 ${cat === c.slug ? "bg-brand-600 text-white" : "bg-white border"}`}
          >
            {c.especie === "cao" ? "🐶" : c.especie === "gato" ? "🐱" : c.especie === "ave" ? "🐦" : "🦴"} {c.nome}
          </Link>
        ))}
      </div>
      {produtos.length === 0 ? (
        <p className="py-12 text-center text-stone-500">Nenhum produto encontrado.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {produtos.map((p) => <ProdutoCard key={p.id} p={p} />)}
        </div>
      )}
    </div>
  );
}

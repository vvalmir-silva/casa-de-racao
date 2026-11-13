import Link from "next/link";
import { sql } from "@/lib/db";
import { ProdutoCard, type ProdutoResumo } from "@/components/ProdutoCard";
import { CepBanner } from "@/components/CepBanner";

export const dynamic = "force-dynamic";

type Categoria = { id: number; nome: string; slug: string; especie: string };
const emoji: Record<string, string> = { cao: "🐶", gato: "🐱", ave: "🐦", outro: "🦴" };

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
  const categoriaAtual = categorias.find((c) => c.slug === cat);
  const filtrando = !!(cat || q);

  return (
    <div className="space-y-6 sm:space-y-8">
      {!filtrando && <CepBanner />}

      <form className="flex gap-2 md:hidden">
        <input name="q" defaultValue={q} placeholder="Buscar ração, marca, petisco…" className="input" enterKeyHint="search" />
        {cat && <input type="hidden" name="cat" value={cat} />}
        <button className="btn-primary shrink-0 px-4">Buscar</button>
      </form>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <Link href="/" className={`chip ${!cat ? "chip-on" : ""}`}>Tudo</Link>
        {categorias.map((c) => (
          <Link key={c.id} href={`/?cat=${c.slug}`} className={`chip ${cat === c.slug ? "chip-on" : ""}`}>
            <span>{emoji[c.especie]}</span>{c.nome.replace("Ração para ", "")}
          </Link>
        ))}
      </div>

      <section>
        <div className="section-title">
          <h2 className="h2">{q ? `Resultados para “${q}”` : categoriaAtual ? categoriaAtual.nome : "Mais pedidos no bairro"}</h2>
          <span className="muted">{produtos.length} {produtos.length === 1 ? "item" : "itens"}</span>
        </div>
        {produtos.length === 0 ? (
          <div className="card-flat py-14 text-center">
            <div className="text-4xl">🔍</div>
            <p className="mt-2 font-bold">Nada por aqui</p>
            <p className="muted">Tente outra palavra ou veja todas as categorias.</p>
            <Link href="/" className="btn-outline mt-4">Ver tudo</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {produtos.map((p) => <ProdutoCard key={p.id} p={p} />)}
          </div>
        )}
      </section>

      {!filtrando && (
        <section className="grid gap-3 sm:grid-cols-3">
          {[
            ["🗓️", "Entrega no dia certo", "Janelas por bairro. Você sabe quando chega."],
            ["🔁", "Assinatura", "A ração chega sozinha, antes de acabar."],
            ["💸", "Frete grátis", "Em pedidos acima de R$ 150 na rota do bairro."],
          ].map(([i, t, d]) => (
            <div key={t} className="flex gap-3 rounded-2xl bg-white p-4">
              <span className="text-2xl">{i}</span>
              <div><div className="font-bold">{t}</div><div className="muted">{d}</div></div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

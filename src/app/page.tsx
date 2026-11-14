import Link from "next/link";
import { sql } from "@/lib/db";
import { ProdutoCard, type ProdutoResumo } from "@/components/ProdutoCard";
import { Banners } from "@/components/Vitrine";
import { IconChevron } from "@/components/Icons";

export const dynamic = "force-dynamic";

type Categoria = { id: number; nome: string; slug: string; especie: string; qtd: number };
type Prod = ProdutoResumo & { categoria_slug: string; destaque: boolean };

const ilustracao: Record<string, string> = {
  "racao-caes": "/produtos/racao-cao.svg",
  "racao-gatos": "/produtos/racao-gato.svg",
  "racao-aves": "/produtos/racao-ave.svg",
  petiscos: "/produtos/petisco.svg",
  higiene: "/produtos/areia.svg",
};
const curto = (n: string) => n.replace("Ração para ", "").replace(" e Higiene", "");

export default async function Home({ searchParams }: { searchParams: Promise<{ cat?: string; q?: string }> }) {
  const { cat, q } = await searchParams;
  const categorias = (await sql`
    SELECT c.id, c.nome, c.slug, c.especie, count(p.id)::int AS qtd
    FROM categorias c LEFT JOIN produtos p ON p.categoria_id = c.id AND p.ativo
    GROUP BY c.id ORDER BY c.ordem, c.nome
  `) as Categoria[];
  const busca = q ? `%${q}%` : null;
  const produtos = (await sql`
    SELECT p.id, p.slug, p.nome, p.marca, p.peso_kg, p.preco_centavos, p.estoque, p.imagem_url, p.destaque, c.slug AS categoria_slug
    FROM produtos p JOIN categorias c ON c.id = p.categoria_id
    WHERE p.ativo
      AND (${cat ?? null}::text IS NULL OR c.slug = ${cat ?? null})
      AND (${busca}::text IS NULL OR p.nome ILIKE ${busca} OR p.marca ILIKE ${busca})
    ORDER BY p.destaque DESC, p.estoque = 0, p.nome
  `) as Prod[];
  const atual = categorias.find((c) => c.slug === cat);
  const filtrando = !!(cat || q);

  const Categorias = () => (
    <nav aria-label="Categorias" className="no-scrollbar snap-x-row -mx-4 flex gap-3 overflow-x-auto px-4 lg:mx-0 lg:gap-4 lg:px-0">
      <Link href="/" className="flex w-[84px] shrink-0 flex-col items-center gap-2 lg:w-[112px]">
        <span className={`grid aspect-square w-full place-items-center rounded-[22px] text-[28px] transition ${!cat ? "bg-pine-700 text-white ring-4 ring-pine-100" : "bg-white hover:bg-pine-50"}`}>✦</span>
        <span className={`text-[13px] font-bold ${!cat ? "text-pine-700" : "text-ink-2"}`}>Tudo</span>
      </Link>
      {categorias.filter((c) => c.qtd > 0).map((c) => {
        const on = cat === c.slug;
        return (
          <Link key={c.id} href={`/?cat=${c.slug}`} className="flex w-[84px] shrink-0 flex-col items-center gap-2 lg:w-[112px]">
            <span className={`block aspect-square w-full overflow-hidden rounded-[22px] bg-white transition ${on ? "ring-4 ring-pine-700" : "hover:ring-4 hover:ring-pine-100"}`}>
              {ilustracao[c.slug] ? <img src={ilustracao[c.slug]} alt="" className="h-full w-full scale-[1.35] object-cover" /> : <span className="grid h-full place-items-center text-3xl">🐾</span>}
            </span>
            <span className={`text-center text-[13px] font-bold leading-tight ${on ? "text-pine-700" : "text-ink-2"}`}>{curto(c.nome)}</span>
          </Link>
        );
      })}
    </nav>
  );

  if (filtrando) {
    return (
      <div className="space-y-6">
        <Categorias />
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{q ? `“${q}”` : atual?.nome}</h1>
            <p className="muted">{produtos.length} {produtos.length === 1 ? "produto" : "produtos"}</p>
          </div>
          <Link href="/" className="btn-ghost rounded-full">Limpar</Link>
        </div>
        {produtos.length === 0 ? (
          <div className="rounded-[28px] bg-white px-6 py-16 text-center">
            <div className="text-4xl">🔍</div>
            <p className="mt-3 text-lg font-extrabold">Nada encontrado</p>
            <p className="muted">Tente o nome da marca ou outra palavra.</p>
            <Link href="/" className="btn-primary mt-5 rounded-full">Ver todos os produtos</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-5 lg:gap-x-5">
            {produtos.map((p) => <ProdutoCard key={p.id} p={p} />)}
          </div>
        )}
      </div>
    );
  }

  const secoes = categorias
    .map((c) => ({ c, itens: produtos.filter((p) => p.categoria_slug === c.slug) }))
    .filter((s) => s.itens.length >= 2);

  const Carrossel = ({ titulo, href, itens }: { titulo: string; href?: string; itens: Prod[] }) => (
    <section>
      <div className="mb-3 flex items-end justify-between">
        <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">{titulo}</h2>
        {href && <Link href={href} className="inline-flex items-center gap-0.5 text-sm font-bold text-pine-700">Ver tudo <IconChevron width={16} height={16} /></Link>}
      </div>
      <div className="no-scrollbar snap-x-row -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 lg:mx-0 lg:grid lg:grid-cols-5 lg:gap-5 lg:overflow-visible lg:px-0">
        {itens.slice(0, 10).map((p) => <ProdutoCard key={p.id} p={p} compacto />)}
      </div>
    </section>
  );

  return (
    <div className="space-y-8 sm:space-y-10">
      <Banners />
      <Categorias />
      <Carrossel titulo="Mais pedidos no bairro" itens={produtos} />
      {secoes.map(({ c, itens }) => <Carrossel key={c.id} titulo={c.nome} href={`/?cat=${c.slug}`} itens={itens} />)}
      <section className="grid gap-3 rounded-[28px] bg-white p-5 sm:grid-cols-3 sm:p-6">
        {[
          ["Entrega com hora marcada", "Janelas por bairro. Você sabe quando chega."],
          ["Pague como preferir", "PIX na hora ou dinheiro e cartão na entrega."],
          ["Retire sem custo", "Prefere buscar? Fica pronto em cerca de 1 hora."],
        ].map(([t, d]) => (
          <div key={t}><div className="font-extrabold">{t}</div><div className="muted">{d}</div></div>
        ))}
      </section>
    </div>
  );
}

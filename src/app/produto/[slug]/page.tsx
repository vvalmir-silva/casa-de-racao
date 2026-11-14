import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { brl } from "@/lib/utils";
import { AdicionarBotao } from "@/components/AdicionarBotao";
import { ProdutoCard, type ProdutoResumo } from "@/components/ProdutoCard";
import { IconChevron } from "@/components/Icons";
import { urlSite, jsonLd } from "@/lib/site";
import { FavoritoBotao } from "@/components/FavoritoBotao";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [p] = (await sql`SELECT nome, marca, descricao, preco_centavos, imagem_url FROM produtos WHERE slug = ${slug} AND ativo`) as { nome: string; marca: string | null; descricao: string | null; preco_centavos: number; imagem_url: string | null }[];
  if (!p) return { title: "Produto não encontrado", robots: { index: false } };
  const preco = (p.preco_centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const description = (p.descricao?.trim() || `${p.nome}${p.marca ? ` ${p.marca}` : ""} por ${preco}. Entrega no seu bairro com hora marcada ou retirada grátis na loja.`).slice(0, 160);
  const img = p.imagem_url && !p.imagem_url.endsWith(".svg") ? [{ url: p.imagem_url, alt: p.nome }] : undefined;
  return {
    title: p.nome,
    description,
    alternates: { canonical: `/produto/${slug}` },
    openGraph: { type: "website", title: `${p.nome} · ${preco}`, description, url: `/produto/${slug}`, ...(img ? { images: img } : {}) },
  };
}

export default async function ProdutoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const rows = (await sql`
    SELECT p.id, p.slug, p.nome, p.marca, p.descricao, p.peso_kg, p.preco_centavos, p.estoque, p.imagem_url, p.duracao_dias, p.categoria_id, c.nome AS categoria, c.slug AS cat_slug
    FROM produtos p JOIN categorias c ON c.id = p.categoria_id WHERE p.slug = ${slug} AND p.ativo
  `) as (ProdutoResumo & { descricao: string | null; categoria: string; cat_slug: string; duracao_dias: number | null; categoria_id: number })[];
  const p = rows[0];
  if (!p) notFound();
  const peso = Number(p.peso_kg);
  const parecidos = (await sql`
    SELECT id, slug, nome, marca, peso_kg, preco_centavos, estoque, imagem_url FROM produtos
    WHERE ativo AND categoria_id = ${p.categoria_id} AND id <> ${p.id} ORDER BY destaque DESC, nome LIMIT 5
  `) as ProdutoResumo[];

  const fatos = [
    p.estoque > 0 ? [`${p.estoque} em estoque`, "pronto para sair hoje"] : ["Esgotado", "volta em breve"],
    p.duracao_dias ? [`~${p.duracao_dias} dias`, "para um pet de porte médio"] : null,
    ["Entrega 18h–21h", "pedidos até 15h saem no mesmo dia"],
  ].filter(Boolean) as string[][];

  return (
    <div className="space-y-10 pb-16 md:pb-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd({
          "@context": "https://schema.org",
          "@type": "Product",
          name: p.nome,
          ...(p.marca ? { brand: { "@type": "Brand", name: p.marca } } : {}),
          ...(p.descricao ? { description: p.descricao } : {}),
          ...(p.imagem_url ? { image: p.imagem_url.startsWith("http") ? p.imagem_url : `${urlSite()}${p.imagem_url}` } : {}),
          category: p.categoria,
          ...(peso > 0 ? { weight: { "@type": "QuantitativeValue", value: peso, unitCode: "KGM" } } : {}),
          offers: {
            "@type": "Offer",
            url: `${urlSite()}/produto/${p.slug}`,
            priceCurrency: "BRL",
            price: (p.preco_centavos / 100).toFixed(2),
            availability: p.estoque > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            itemCondition: "https://schema.org/NewCondition",
          },
        })}
      />
      <nav className="flex items-center gap-1 text-sm font-semibold text-ink-3">
        <Link href="/" className="hover:text-pine-700">Início</Link><IconChevron width={14} height={14} />
        <Link href={`/?cat=${p.cat_slug}`} className="hover:text-pine-700">{p.categoria}</Link>
      </nav>
      <div className="grid gap-6 md:grid-cols-2 md:gap-12">
        <div className="overflow-hidden rounded-[32px] bg-white">
          <div className="aspect-[5/4] sm:aspect-square">
            {p.imagem_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.imagem_url} alt={p.nome} className="h-full w-full object-cover" />
            ) : <div className="grid h-full place-items-center text-7xl">🐾</div>}
          </div>
        </div>
        <div className="flex flex-col gap-6 md:py-4">
          <div>
            {p.marca && <div className="text-sm font-bold text-pine-700">{p.marca}</div>}
            <div className="mt-1 flex items-start justify-between gap-3">
              <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.02em] sm:text-[36px]">{p.nome}</h1>
              <FavoritoBotao id={p.id} nome={p.nome} grande />
            </div>
            <div className="mt-3 flex items-baseline gap-3">
              <span className="text-[32px] font-extrabold tracking-tight">{brl(p.preco_centavos)}</span>
              {peso >= 1 && <span className="rounded-full bg-white px-2.5 py-1 text-[13px] font-bold text-ink-3">{brl(Math.round(p.preco_centavos / peso))}/kg</span>}
            </div>
          </div>
          <AdicionarBotao p={{ ...p, peso_kg: peso }} />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {fatos.map(([t, d]) => (
              <div key={t} className="rounded-2xl bg-white p-3.5"><div className="text-[15px] font-extrabold">{t}</div><div className="text-[12px] text-ink-3">{d}</div></div>
            ))}
          </div>
          {p.descricao && <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink-2">{p.descricao}</p>}
          <Link href="/conta/assinaturas" className="flex items-center gap-3 rounded-2xl bg-[#DCEBE3] p-4 text-pine-900 transition hover:bg-pine-100">
            <span className="text-2xl">🔁</span>
            <span className="flex-1 text-sm"><b className="block text-[15px]">Assine e esqueça</b>A ração chega antes de acabar, no intervalo que você escolher.</span>
            <IconChevron width={18} height={18} />
          </Link>
        </div>
      </div>
      {parecidos.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-extrabold tracking-tight sm:text-2xl">Também em {p.categoria.replace("Ração para ", "").toLowerCase()}</h2>
          <div className="no-scrollbar snap-x-row -mx-4 flex gap-3 overflow-x-auto px-4 lg:mx-0 lg:grid lg:grid-cols-5 lg:gap-5 lg:px-0">
            {parecidos.map((x) => <ProdutoCard key={x.id} p={x} compacto />)}
          </div>
        </section>
      )}
    </div>
  );
}

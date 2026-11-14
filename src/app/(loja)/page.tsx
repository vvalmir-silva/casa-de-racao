import type React from "react";
import Link from "next/link";
import { sql, getConfig } from "@/lib/db";
import { ProdutoCard, type ProdutoResumo } from "@/components/ProdutoCard";
import { Banners } from "@/components/Vitrine";
import { IconChevron } from "@/components/Icons";
import { urlSite, jsonLd } from "@/lib/site";
import { getSessao } from "@/lib/auth";
import { jaComprados } from "@/lib/repetir";
import { buscarProdutos } from "@/lib/busca";
import { descontoPct } from "@/lib/ofertas";
import { after } from "next/server";
import { expirarPendencias } from "@/lib/protecoes";
import { petsDoUsuario, indicadosPorPet } from "@/lib/pets-db";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ cat?: string; q?: string }> }) {
  const { cat, q } = await searchParams;
  after(() => expirarPendencias().catch(() => {}));
  if (q) return { title: `Busca: ${q}`, robots: { index: false, follow: true } };
  if (!cat) return {};
  const [c] = (await sql`SELECT nome FROM categorias WHERE slug = ${cat}`) as { nome: string }[];
  if (!c) return { robots: { index: false } };
  return {
    title: c.nome,
    description: `${c.nome} com entrega no seu bairro. Compre online e receba com hora marcada ou retire grátis na loja.`,
    alternates: { canonical: `/?cat=${cat}` },
  };
}

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

export default async function Home({ searchParams }: { searchParams: Promise<{ cat?: string; q?: string; ofertas?: string }> }) {
  const { cat, q } = await searchParams;
  const soOfertas = (await searchParams).ofertas === "1";
  const categorias = (await sql`
    SELECT c.id, c.nome, c.slug, c.especie, count(p.id)::int AS qtd
    FROM categorias c LEFT JOIN produtos p ON p.categoria_id = c.id AND p.ativo
    GROUP BY c.id ORDER BY c.ordem, c.nome
  `) as Categoria[];
  const produtos = q
    ? ((await buscarProdutos(q)).filter((p) => !cat || p.categoria_slug === cat) as Prod[])
    : ((await sql`
    SELECT p.id, p.slug, p.nome, p.marca, p.peso_kg, p.preco_centavos, p.preco_de_centavos, p.estoque, p.imagem_url, p.destaque, c.slug AS categoria_slug
    FROM produtos p JOIN categorias c ON c.id = p.categoria_id
    WHERE p.ativo AND (${cat ?? null}::text IS NULL OR c.slug = ${cat ?? null})
      AND (NOT ${soOfertas}::boolean OR p.preco_de_centavos > p.preco_centavos)
    ORDER BY p.destaque DESC, p.estoque = 0, p.nome
  `) as Prod[]);
  const filtrando = !!(cat || q || soOfertas);
  const emOferta = produtos.filter((p) => descontoPct(p.preco_de_centavos, p.preco_centavos) > 0)
    .sort((a, b) => descontoPct(b.preco_de_centavos, b.preco_centavos) - descontoPct(a.preco_de_centavos, a.preco_centavos));
  const sessao = filtrando ? null : await getSessao();
  const comprados = sessao ? await jaComprados(sessao.id) : [];
  const favoritos = sessao ? ((await sql`
    SELECT p.id, p.slug, p.nome, p.marca, p.peso_kg, p.preco_centavos, p.preco_de_centavos, p.estoque, p.imagem_url, p.destaque, c.slug AS categoria_slug
    FROM favoritos f JOIN produtos p ON p.id = f.produto_id JOIN categorias c ON c.id = p.categoria_id
    WHERE f.usuario_id = ${sessao.id} AND p.ativo ORDER BY f.criado_em DESC LIMIT 10
  `) as Prod[]) : [];
  const pets = sessao ? await petsDoUsuario(sessao.id) : [];
  const paraPets = await indicadosPorPet(pets, 10);
  const depoimentos = filtrando ? [] : ((await sql`
    SELECT a.id, split_part(u.nome, ' ', 1) AS nome, a.nota, a.comentario, a.resposta
    FROM avaliacoes a JOIN usuarios u ON u.id = a.cliente_id
    WHERE a.publicada AND a.comentario IS NOT NULL
    ORDER BY a.criado_em DESC LIMIT 6
  `) as { id: number; nome: string; nota: number; comentario: string; resposta: string | null }[]);
  const [notaGeral] = filtrando ? [] : ((await sql`SELECT count(*)::int AS n, round(avg(nota)::numeric, 1)::float AS media FROM avaliacoes`) as { n: number; media: number | null }[]);
  const atual = categorias.find((c) => c.slug === cat);

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
            <span className={`block aspect-square w-full overflow-hidden rounded-[22px] bg-white transition duration-200 ease-out active:scale-95 ${on ? "ring-4 ring-pine-700" : "hover:-translate-y-1 hover:ring-4 hover:ring-pine-100"}`}>
              {ilustracao[c.slug] ? <img src={ilustracao[c.slug]} alt="" className={`h-full w-full object-cover transition-transform duration-300 ease-out ${on ? "scale-[1.5]" : "scale-[1.35]"}`} /> : <span className="grid h-full place-items-center text-3xl">🐾</span>}
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
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{q ? `“${q}”` : soOfertas ? "Ofertas" : atual?.nome}</h1>
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
            {produtos.map((p, i) => <ProdutoCard key={p.id} p={p} i={i % 10} />)}
          </div>
        )}
      </div>
    );
  }

  const secoes = categorias
    .map((c) => ({ c, itens: produtos.filter((p) => p.categoria_slug === c.slug) }))
    .filter((s) => s.itens.length >= 2);

  const Carrossel = ({ titulo, href, itens, destaque }: { titulo: string; href?: string; itens: Prod[]; destaque?: boolean }) => (
    <section className={destaque ? "-mx-4 bg-gradient-to-b from-kibble-50 to-transparent px-4 pb-2 pt-5 sm:mx-0 sm:rounded-[28px] sm:px-5" : ""}>
      <div data-reveal className="mb-3 flex items-end justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-xl font-extrabold tracking-tight sm:text-2xl">
          <span aria-hidden className={`h-6 w-1.5 rounded-full ${destaque ? "bg-oferta" : "bg-kibble-500"}`} />
          {titulo}
        </h2>
        {href && <Link href={href} className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-1 text-sm font-bold text-pine-700 hover:bg-pine-50">Ver tudo <IconChevron width={16} height={16} /></Link>}
      </div>
      <div className="carrossel no-scrollbar snap-x-row -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 lg:mx-0 lg:grid lg:grid-cols-5 lg:gap-5 lg:overflow-visible lg:px-0">
        {itens.slice(0, 10).map((p, i) => <ProdutoCard key={p.id} p={p} compacto i={i} />)}
      </div>
    </section>
  );

  const cfg = await getConfig();
  const loja = {
    "@context": "https://schema.org",
    "@type": "PetStore",
    name: cfg.loja_nome || "Casa de Ração",
    url: urlSite(),
    image: `${urlSite()}/icons/icon-512.png`,
    description: "Ração para cães, gatos e aves com entrega no bairro, retirada grátis e pagamento por PIX, cartão ou dinheiro.",
    priceRange: "$$",
    paymentAccepted: "PIX, Cartão, Dinheiro",
    currenciesAccepted: "BRL",
    ...(cfg.loja_whatsapp ? { telephone: `+${cfg.loja_whatsapp.replace(/\D/g, "")}` } : {}),
    ...(cfg.loja_endereco ? { address: { "@type": "PostalAddress", streetAddress: cfg.loja_endereco, ...(cfg.loja_cep ? { postalCode: cfg.loja_cep } : {}), addressCountry: "BR" } } : {}),
    ...(cfg.loja_lat && cfg.loja_lng ? { geo: { "@type": "GeoCoordinates", latitude: Number(cfg.loja_lat), longitude: Number(cfg.loja_lng) } } : {}),
    ...(notaGeral?.media && notaGeral.n >= 3 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: notaGeral.media, reviewCount: notaGeral.n, bestRating: 5 } } : {}),
  };

  return (
    <>
    <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(loja)} />
    <div className="space-y-8 sm:space-y-10">
      <Banners freteGratis={Number(cfg.frete_gratis_minimo_centavos ?? 15000)} temOfertas={emOferta.length > 0} />
      <Categorias />
      {comprados.length > 0 && <Carrossel titulo="Comprar de novo" href="/conta" itens={comprados as Prod[]} />}
      {paraPets.map(({ pet, itens }) => <Carrossel key={pet.id} titulo={`Para ${pet.nome}`} href="/conta/pets" itens={itens as Prod[]} />)}
      {sessao && pets.length === 0 && (
        <Link href="/conta/pets" className="flex items-center gap-3 rounded-2xl bg-pine-50 p-4 text-pine-900 transition hover:bg-pine-100" data-reveal>
          <span className="text-2xl" aria-hidden>🐾</span>
          <span className="flex-1 text-sm"><b className="block text-[15px]">Cadastre seu pet</b>Indicamos a ração certa e avisamos antes de acabar.</span>
          <IconChevron width={18} height={18} />
        </Link>
      )}
      {favoritos.length > 0 && <Carrossel titulo="Seus favoritos" href="/conta/favoritos" itens={favoritos} />}
      {emOferta.length > 0 && <Carrossel titulo="Ofertas da semana" href="/?ofertas=1" itens={emOferta} destaque />}
      <div id="mais-pedidos" className="scroll-mt-40"><Carrossel titulo="Mais pedidos no bairro" itens={produtos} /></div>
      {secoes.map(({ c, itens }) => <Carrossel key={c.id} titulo={c.nome} href={`/?cat=${c.slug}`} itens={itens} />)}
      {depoimentos.length > 0 && (
        <section aria-labelledby="depoimentos">
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 id="depoimentos" className="text-xl font-extrabold tracking-tight sm:text-2xl">Quem compra, recomenda</h2>
            {notaGeral?.media && notaGeral.n >= 3 && (
              <span className="text-sm font-bold text-ink-2"><span className="text-kibble-500">★</span> {String(notaGeral.media).replace(".", ",")} · {notaGeral.n} avaliações</span>
            )}
          </div>
          <div className="carrossel no-scrollbar snap-x-row -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-5 lg:overflow-visible lg:px-0">
            {depoimentos.map((d, i) => (
              <figure key={d.id} data-reveal style={{ "--i": i } as React.CSSProperties} className="w-[78%] shrink-0 rounded-[22px] bg-white p-5 sm:w-[46%] lg:w-auto">
                <div className="text-kibble-500" aria-label={`${d.nota} de 5 estrelas`}>{"★".repeat(d.nota)}</div>
                <blockquote className="mt-2 text-[15px] leading-relaxed text-ink">“{d.comentario}”</blockquote>
                <figcaption className="mt-3 text-sm font-bold text-ink-2">{d.nome}</figcaption>
                {d.resposta && <p className="mt-2 rounded-xl bg-pine-50 p-2.5 text-xs text-pine-800"><b>Loja:</b> {d.resposta}</p>}
              </figure>
            ))}
          </div>
        </section>
      )}
      <section className="grid gap-3 rounded-[28px] bg-white p-5 sm:grid-cols-3 sm:p-6">
        {[
          ["Entrega com hora marcada", "Janelas por bairro. Você sabe quando chega."],
          ["Pague como preferir", "PIX na hora ou dinheiro e cartão na entrega."],
          ["Retire sem custo", "Prefere buscar? Fica pronto em cerca de 1 hora."],
        ].map(([t, d], i) => (
          <div key={t} data-reveal style={{ "--i": i } as React.CSSProperties}><div className="font-extrabold">{t}</div><div className="muted">{d}</div></div>
        ))}
      </section>
    </div>
    </>
  );
}

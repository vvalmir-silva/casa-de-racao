import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { brl } from "@/lib/utils";
import { AdicionarBotao } from "@/components/AdicionarBotao";
import type { ProdutoResumo } from "@/components/ProdutoCard";

export const dynamic = "force-dynamic";

export default async function ProdutoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const rows = (await sql`
    SELECT p.id, p.slug, p.nome, p.marca, p.descricao, p.peso_kg, p.preco_centavos, p.estoque, p.imagem_url, p.duracao_dias, c.nome AS categoria, c.slug AS cat_slug
    FROM produtos p JOIN categorias c ON c.id = p.categoria_id WHERE p.slug = ${slug} AND p.ativo
  `) as (ProdutoResumo & { descricao: string | null; categoria: string; cat_slug: string; duracao_dias: number | null })[];
  const p = rows[0];
  if (!p) notFound();
  const peso = Number(p.peso_kg);
  return (
    <div className="space-y-5">
      <nav className="text-sm text-ink-3"><Link href="/" className="hover:text-pine-700">Início</Link> / <Link href={`/?cat=${p.cat_slug}`} className="hover:text-pine-700">{p.categoria}</Link></nav>
      <div className="grid gap-5 md:grid-cols-[1fr_1fr] md:gap-10">
        <div className="overflow-hidden rounded-3xl bg-white">
          <div className="aspect-square">
            {p.imagem_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.imagem_url} alt={p.nome} className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center text-7xl">🐾</div>
            )}
          </div>
        </div>
        <div className="space-y-5">
          <div>
            <div className="text-sm font-semibold text-ink-3">{p.marca} · {peso} kg</div>
            <h1 className="h1 mt-1">{p.nome}</h1>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-extrabold tracking-tight text-pine-700">{brl(p.preco_centavos)}</span>
            {peso >= 1 && <span className="text-sm font-semibold text-ink-4">{brl(Math.round(p.preco_centavos / peso))}/kg</span>}
          </div>
          <AdicionarBotao p={{ ...p, peso_kg: peso }} />
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl bg-white p-3"><div className="font-bold">{p.estoque > 0 ? `${p.estoque} em estoque` : "Esgotado"}</div><div className="muted">na loja, pronto para sair</div></div>
            {p.duracao_dias && <div className="rounded-xl bg-white p-3"><div className="font-bold">~{p.duracao_dias} dias</div><div className="muted">de ração para um pet médio</div></div>}
          </div>
          {p.descricao && <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink-2">{p.descricao}</p>}
          <div className="rounded-2xl border border-dashed border-pine-200 bg-pine-50 p-4 text-sm text-pine-800">
            <b>Assine e esqueça.</b> Escolha o intervalo e a ração chega antes de acabar. <Link href="/conta/assinaturas" className="font-bold underline">Criar assinatura</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

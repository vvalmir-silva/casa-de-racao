import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { brl } from "@/lib/utils";
import { AdicionarBotao } from "@/components/AdicionarBotao";
import type { ProdutoResumo } from "@/components/ProdutoCard";

export const dynamic = "force-dynamic";

export default async function ProdutoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const rows = (await sql`
    SELECT p.id, p.slug, p.nome, p.marca, p.descricao, p.peso_kg, p.preco_centavos, p.estoque, p.imagem_url, c.nome AS categoria
    FROM produtos p JOIN categorias c ON c.id = p.categoria_id WHERE p.slug = ${slug} AND p.ativo
  `) as (ProdutoResumo & { descricao: string | null; categoria: string })[];
  const p = rows[0];
  if (!p) notFound();
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="aspect-square overflow-hidden rounded-2xl bg-stone-100">
        {p.imagem_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.imagem_url} alt={p.nome} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-7xl">🐾</div>
        )}
      </div>
      <div className="space-y-4">
        <div className="text-xs uppercase tracking-wide text-stone-500">{p.categoria}</div>
        <h1 className="text-2xl font-bold">{p.nome}</h1>
        <div className="text-sm text-stone-600">{p.marca} · {Number(p.peso_kg)} kg</div>
        <div className="text-3xl font-bold text-brand-700">{brl(p.preco_centavos)}</div>
        <p className="text-sm text-stone-700 whitespace-pre-line">{p.descricao}</p>
        <div className="text-sm">{p.estoque > 0 ? `${p.estoque} em estoque` : "Esgotado"}</div>
        <AdicionarBotao p={{ ...p, peso_kg: Number(p.peso_kg) }} />
      </div>
    </div>
  );
}

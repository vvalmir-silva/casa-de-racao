import Link from "next/link";
import { exigirSessao } from "@/lib/auth";
import { sql } from "@/lib/db";
import { ProdutoCard, type ProdutoResumo } from "@/components/ProdutoCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Favoritos" };

export default async function FavoritosPage() {
  const s = await exigirSessao();
  const produtos = (await sql`
    SELECT p.id, p.slug, p.nome, p.marca, p.peso_kg, p.preco_centavos, p.estoque, p.imagem_url
    FROM favoritos f JOIN produtos p ON p.id = f.produto_id
    WHERE f.usuario_id = ${s.id} AND p.ativo
    ORDER BY p.estoque = 0, f.criado_em DESC
  `) as ProdutoResumo[];
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="h1">Favoritos</h1>
          <p className="muted">{produtos.length ? `${produtos.length} ${produtos.length === 1 ? "produto" : "produtos"} salvos` : "Toque no coração de um produto para guardar aqui."}</p>
        </div>
        <Link href="/conta" className="btn-ghost">Minha conta</Link>
      </div>
      {produtos.length === 0 ? (
        <div className="rounded-[28px] bg-white px-6 py-14 text-center">
          <div className="text-4xl" aria-hidden>🤍</div>
          <p className="mt-3 text-lg font-extrabold">Nenhum favorito ainda</p>
          <p className="muted">Salve a ração do seu pet para achar rápido na próxima compra.</p>
          <Link href="/" className="btn-primary mt-5 rounded-full">Ver produtos</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-5 lg:gap-x-5">
          {produtos.map((p) => <ProdutoCard key={p.id} p={p} />)}
        </div>
      )}
    </div>
  );
}

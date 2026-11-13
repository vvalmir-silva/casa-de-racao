"use client";

import Link from "next/link";
import { useCarrinho } from "@/lib/carrinho";
import { brl } from "@/lib/utils";

export type ProdutoResumo = {
  id: string;
  slug: string;
  nome: string;
  marca: string | null;
  peso_kg: number;
  preco_centavos: number;
  estoque: number;
  imagem_url: string | null;
};

export function ProdutoCard({ p }: { p: ProdutoResumo }) {
  const { adicionar } = useCarrinho();
  const sem = p.estoque <= 0;
  return (
    <div className="card flex flex-col gap-3">
      <Link href={`/produto/${p.slug}`} className="block">
        <div className="aspect-square w-full overflow-hidden rounded-lg bg-stone-100">
          {p.imagem_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imagem_url} alt={p.nome} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-4xl">🐾</div>
          )}
        </div>
        <div className="mt-2 text-xs text-stone-500">{p.marca} · {Number(p.peso_kg)} kg</div>
        <div className="line-clamp-2 text-sm font-medium">{p.nome}</div>
      </Link>
      <div className="mt-auto flex items-center justify-between">
        <div className="text-lg font-bold text-brand-700">{brl(p.preco_centavos)}</div>
        <button
          className="btn-primary px-3 py-2"
          disabled={sem}
          onClick={() => adicionar({ ...p, peso_kg: Number(p.peso_kg) })}
        >
          {sem ? "Esgotado" : "Adicionar"}
        </button>
      </div>
    </div>
  );
}

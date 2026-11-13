"use client";

import Link from "next/link";
import { useState } from "react";
import { useCarrinho } from "@/lib/carrinho";
import { brl } from "@/lib/utils";
import { IconCart } from "./Icons";

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
  const [ok, setOk] = useState(false);
  const sem = p.estoque <= 0;
  const porKg = Number(p.peso_kg) >= 1 ? brl(Math.round(p.preco_centavos / Number(p.peso_kg))) + "/kg" : null;

  function add() {
    adicionar({ ...p, peso_kg: Number(p.peso_kg) });
    setOk(true);
    setTimeout(() => setOk(false), 1200);
  }

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white">
      <Link href={`/produto/${p.slug}`} className="relative block bg-page">
        <div className="aspect-[4/4] w-full">
          {p.imagem_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imagem_url} alt={p.nome} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="grid h-full place-items-center text-4xl">🐾</div>
          )}
        </div>
        {sem ? (
          <span className="absolute left-3 top-3 rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold text-white">Esgotado</span>
        ) : p.estoque <= 3 ? (
          <span className="absolute left-3 top-3 rounded-full bg-kibble-500 px-2.5 py-1 text-[11px] font-bold text-ink">Últimas {p.estoque}</span>
        ) : null}
      </Link>
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <div className="text-[12px] font-semibold text-ink-3">{p.marca ?? "—"} · {Number(p.peso_kg)} kg</div>
        <Link href={`/produto/${p.slug}`} className="mt-0.5 line-clamp-2 min-h-[2.6em] text-[15px] font-bold leading-snug text-ink">{p.nome}</Link>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="price">{brl(p.preco_centavos)}</span>
          {porKg && <span className="text-[11px] font-semibold text-ink-4">{porKg}</span>}
        </div>
        <button
          className={`btn mt-3 w-full ${sem ? "bg-page text-ink-4" : ok ? "bg-pine-50 text-pine-700" : "bg-pine-700 text-white hover:bg-pine-800"}`}
          disabled={sem}
          onClick={add}
        >
          {sem ? "Esgotado" : ok ? "Adicionado ✓" : <><IconCart width={18} height={18} /> Adicionar</>}
        </button>
      </div>
    </article>
  );
}

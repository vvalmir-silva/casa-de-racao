"use client";

import type React from "react";

import Link from "next/link";
import { useCarrinho } from "@/lib/carrinho";
import { brl } from "@/lib/utils";
import { IconMinus, IconPlus } from "./Icons";
import { FavoritoBotao } from "./FavoritoBotao";
import { voarParaCarrinho } from "@/lib/voar";

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

/** Botão "+" que vira contador quando o item está no carrinho. */
export function Contador({ p, grande }: { p: ProdutoResumo; grande?: boolean }) {
  const { itens, adicionar, alterar, remover } = useCarrinho();
  const item = itens.find((i) => i.id === p.id);
  const sem = p.estoque <= 0;
  const h = grande ? "h-12" : "h-10";
  if (sem) return null;
  if (!item)
    return (
      <button
        onClick={(e) => { e.preventDefault(); voarParaCarrinho(e.currentTarget, p.imagem_url); adicionar({ ...p, peso_kg: Number(p.peso_kg) }); }}
        className={`grid ${h} ${grande ? "w-12" : "w-10"} place-items-center rounded-full bg-pine-700 text-white shadow-[0_6px_16px_-6px_rgba(27,77,62,.6)] transition hover:bg-pine-800 active:scale-90`}
        aria-label={`Adicionar ${p.nome}`}
      >
        <IconPlus width={20} height={20} />
      </button>
    );
  return (
    <div className={`flex ${h} items-center rounded-full bg-pine-700 text-white shadow-[0_6px_16px_-6px_rgba(27,77,62,.6)] animate-[surgir_.18s_ease-out]`} onClick={(e) => e.preventDefault()}>
      <button className={`grid ${h} w-10 place-items-center rounded-full active:scale-90`} aria-label="Tirar um" onClick={() => (item.qtd <= 1 ? remover(p.id) : alterar(p.id, item.qtd - 1))}><IconMinus width={18} height={18} /></button>
      <span className="min-w-[1.25rem] overflow-hidden text-center text-[15px] font-extrabold" aria-live="polite"><span key={item.qtd} className="inline-block animate-[tique_150ms_cubic-bezier(.16,1,.3,1)]">{item.qtd}</span></span>
      <button className={`grid ${h} w-10 place-items-center rounded-full active:scale-90 disabled:opacity-40`} aria-label="Pôr mais um" disabled={item.qtd >= p.estoque} onClick={(e) => { voarParaCarrinho(e.currentTarget, p.imagem_url); alterar(p.id, item.qtd + 1); }}><IconPlus width={18} height={18} /></button>
    </div>
  );
}

export function ProdutoCard({ p, compacto, i = 0 }: { p: ProdutoResumo; compacto?: boolean; i?: number }) {
  const sem = p.estoque <= 0;
  const peso = Number(p.peso_kg);
  return (
    <article data-reveal style={{ "--i": i } as React.CSSProperties} className={`card-produto group relative flex flex-col ${compacto ? "w-[160px] shrink-0 sm:w-[190px] lg:w-auto" : ""}`}>
      <Link href={`/produto/${p.slug}`} className="relative block overflow-hidden rounded-[22px] bg-white">
        <div className="aspect-square w-full transition duration-300 group-hover:scale-[1.03]">
          {p.imagem_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imagem_url} alt="" className={`h-full w-full object-cover ${sem ? "opacity-50 grayscale" : ""}`} loading="lazy" />
          ) : (
            <div className="grid h-full place-items-center text-4xl">🐾</div>
          )}
        </div>
        {sem ? (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-ink/85 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">Esgotado</span>
        ) : p.estoque <= 3 ? (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-red-700 backdrop-blur">Últimas {p.estoque}</span>
        ) : null}
      </Link>
      <div className="absolute right-2 top-2"><FavoritoBotao id={p.id} nome={p.nome} /></div>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex aspect-square items-end justify-end p-2.5">
        <div className="pointer-events-auto"><Contador p={p} /></div>
      </div>
      <Link href={`/produto/${p.slug}`} className="mt-2.5 block px-0.5">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[17px] font-extrabold tracking-tight text-ink">{brl(p.preco_centavos)}</span>
          {peso >= 1 && <span className="text-[11px] font-semibold text-ink-4">{brl(Math.round(p.preco_centavos / peso))}/kg</span>}
        </div>
        <div className="mt-0.5 line-clamp-2 text-[14px] font-semibold leading-snug text-ink-2">{p.nome}</div>
        <div className="mt-0.5 text-[12px] text-ink-4">{p.marca ?? ""}</div>
      </Link>
    </article>
  );
}

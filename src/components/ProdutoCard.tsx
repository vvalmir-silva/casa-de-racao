"use client";

import Link from "next/link";
import { useState } from "react";
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
  const [ok, setOk] = useState(false);
  const sem = p.estoque <= 0;
  function add() {
    adicionar({ ...p, peso_kg: Number(p.peso_kg) });
    setOk(true);
    setTimeout(() => setOk(false), 1200);
  }
  return (
    <div className="card flex flex-col gap-2 p-2.5 sm:p-3">
      <Link href={`/produto/${p.slug}`} className="block">
        <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-stone-100">
          {p.imagem_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imagem_url} alt={p.nome} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="grid h-full place-items-center text-4xl">🐾</div>
          )}
          {sem && <span className="absolute left-2 top-2 rounded-full bg-stone-900/80 px-2 py-0.5 text-[11px] font-medium text-white">Esgotado</span>}
          {!sem && p.estoque <= 3 && <span className="absolute left-2 top-2 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-medium text-white">Últimas {p.estoque}</span>}
        </div>
        <div className="mt-2 text-[11px] text-stone-500 sm:text-xs">{p.marca}{p.marca ? " · " : ""}{Number(p.peso_kg)} kg</div>
        <div className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-tight">{p.nome}</div>
      </Link>
      <div className="mt-auto space-y-1.5">
        <div className="text-lg font-bold text-brand-700">{brl(p.preco_centavos)}</div>
        <button className={`btn w-full ${ok ? "bg-green-600 text-white" : "bg-brand-600 text-white hover:bg-brand-700"}`} disabled={sem} onClick={add}>
          {sem ? "Esgotado" : ok ? "Adicionado ✓" : "Adicionar"}
        </button>
      </div>
    </div>
  );
}

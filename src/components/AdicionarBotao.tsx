"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCarrinho } from "@/lib/carrinho";
import type { ProdutoResumo } from "./ProdutoCard";
import { IconCart } from "./Icons";

export function AdicionarBotao({ p }: { p: ProdutoResumo }) {
  const { adicionar } = useCarrinho();
  const [qtd, setQtd] = useState(1);
  const router = useRouter();
  if (p.estoque <= 0) return <button className="btn-outline w-full" disabled>Esgotado</button>;
  return (
    <div className="flex items-stretch gap-2">
      <div className="flex items-center rounded-xl border border-line-2 bg-white">
        <button className="h-[46px] w-11 text-xl" onClick={() => setQtd((q) => Math.max(1, q - 1))} aria-label="menos">−</button>
        <span className="w-8 text-center font-bold">{qtd}</span>
        <button className="h-[46px] w-11 text-xl" onClick={() => setQtd((q) => Math.min(p.estoque, q + 1))} aria-label="mais">+</button>
      </div>
      <button className="btn-primary flex-1" onClick={() => { adicionar(p, qtd); router.push("/carrinho"); }}>
        <IconCart width={18} height={18} /> Adicionar ao carrinho
      </button>
    </div>
  );
}

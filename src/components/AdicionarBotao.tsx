"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCarrinho } from "@/lib/carrinho";
import type { ProdutoResumo } from "./ProdutoCard";

export function AdicionarBotao({ p }: { p: ProdutoResumo }) {
  const { adicionar } = useCarrinho();
  const [qtd, setQtd] = useState(1);
  const router = useRouter();
  if (p.estoque <= 0) return <button className="btn-outline" disabled>Esgotado</button>;
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center rounded-lg border border-stone-300">
        <button className="px-3 py-2" onClick={() => setQtd((q) => Math.max(1, q - 1))}>−</button>
        <span className="w-8 text-center text-sm">{qtd}</span>
        <button className="px-3 py-2" onClick={() => setQtd((q) => Math.min(p.estoque, q + 1))}>+</button>
      </div>
      <button className="btn-primary flex-1" onClick={() => { adicionar(p, qtd); router.push("/carrinho"); }}>
        Adicionar ao carrinho
      </button>
    </div>
  );
}

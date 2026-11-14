"use client";

import { useEffect, useState } from "react";
import { brl } from "@/lib/utils";
import { ProdutoCard, type ProdutoResumo } from "./ProdutoCard";

/** No carrinho: sugestões para atingir o frete grátis. */
export function CompleteFrete({ falta, idsNoCarrinho }: { falta: number; idsNoCarrinho: string[] }) {
  const [itens, setItens] = useState<ProdutoResumo[]>([]);
  const chave = idsNoCarrinho.slice().sort().join(",");
  // arredonda o que falta para não buscar a cada centavo
  const faixa = Math.ceil(falta / 500) * 500;

  useEffect(() => {
    if (faixa <= 0) { setItens([]); return; }
    let vivo = true;
    fetch(`/api/complemento?falta=${faixa}&excluir=${encodeURIComponent(chave)}`)
      .then((r) => r.json())
      .then((j: { itens: ProdutoResumo[] }) => { if (vivo) setItens(j.itens); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [faixa, chave]);

  if (falta <= 0 || itens.length === 0) return null;
  return (
    <section aria-labelledby="complete-frete" className="rounded-[24px] bg-gradient-to-b from-kibble-50 to-white p-4">
      <h2 id="complete-frete" className="text-[17px] font-extrabold">Complete e ganhe frete grátis 🚚</h2>
      <p className="muted mb-3">Faltam {brl(falta)}. Estes resolvem:</p>
      <div className="carrossel no-scrollbar snap-x-row -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {itens.map((p, i) => <ProdutoCard key={p.id} p={p} compacto i={i} />)}
      </div>
    </section>
  );
}

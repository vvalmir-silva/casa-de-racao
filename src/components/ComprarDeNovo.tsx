"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCarrinho } from "@/lib/carrinho";
import { brl } from "@/lib/utils";
import type { ItemRepetir } from "@/lib/repetir";

/** Põe no carrinho os itens de um pedido antigo, com preço e estoque de hoje. */
export function ComprarDeNovo({ itens, faltando, titulo = "Comprar de novo", compacto }: {
  itens: ItemRepetir[]; faltando: string[]; titulo?: string; compacto?: boolean;
}) {
  const { adicionar } = useCarrinho();
  const router = useRouter();
  const [indo, setIndo] = useState(false);
  if (itens.length === 0) return null;
  const total = itens.reduce((s, i) => s + i.preco_centavos * Math.min(i.qtd, i.estoque), 0);
  const qtd = itens.reduce((s, i) => s + Math.min(i.qtd, i.estoque), 0);

  const repetir = () => {
    setIndo(true);
    for (const i of itens) adicionar({ id: i.id, slug: i.slug, nome: i.nome, preco_centavos: i.preco_centavos, peso_kg: Number(i.peso_kg), estoque: i.estoque, imagem_url: i.imagem_url }, i.qtd);
    router.push("/carrinho");
  };

  return (
    <div className="card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="h2">{titulo}</div>
          {!compacto && <p className="muted">{qtd} {qtd === 1 ? "item" : "itens"} · {brl(total)} com os preços de hoje</p>}
        </div>
        <span className="text-2xl" aria-hidden>🔁</span>
      </div>
      {compacto && (
        <ul className="space-y-0.5 text-sm text-ink-2">
          {itens.slice(0, 3).map((i) => <li key={i.id}>{i.qtd}× {i.nome}</li>)}
          {itens.length > 3 && <li className="text-ink-4">+ {itens.length - 3} {itens.length - 3 === 1 ? "item" : "itens"}</li>}
        </ul>
      )}
      {faltando.length > 0 && (
        <p className="rounded-xl bg-kibble-50 p-2.5 text-sm text-ink">Fora de estoque, fica de fora: {faltando.join(", ")}.</p>
      )}
      <button className="btn-primary w-full" disabled={indo} onClick={repetir}>
        {indo ? "Indo para o carrinho…" : compacto ? `Repetir pedido · ${brl(total)}` : "Pôr tudo no carrinho"}
      </button>
    </div>
  );
}

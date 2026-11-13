"use client";

import Link from "next/link";
import { useCarrinho } from "@/lib/carrinho";
import { brl } from "@/lib/utils";

export default function CarrinhoPage() {
  const { itens, alterar, remover, subtotal, peso, pronto } = useCarrinho();
  if (!pronto) return null;
  if (itens.length === 0)
    return (
      <div className="card-flat mx-auto max-w-md py-14 text-center">
        <div className="text-5xl">🛒</div>
        <p className="mt-3 text-lg font-extrabold">Seu carrinho está vazio</p>
        <p className="muted">Escolha a ração e a gente leva.</p>
        <Link href="/" className="btn-primary mt-5">Ver produtos</Link>
      </div>
    );
  const faltaGratis = 15000 - subtotal;
  return (
    <div className="grid gap-5 md:grid-cols-[1fr_340px]">
      <div className="space-y-3">
        <h1 className="h1">Carrinho</h1>
        {faltaGratis > 0 ? (
          <div className="rounded-xl bg-kibble-50 px-4 py-3 text-sm text-ink"><b>Faltam {brl(faltaGratis)}</b> para frete grátis na rota do bairro.</div>
        ) : (
          <div className="rounded-xl bg-pine-50 px-4 py-3 text-sm text-pine-800"><b>Frete grátis</b> na rota do bairro garantido.</div>
        )}
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          {itens.map((i, k) => (
            <div key={i.id} className={`flex gap-3 p-3 sm:p-4 ${k > 0 ? "border-t border-line" : ""}`}>
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-page">
                {i.imagem_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.imagem_url} alt="" className="h-full w-full object-cover" />
                ) : <div className="grid h-full place-items-center text-2xl">🐾</div>}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="line-clamp-2 text-[15px] font-bold leading-snug">{i.nome}</div>
                <div className="muted">{brl(i.preco_centavos)} · {i.peso_kg} kg</div>
                <div className="mt-auto flex items-center justify-between pt-2">
                  <div className="flex items-center rounded-xl border border-line-2">
                    <button className="h-9 w-9 text-lg" onClick={() => alterar(i.id, i.qtd - 1)} aria-label="menos">−</button>
                    <span className="w-7 text-center text-sm font-bold">{i.qtd}</span>
                    <button className="h-9 w-9 text-lg" onClick={() => alterar(i.id, i.qtd + 1)} aria-label="mais">+</button>
                  </div>
                  <div className="text-right">
                    <div className="font-extrabold">{brl(i.preco_centavos * i.qtd)}</div>
                    <button className="text-xs font-semibold text-ink-3 underline" onClick={() => remover(i.id)}>remover</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <aside className="card h-fit space-y-3 md:sticky md:top-20">
        <h2 className="h2">Resumo</h2>
        <div className="flex justify-between text-sm"><span className="text-ink-3">Subtotal</span><b>{brl(subtotal)}</b></div>
        <div className="flex justify-between text-sm"><span className="text-ink-3">Peso</span><span>{peso.toFixed(1)} kg</span></div>
        <p className="muted">Frete e data de entrega na próxima etapa.</p>
        <Link href="/checkout" className="btn-primary w-full">Fechar pedido</Link>
        <Link href="/" className="btn-ghost w-full">Continuar comprando</Link>
      </aside>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useCarrinho } from "@/lib/carrinho";
import { brl } from "@/lib/utils";

export default function CarrinhoPage() {
  const { itens, alterar, remover, subtotal, peso, pronto } = useCarrinho();
  if (!pronto) return null;
  if (itens.length === 0)
    return (
      <div className="py-16 text-center">
        <div className="text-5xl">🛒</div>
        <p className="mt-3 text-stone-600">Seu carrinho está vazio.</p>
        <Link href="/" className="btn-primary mt-4">Ver produtos</Link>
      </div>
    );
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        <h1 className="text-xl font-bold">Carrinho</h1>
        {itens.map((i) => (
          <div key={i.id} className="card flex flex-wrap items-center gap-3">
            <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-stone-100 text-2xl">
              {i.imagem_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={i.imagem_url} alt="" className="h-full w-full object-cover" />
              ) : "🐾"}
            </div>
            <div className="min-w-0 flex-1 basis-40">
              <div className="line-clamp-2 text-sm font-medium">{i.nome}</div>
              <div className="text-xs text-stone-500">{brl(i.preco_centavos)} · {i.peso_kg} kg</div>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <div className="flex items-center rounded-lg border border-stone-300">
                <button className="h-10 w-10 text-lg" onClick={() => alterar(i.id, i.qtd - 1)} aria-label="menos">−</button>
                <span className="w-7 text-center text-sm">{i.qtd}</span>
                <button className="h-10 w-10 text-lg" onClick={() => alterar(i.id, i.qtd + 1)} aria-label="mais">+</button>
              </div>
              <div className="w-20 text-right text-sm font-semibold">{brl(i.preco_centavos * i.qtd)}</div>
              <button className="h-10 px-1 text-xs text-red-600" onClick={() => remover(i.id)}>remover</button>
            </div>
          </div>
        ))}
      </div>
      <aside className="card h-fit space-y-3 md:sticky md:top-20">
        <div className="flex justify-between text-sm"><span>Subtotal</span><b>{brl(subtotal)}</b></div>
        <div className="flex justify-between text-sm text-stone-500"><span>Peso</span><span>{peso.toFixed(1)} kg</span></div>
        <p className="text-xs text-stone-500">Frete calculado na próxima etapa.</p>
        <Link href="/checkout" className="btn-primary w-full">Finalizar pedido</Link>
        <Link href="/" className="btn-ghost w-full">Continuar comprando</Link>
      </aside>
    </div>
  );
}

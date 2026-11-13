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
          <div key={i.id} className="card flex items-center gap-3">
            <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-stone-100 text-2xl">
              {i.imagem_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={i.imagem_url} alt="" className="h-full w-full object-cover" />
              ) : "🐾"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{i.nome}</div>
              <div className="text-xs text-stone-500">{brl(i.preco_centavos)} · {i.peso_kg} kg</div>
            </div>
            <div className="flex items-center rounded-lg border border-stone-300">
              <button className="px-2 py-1" onClick={() => alterar(i.id, i.qtd - 1)}>−</button>
              <span className="w-7 text-center text-sm">{i.qtd}</span>
              <button className="px-2 py-1" onClick={() => alterar(i.id, i.qtd + 1)}>+</button>
            </div>
            <button className="text-xs text-red-600" onClick={() => remover(i.id)}>remover</button>
          </div>
        ))}
      </div>
      <aside className="card h-fit space-y-3">
        <div className="flex justify-between text-sm"><span>Subtotal</span><b>{brl(subtotal)}</b></div>
        <div className="flex justify-between text-sm text-stone-500"><span>Peso</span><span>{peso.toFixed(1)} kg</span></div>
        <p className="text-xs text-stone-500">Frete calculado na próxima etapa.</p>
        <Link href="/checkout" className="btn-primary w-full">Finalizar pedido</Link>
        <Link href="/" className="btn-ghost w-full">Continuar comprando</Link>
      </aside>
    </div>
  );
}

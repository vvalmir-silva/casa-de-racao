"use client";

import Link from "next/link";
import { useCarrinho } from "@/lib/carrinho";
import { brl } from "@/lib/utils";
import { IconMinus, IconPlus } from "@/components/Icons";

const GRATIS = 15000;

export default function CarrinhoPage() {
  const { itens, alterar, remover, subtotal, peso, pronto, quantidade } = useCarrinho();
  if (!pronto) return null;
  if (itens.length === 0)
    return (
      <div className="mx-auto max-w-md rounded-[28px] bg-white px-6 py-16 text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-page text-4xl">🛒</div>
        <p className="mt-4 text-xl font-extrabold">Carrinho vazio</p>
        <p className="muted mt-1">Escolha a ração e a gente leva até você.</p>
        <Link href="/" className="btn-primary mt-6">Ver produtos</Link>
      </div>
    );
  const pct = Math.min(100, (subtotal / GRATIS) * 100);
  const falta = GRATIS - subtotal;
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px] lg:gap-8">
      <div className="space-y-4">
        <div className="flex items-end justify-between">
          <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">Carrinho</h1>
          <span className="muted">{quantidade} {quantidade === 1 ? "item" : "itens"} · {peso.toFixed(1).replace(".", ",")} kg</span>
        </div>
        <div className="rounded-[24px] bg-white p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold">{falta > 0 ? <>Faltam <span className="text-pine-700">{brl(falta)}</span> para frete grátis</> : "Frete grátis na rota do bairro 🎉"}</span>
            <span className="text-ink-3">R$ 150</span>
          </div>
          <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-page"><div className="h-full rounded-full bg-gradient-to-r from-pine-500 to-pine-700 transition-[width] duration-500" style={{ width: `${pct}%` }} /></div>
        </div>
        <ul className="space-y-2">
          {itens.map((i) => (
            <li key={i.id} className="flex gap-3 rounded-[24px] bg-white p-3">
              <Link href={`/produto/${i.slug}`} className="h-24 w-24 shrink-0 overflow-hidden rounded-[18px] bg-page">
                {i.imagem_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.imagem_url} alt="" className="h-full w-full object-cover" />
                ) : <div className="grid h-full place-items-center text-2xl">🐾</div>}
              </Link>
              <div className="flex min-w-0 flex-1 flex-col py-0.5">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/produto/${i.slug}`} className="line-clamp-2 text-[15px] font-bold leading-snug">{i.nome}</Link>
                  <button className="shrink-0 rounded-full px-2 py-1 text-xs font-bold text-ink-3 hover:bg-page" onClick={() => remover(i.id)}>Remover</button>
                </div>
                <div className="text-[13px] text-ink-3">{brl(i.preco_centavos)} cada</div>
                <div className="mt-auto flex items-center justify-between pt-2">
                  <div className="flex h-10 items-center rounded-full bg-page">
                    <button className="grid h-10 w-10 place-items-center rounded-full active:scale-90" onClick={() => (i.qtd <= 1 ? remover(i.id) : alterar(i.id, i.qtd - 1))} aria-label="Tirar um"><IconMinus width={16} height={16} /></button>
                    <span className="w-6 text-center text-sm font-extrabold">{i.qtd}</span>
                    <button className="grid h-10 w-10 place-items-center rounded-full active:scale-90 disabled:opacity-40" disabled={i.qtd >= i.estoque} onClick={() => alterar(i.id, i.qtd + 1)} aria-label="Pôr mais um"><IconPlus width={16} height={16} /></button>
                  </div>
                  <div className="text-[17px] font-extrabold">{brl(i.preco_centavos * i.qtd)}</div>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <Link href="/" className="btn-ghost">+ Adicionar mais itens</Link>
      </div>
      <aside className="h-fit space-y-4 rounded-[24px] bg-white p-5 lg:sticky lg:top-24">
        <h2 className="text-lg font-extrabold">Resumo</h2>
        <div className="space-y-1.5 text-[15px]">
          <div className="flex justify-between"><span className="text-ink-3">Subtotal</span><b>{brl(subtotal)}</b></div>
          <div className="flex justify-between"><span className="text-ink-3">Entrega</span><span className="text-ink-3">no próximo passo</span></div>
        </div>
        <Link href="/checkout" className="btn-primary w-full text-[16px]">Continuar · {brl(subtotal)}</Link>
      </aside>
    </div>
  );
}

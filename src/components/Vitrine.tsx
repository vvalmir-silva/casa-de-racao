"use client";

import Link from "next/link";
import { useLocal } from "@/lib/local";
import { IconChevron, IconPin } from "./Icons";

/** Banners da home: bento no desktop, carrossel no celular. */
export function Banners() {
  const { abrir, local } = useLocal();
  return (
    <section aria-label="Destaques" className="carrossel no-scrollbar snap-x-row -mx-4 flex gap-3 overflow-x-auto px-4 lg:mx-0 lg:grid lg:grid-cols-3 lg:grid-rows-2 lg:gap-4 lg:overflow-visible lg:px-0">
      {/* principal */}
      <div className="group relative flex min-h-[230px] w-[88%] shrink-0 overflow-hidden rounded-[28px] bg-pine-700 p-6 text-white sm:w-[70%] lg:col-span-2 lg:row-span-2 lg:min-h-[360px] lg:w-auto lg:p-10">
        <div className="relative z-10 flex max-w-[62%] flex-col lg:max-w-[52%]">
          <h1 className="text-[26px] font-extrabold leading-[1.02] tracking-[-0.02em] sm:text-[34px] lg:text-[52px]">Ração na porta, no dia certo.</h1>
          <p className="mt-3 hidden text-[15px] leading-relaxed text-pine-100 sm:block lg:text-base">Pedidos até 15h chegam hoje entre 18h e 21h. A gente carrega o saco de 15 kg.</p>
          <button onClick={abrir} className="mt-auto inline-flex min-h-[46px] w-fit items-center gap-2 whitespace-nowrap rounded-full bg-white px-4 text-[14px] font-extrabold text-pine-800 transition hover:bg-kibble-50 active:scale-[.98] lg:mt-8">
            <IconPin width={18} height={18} /> {local ? "Trocar CEP" : <>Ver entrega<span className="hidden sm:inline"> no meu CEP</span></>}
          </button>
        </div>
        <div aria-hidden className="absolute -bottom-6 -right-6 h-[115%] w-[58%] lg:-bottom-10 lg:right-0 lg:w-[50%]">
          <div className="absolute bottom-0 right-[38%] h-[64%] w-[52%] -rotate-[8deg] overflow-hidden rounded-[22px] shadow-pop transition-transform duration-300 ease-out group-hover:-translate-y-2 group-hover:-rotate-[12deg]"><img src="/produtos/racao-gato.svg" alt="" className="h-full w-full object-cover" /></div>
          <div className="absolute bottom-[8%] right-[2%] h-[78%] w-[60%] rotate-[6deg] overflow-hidden rounded-[22px] shadow-pop transition-transform duration-300 ease-out group-hover:-translate-y-3 group-hover:rotate-[10deg]"><img src="/produtos/racao-cao.svg" alt="" className="h-full w-full object-cover" /></div>
        </div>
      </div>
      <Link href="/carrinho" className="transition-transform duration-200 ease-out hover:-translate-y-1 active:scale-[.98] relative flex min-h-[230px] w-[70%] shrink-0 flex-col justify-between overflow-hidden rounded-[28px] bg-kibble-400 p-6 text-ink sm:w-[45%] lg:min-h-0 lg:w-auto">
        <span className="text-[13px] font-bold text-ink/70">Rota do bairro</span>
        <span className="text-[30px] font-extrabold leading-[1] tracking-[-0.02em] lg:text-[34px]">Frete grátis<br />acima de R$ 150</span>
        <span className="inline-flex items-center gap-1 text-[14px] font-extrabold">Montar pedido <IconChevron width={16} height={16} /></span>
      </Link>
      <Link href="/conta/assinaturas" className="transition-transform duration-200 ease-out hover:-translate-y-1 active:scale-[.98] relative flex min-h-[230px] w-[70%] shrink-0 flex-col justify-between overflow-hidden rounded-[28px] bg-[#DCEBE3] p-6 text-pine-900 sm:w-[45%] lg:min-h-0 lg:w-auto">
        <span className="text-[13px] font-bold text-pine-800/70">Assinatura</span>
        <span className="text-[30px] font-extrabold leading-[1] tracking-[-0.02em] lg:text-[34px]">A ração chega antes de acabar</span>
        <span className="inline-flex items-center gap-1 text-[14px] font-extrabold">Assinar <IconChevron width={16} height={16} /></span>
      </Link>
    </section>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocal } from "@/lib/local";
import { brl } from "@/lib/utils";
import { IconChevron, IconPin } from "./Icons";

type Slide = { id: string; fundo: string; conteudo: ReactNode; arte?: ReactNode };

/**
 * Banner principal rotativo: troca sozinho a cada 6s, com setas, bolinhas, arrastar e botão de pausa.
 * Para quem pede menos movimento, não troca sozinho. Pausa com mouse em cima, foco ou toque.
 */
export function Banners({ freteGratis = 15000, temOfertas = false }: { freteGratis?: number; temOfertas?: boolean }) {
  const { abrir, local } = useLocal();
  const trilho = useRef<HTMLDivElement>(null);
  const [atual, setAtual] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [interagindo, setInteragindo] = useState(false);
  const [reduzir, setReduzir] = useState(true);

  const Pacote = ({ src, cls }: { src: string; cls: string }) => (
    <div className={`absolute overflow-hidden rounded-[18px] shadow-pop transition-transform duration-300 ease-out ${cls}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-full w-full object-cover" />
    </div>
  );

  const slides: Slide[] = [
    {
      id: "entrega",
      fundo: "bg-pine-700 text-white",
      conteudo: (
        <>
          <span className="text-[12px] font-extrabold uppercase tracking-wider text-kibble-400">Entrega no bairro</span>
          <h1 className="mt-1 text-[26px] font-extrabold leading-[1.02] tracking-[-0.02em] sm:text-[36px] lg:text-[52px]">Ração na porta, <br />no dia certo.</h1>
          <p className="mt-2 hidden max-w-md text-[15px] text-pine-100 sm:block">Escolha o horário. A gente leva até o saco de 15 kg.</p>
          <button onClick={abrir} className="btn mt-4 w-fit whitespace-nowrap bg-kibble-500 px-5 text-ink hover:bg-kibble-400 lg:mt-6">
            <IconPin width={18} height={18} /> {local ? "Trocar CEP" : <>Ver<span className="hidden sm:inline"> entrega</span> no meu CEP</>}
          </button>
        </>
      ),
      arte: (
        <>
          <Pacote src="/produtos/racao-gato.svg" cls="bottom-[-6%] right-[34%] h-[62%] w-[34%] -rotate-[8deg] group-hover:-translate-y-2 group-hover:-rotate-[12deg] lg:w-[26%]" />
          <Pacote src="/produtos/racao-cao.svg" cls="bottom-[4%] right-[4%] h-[80%] w-[40%] rotate-[6deg] group-hover:-translate-y-3 group-hover:rotate-[10deg] lg:w-[30%]" />
        </>
      ),
    },
    {
      id: "frete",
      fundo: "bg-kibble-500 text-ink",
      conteudo: (
        <>
          <span className="text-[12px] font-extrabold uppercase tracking-wider text-ink/70">Rota do bairro</span>
          <h2 className="mt-1 text-[28px] font-extrabold leading-[1] tracking-[-0.02em] sm:text-[40px] lg:text-[56px]">Frete grátis<br />acima de {brl(freteGratis).replace(",00", "")}</h2>
          <Link href={temOfertas ? "/?ofertas=1" : "/#mais-pedidos"} className="btn mt-4 w-fit bg-ink px-5 text-white hover:bg-pine-900 lg:mt-6">
            {temOfertas ? "Ver ofertas" : "Montar meu pedido"} <IconChevron width={16} height={16} />
          </Link>
        </>
      ),
      arte: (
        <>
          <Pacote src="/produtos/areia.svg" cls="bottom-[-4%] right-[36%] h-[58%] w-[30%] -rotate-[6deg] group-hover:-translate-y-2 lg:w-[22%]" />
          <Pacote src="/produtos/petisco.svg" cls="bottom-[6%] right-[6%] h-[72%] w-[36%] rotate-[8deg] group-hover:-translate-y-3 lg:w-[27%]" />
        </>
      ),
    },
    {
      id: "assinatura",
      fundo: "bg-pine-100 text-pine-900",
      conteudo: (
        <>
          <span className="text-[12px] font-extrabold uppercase tracking-wider text-pine-700">Assinatura</span>
          <h2 className="mt-1 text-[26px] font-extrabold leading-[1.02] tracking-[-0.02em] sm:text-[36px] lg:text-[52px]">A ração chega<br />antes de acabar.</h2>
          <p className="mt-2 hidden max-w-md text-[15px] text-pine-800 sm:block">Você escolhe o intervalo. O pedido sai sozinho, sem esquecer.</p>
          <Link href="/conta/assinaturas" className="btn-primary mt-4 w-fit px-5 lg:mt-6">Assinar agora <IconChevron width={16} height={16} /></Link>
        </>
      ),
      arte: (
        <>
          <Pacote src="/produtos/racao-ave.svg" cls="bottom-[-4%] right-[36%] h-[58%] w-[30%] -rotate-[6deg] group-hover:-translate-y-2 lg:w-[22%]" />
          <Pacote src="/produtos/racao-cao-filhote.svg" cls="bottom-[6%] right-[6%] h-[76%] w-[38%] rotate-[5deg] group-hover:-translate-y-3 lg:w-[28%]" />
        </>
      ),
    },
  ];
  const total = slides.length;
  const claro = slides[atual]?.id !== "entrega";

  const irPara = useCallback((i: number) => {
    const el = trilho.current;
    if (!el) return;
    const alvo = ((i % total) + total) % total;
    el.scrollTo({ left: alvo * el.clientWidth, behavior: reduzir ? "auto" : "smooth" });
  }, [total, reduzir]);

  useEffect(() => { setReduzir(window.matchMedia("(prefers-reduced-motion: reduce)").matches); }, []);

  // qual slide está na tela
  useEffect(() => {
    const el = trilho.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setAtual(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)))); };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => { el.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);

  // troca automática
  useEffect(() => {
    if (reduzir || pausado || interagindo) return;
    const t = setTimeout(() => irPara(atual + 1), 6000);
    return () => clearTimeout(t);
  }, [atual, pausado, interagindo, reduzir, irPara]);

  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Destaques"
      className="relative -mx-4 sm:mx-0"
      onMouseEnter={() => setInteragindo(true)}
      onMouseLeave={() => setInteragindo(false)}
      onFocus={() => setInteragindo(true)}
      onBlur={() => setInteragindo(false)}
      onTouchStart={() => setInteragindo(true)}
      onTouchEnd={() => setTimeout(() => setInteragindo(false), 4000)}
    >
      <div ref={trilho} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto sm:rounded-[28px]">
        {slides.map((s, i) => (
          <div
            key={s.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} de ${total}`}
            inert={i !== atual}
            className={`group relative flex min-h-[240px] w-full shrink-0 snap-start overflow-hidden px-6 py-7 sm:min-h-[300px] sm:px-10 lg:min-h-[380px] lg:px-16 lg:py-12 ${s.fundo}`}
          >
            <div className={`relative z-10 flex max-w-[60%] flex-col justify-center sm:max-w-[55%] ${i === atual ? "animate-[surgir_300ms_cubic-bezier(.16,1,.3,1)]" : ""}`}>
              {s.conteudo}
            </div>
            <div aria-hidden className="absolute inset-y-0 right-0 w-[60%] lg:w-[55%]">{s.arte}</div>
          </div>
        ))}
      </div>

      <button aria-label="Destaque anterior" onClick={() => irPara(atual - 1)} className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow-card transition hover:bg-white sm:grid">
        <IconChevron width={20} height={20} className="rotate-180" />
      </button>
      <button aria-label="Próximo destaque" onClick={() => irPara(atual + 1)} className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow-card transition hover:bg-white sm:grid">
        <IconChevron width={20} height={20} />
      </button>

      <div className="absolute bottom-2 left-6 flex items-center gap-1.5 sm:inset-x-0 sm:left-0 sm:bottom-3 sm:justify-center sm:gap-2">
        {slides.map((s, i) => (
          <button key={s.id} aria-label={`Ir para o destaque ${i + 1}`} aria-current={i === atual} onClick={() => irPara(i)} className="grid h-6 w-7 place-items-center">
            <span className={`block h-2 w-6 rounded-full transition-[transform,opacity] duration-200 ease-out ${claro ? "bg-ink" : "bg-white"} ${i === atual ? "scale-x-100 opacity-100" : "scale-x-[.34] opacity-50"}`} />
          </button>
        ))}
        {!reduzir && (
          <button aria-label={pausado ? "Continuar troca automática" : "Pausar troca automática"} onClick={() => setPausado((p) => !p)}
            className="ml-1 grid h-7 w-7 place-items-center rounded-full bg-black/30 text-[11px] font-black text-white hover:bg-black/40">
            {pausado ? "▶" : "❚❚"}
          </button>
        )}
      </div>
    </section>
  );
}

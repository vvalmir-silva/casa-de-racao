"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useCarrinho } from "@/lib/carrinho";
import { useFavoritos } from "@/lib/favoritos";
import { brl } from "@/lib/utils";
import type { Sessao } from "@/lib/auth";
import { IconCart, IconChevron, IconHome, IconPaw, IconSettings, IconTruck, IconUser } from "./Icons";
import { LocalChip } from "./LocalSheet";
import { BuscaCampo } from "./BuscaCampo";

export type CategoriaMenu = { nome: string; slug: string };

const IconMenu = () => (<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M4 7h16M4 12h16M4 17h16" /></svg>);
const IconCoracao = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden><path d="M12 20.5s-7.5-4.6-7.5-10.3A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.6c0 5.7-7.5 10.3-7.5 10.3z" /></svg>);

export function Header({ sessao, categorias, avisos }: { sessao: Sessao | null; categorias: CategoriaMenu[]; avisos: string[] }) {
  const { quantidade: qtdCarrinho, subtotal } = useCarrinho();
  // o header hidrata depois do carrinho ler o localStorage: só mostra a contagem após montar
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  const quantidade = montado ? qtdCarrinho : 0;
  const path = usePathname();
  const sp = useSearchParams();
  const [menu, setMenu] = useState(false);
  const on = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));
  const nome = sessao?.nome.split(" ")[0];
  const loja = !path.startsWith("/admin") && !path.startsWith("/motorista");
  const mostraBusca = path === "/" || path.startsWith("/produto") || path.startsWith("/conta/favoritos");
  const catAtual = path === "/" ? sp.get("cat") : null;
  const ofertas = path === "/" && sp.get("ofertas") === "1";

  useEffect(() => setMenu(false), [path, sp]);

  return (
    <>
      {loja && <FaixaAvisos avisos={avisos} />}
      <header className="topo sticky top-0 z-30 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-1.5 px-3 sm:gap-4 md:h-[76px] lg:px-6">
          {loja && (
            <button className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-ink hover:bg-page md:hidden" aria-label="Abrir menu" aria-expanded={menu} onClick={() => setMenu(true)}>
              <IconMenu />
            </button>
          )}
          <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2" aria-label="Casa de Ração, início">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-pine-700 text-kibble-400 md:h-11 md:w-11"><IconPaw width={24} height={24} /></span>
            <span className="leading-none">
              <span className="block whitespace-nowrap text-[17px] font-extrabold tracking-tight text-pine-800 md:text-[20px]">Casa de Ração</span>
              <span className="mt-0.5 hidden text-[11px] font-semibold text-ink-3 md:block">pet shop do bairro</span>
            </span>
          </Link>

          {loja && <BuscaCampo className="mx-2 hidden max-w-2xl flex-1 md:block lg:mx-6" />}

          <nav className="ml-auto flex items-center gap-0.5 md:gap-1" aria-label="Atalhos">
            {loja && <div className="hidden xl:block"><LocalChip /></div>}
            {sessao?.papel === "admin" && <Link href="/admin" className={`btn-ghost hidden rounded-xl md:inline-flex ${on("/admin") ? "bg-pine-50 text-pine-700" : ""}`}><IconSettings width={18} height={18} /> Painel</Link>}
            {sessao?.papel === "motorista" && <Link href="/motorista" className={`btn-ghost hidden rounded-xl md:inline-flex ${on("/motorista") ? "bg-pine-50 text-pine-700" : ""}`}><IconTruck width={18} height={18} /> Minha rota</Link>}
            <Link href={sessao ? "/conta" : "/login"} className="hidden items-center gap-2 rounded-xl px-2.5 py-1.5 hover:bg-page md:flex">
              <IconUser width={24} height={24} className="text-pine-700" />
              <span className="hidden leading-tight lg:block">
                <span className="block text-[11px] font-semibold text-ink-3">{sessao ? `Olá, ${nome}` : "Olá! Faça seu"}</span>
                <span className="block text-[13px] font-extrabold">{sessao ? "Minha conta" : "login ou cadastro"}</span>
              </span>
              <span className="text-[13px] font-extrabold lg:hidden">{sessao ? nome : "Entrar"}</span>
            </Link>
            {loja && <FavoritosAtalho />}
            <Link href="/carrinho" data-alvo-carrinho aria-label={`Carrinho, ${quantidade} ${quantidade === 1 ? "item" : "itens"}`}
              className="relative flex h-11 items-center gap-2 rounded-xl px-2.5 hover:bg-page md:bg-pine-700 md:px-4 md:text-white md:hover:bg-pine-800">
              <span className="relative"><IconCart width={24} height={24} />{quantidade > 0 && <Badge n={quantidade} />}</span>
              <span className="hidden text-left leading-tight lg:block">
                <span className="block text-[11px] font-semibold text-white/75">Carrinho</span>
                <span className="block text-[13px] font-extrabold">{brl(montado ? subtotal : 0)}</span>
              </span>
            </Link>
          </nav>
        </div>

        {loja && mostraBusca && (
          <div className="space-y-1.5 px-3 pb-2.5 md:hidden">
            <BuscaCampo />
            <LocalChip linha />
          </div>
        )}

        {loja && (
          <nav aria-label="Departamentos" className="hidden border-t border-line md:block">
            <ul className="no-scrollbar mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-3 lg:px-6">
              <li>
                <Link href="/?ofertas=1" aria-current={ofertas ? "page" : undefined} className={`menu-dep text-oferta ${ofertas ? "is-on" : ""}`}>% Ofertas</Link>
              </li>
              {categorias.map((c) => (
                <li key={c.slug}><Link href={`/?cat=${c.slug}`} aria-current={catAtual === c.slug ? "page" : undefined} className={`menu-dep ${catAtual === c.slug ? "is-on" : ""}`}>{c.nome}</Link></li>
              ))}
              <li><Link href="/conta/assinaturas" className={`menu-dep ${on("/conta/assinaturas") ? "is-on" : ""}`}>Assinatura</Link></li>
              <li><Link href="/como-funciona" className={`menu-dep ${on("/como-funciona") ? "is-on" : ""}`}>Como funciona a entrega</Link></li>
              <li className="ml-auto xl:hidden"><LocalChip /></li>
            </ul>
          </nav>
        )}
      </header>

      {loja && <MenuGaveta aberto={menu} onFechar={() => setMenu(false)} sessao={sessao} categorias={categorias} />}

      <nav className="nav-inferior fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden" aria-label="Navegação">
        <div className="grid h-[64px] grid-cols-4">
          <Tab href="/" label="Início" icon={<IconHome />} on={on("/") && !ofertas} />
          <Tab href="/carrinho" label="Carrinho" icon={<span className="relative"><IconCart />{quantidade > 0 && <Badge n={quantidade} small />}</span>} on={on("/carrinho") || on("/checkout")} />
          {sessao?.papel === "admin" ? (
            <Tab href="/admin" label="Painel" icon={<IconSettings />} on={on("/admin")} />
          ) : sessao?.papel === "motorista" ? (
            <Tab href="/motorista" label="Rota" icon={<IconTruck />} on={on("/motorista")} />
          ) : (
            <Tab href="/conta/favoritos" label="Favoritos" icon={<IconCoracao />} on={on("/conta/favoritos")} />
          )}
          <Tab href={sessao ? "/conta" : "/login"} label={sessao ? "Conta" : "Entrar"} icon={<IconUser />} on={(on("/conta") && !on("/conta/favoritos")) || on("/login")} />
        </div>
      </nav>
    </>
  );
}

/** Faixa de avisos do topo: troca a cada 4s (pausa com mouse/foco; parada se o usuário pede menos movimento). */
function FaixaAvisos({ avisos }: { avisos: string[] }) {
  const [i, setI] = useState(0);
  const [pausa, setPausa] = useState(false);
  useEffect(() => {
    if (avisos.length < 2 || pausa || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((x) => (x + 1) % avisos.length), 4000);
    return () => clearInterval(t);
  }, [avisos.length, pausa]);
  if (!avisos.length) return null;
  return (
    <div className="faixa-avisos bg-pine-800 text-white" onMouseEnter={() => setPausa(true)} onMouseLeave={() => setPausa(false)}>
      <div className="mx-auto flex h-9 max-w-7xl items-center justify-center overflow-hidden px-4 text-center text-[12.5px] font-bold sm:text-[13px]">
        <p key={i} className="animate-[faixa_300ms_cubic-bezier(.16,1,.3,1)] truncate">{avisos[i]}</p>
      </div>
    </div>
  );
}

function FavoritosAtalho() {
  const { total } = useFavoritos();
  return (
    <Link href="/conta/favoritos" aria-label={`Favoritos${total ? `, ${total}` : ""}`} className="relative hidden h-11 w-11 place-items-center rounded-xl text-ink hover:bg-page md:grid">
      <IconCoracao />
      {total > 0 && <span key={total} className="absolute right-0.5 top-0.5 grid h-[18px] min-w-[18px] animate-[pop_200ms_cubic-bezier(.16,1,.3,1)] place-items-center rounded-full bg-oferta px-1 text-[10px] font-extrabold text-white">{total}</span>}
    </Link>
  );
}

/** Menu lateral do celular. */
function MenuGaveta({ aberto, onFechar, sessao, categorias }: { aberto: boolean; onFechar: () => void; sessao: Sessao | null; categorias: CategoriaMenu[] }) {
  const painel = useRef<HTMLDivElement>(null);
  const fechar = useCallback(() => onFechar(), [onFechar]);
  useEffect(() => {
    if (!aberto) return;
    const anterior = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    painel.current?.querySelector<HTMLElement>("button")?.focus();
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") fechar(); };
    document.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("keydown", tecla); document.body.style.overflow = overflow; anterior?.focus?.(); };
  }, [aberto, fechar]);

  const Item = ({ href, children, destaque }: { href: string; children: React.ReactNode; destaque?: boolean }) => (
    <Link href={href} onClick={fechar} tabIndex={aberto ? 0 : -1} className={`flex min-h-[48px] items-center justify-between rounded-xl px-3 text-[15px] font-bold hover:bg-page ${destaque ? "text-oferta" : "text-ink"}`}>
      {children}<IconChevron width={16} height={16} className="text-ink-4" />
    </Link>
  );

  return (
    <div className={`fixed inset-0 z-[65] md:hidden ${aberto ? "" : "pointer-events-none invisible"}`} aria-hidden={!aberto}>
      <div className={`absolute inset-0 bg-ink/50 transition-opacity duration-200 ${aberto ? "opacity-100" : "opacity-0"}`} onClick={fechar} />
      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className={`absolute inset-y-0 left-0 flex w-[86%] max-w-[340px] flex-col bg-white shadow-pop transition-transform duration-200 ${aberto ? "translate-x-0 ease-out" : "-translate-x-full ease-in"}`}
      >
        <div className="bg-pine-700 px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] text-white">
          <div className="flex items-center justify-between">
            <span className="text-[16px] font-extrabold">{sessao ? `Olá, ${sessao.nome.split(" ")[0]}!` : "Olá! Bem-vindo"}</span>
            <button className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10" onClick={fechar} aria-label="Fechar menu" tabIndex={aberto ? 0 : -1}>✕</button>
          </div>
          {!sessao && <Link href="/login" onClick={fechar} tabIndex={aberto ? 0 : -1} className="btn mt-3 w-full bg-kibble-500 text-ink hover:bg-kibble-400">Entrar ou cadastrar</Link>}
        </div>
        <nav className="flex-1 overflow-y-auto p-2" aria-label="Menu principal">
          <p className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-ink-4">Departamentos</p>
          <Item href="/?ofertas=1" destaque>% Ofertas</Item>
          {categorias.map((c) => <Item key={c.slug} href={`/?cat=${c.slug}`}>{c.nome}</Item>)}
          <p className="px-3 pb-1 pt-4 text-[11px] font-bold uppercase tracking-wide text-ink-4">Para você</p>
          {sessao && <Item href="/conta">Meus pedidos</Item>}
          <Item href="/conta/favoritos">Favoritos</Item>
          <Item href="/conta/assinaturas">Assinatura</Item>
          <Item href="/como-funciona">Como funciona a entrega</Item>
          {sessao?.papel === "admin" && <Item href="/admin">Painel da loja</Item>}
          {sessao?.papel === "motorista" && <Item href="/motorista">Minha rota</Item>}
        </nav>
      </div>
    </div>
  );
}

function Tab({ href, label, icon, on }: { href: string; label: string; icon: React.ReactNode; on: boolean }) {
  return (
    <Link href={href} aria-current={on ? "page" : undefined} className={`flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition ${on ? "text-pine-700" : "text-ink-4"}`}>
      <span className={`grid h-8 w-14 place-items-center rounded-full transition ${on ? "bg-pine-100" : ""}`}>{icon}</span>
      {label}
    </Link>
  );
}

function Badge({ n, small }: { n: number; small?: boolean }) {
  return <span key={n} className={`animate-[pop_200ms_cubic-bezier(.16,1,.3,1)] absolute -right-2 -top-2 grid place-items-center rounded-full bg-kibble-500 px-1 font-extrabold text-ink ring-2 ring-white ${small ? "h-4 min-w-4 text-[10px]" : "h-5 min-w-5 text-[11px]"}`}>{n}</span>;
}

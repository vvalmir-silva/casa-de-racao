"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useCarrinho } from "@/lib/carrinho";
import type { Sessao } from "@/lib/auth";
import { IconCart, IconHome, IconPaw, IconSettings, IconTruck, IconUser } from "./Icons";
import { LocalChip } from "./LocalSheet";
import { BuscaCampo } from "./BuscaCampo";

export function Header({ sessao }: { sessao: Sessao | null }) {
  const { quantidade: qtdCarrinho } = useCarrinho();
  // Header hidrata dentro de <Suspense>, depois do carrinho ler o localStorage: só mostra a contagem após montar
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  const quantidade = montado ? qtdCarrinho : 0;
  const path = usePathname();
  const on = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));
  const nome = sessao?.nome.split(" ")[0];
  const loja = !path.startsWith("/admin") && !path.startsWith("/motorista");
  const mostraBusca = path === "/" || path.startsWith("/produto");

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line/70 bg-white/85 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:gap-4 lg:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Casa de Ração, início">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-pine-700 text-kibble-400 shadow-[inset_0_-2px_0_rgba(0,0,0,.15)]"><IconPaw width={22} height={22} /></span>
            <span className="hidden text-[17px] font-extrabold tracking-tight lg:block">Casa de Ração</span>
          </Link>
          {loja && <LocalChip />}
          {loja && <BuscaCampo className="hidden flex-1 md:block" />}
          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {sessao?.papel === "admin" && <Link href="/admin" className={`btn-ghost rounded-full ${on("/admin") ? "bg-pine-50 text-pine-700" : ""}`}><IconSettings width={18} height={18} /> Painel</Link>}
            {sessao?.papel === "motorista" && <Link href="/motorista" className={`btn-ghost rounded-full ${on("/motorista") ? "bg-pine-50 text-pine-700" : ""}`}><IconTruck width={18} height={18} /> Minha rota</Link>}
            <Link href={sessao ? "/conta" : "/login"} className="btn-ghost rounded-full"><IconUser width={18} height={18} /> {sessao ? nome : "Entrar"}</Link>
            <Link href="/carrinho" className="btn-primary relative ml-1 rounded-full px-5">
              <IconCart width={18} height={18} /> Carrinho
              {quantidade > 0 && <Badge n={quantidade} />}
            </Link>
          </nav>
          <Link href="/carrinho" className="relative ml-auto grid h-11 w-11 shrink-0 place-items-center rounded-full bg-page md:hidden" aria-label="Carrinho">
            <IconCart width={20} height={20} />
            {quantidade > 0 && <Badge n={quantidade} />}
          </Link>
        </div>
        {loja && mostraBusca && <div className="px-4 pb-3 md:hidden"><BuscaCampo /></div>}
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden" aria-label="Navegação">
        <div className="grid h-[64px] grid-cols-4">
          <Tab href="/" label="Início" icon={<IconHome />} on={on("/")} />
          <Tab href="/carrinho" label="Carrinho" icon={<span className="relative"><IconCart />{quantidade > 0 && <Badge n={quantidade} small />}</span>} on={on("/carrinho") || on("/checkout")} />
          {sessao?.papel === "admin" ? (
            <Tab href="/admin" label="Painel" icon={<IconSettings />} on={on("/admin")} />
          ) : sessao?.papel === "motorista" ? (
            <Tab href="/motorista" label="Rota" icon={<IconTruck />} on={on("/motorista")} />
          ) : (
            <Tab href="/conta/assinaturas" label="Assinatura" icon={<IconPaw />} on={on("/conta/assinaturas")} />
          )}
          <Tab href={sessao ? "/conta" : "/login"} label={sessao ? "Conta" : "Entrar"} icon={<IconUser />} on={on("/conta") || on("/login")} />
        </div>
      </nav>
    </>
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
  return <span className={`absolute -right-1.5 -top-1.5 grid place-items-center rounded-full bg-kibble-500 px-1 font-extrabold text-ink ring-2 ring-white ${small ? "h-4 min-w-4 text-[10px]" : "h-5 min-w-5 text-[11px]"}`}>{n}</span>;
}

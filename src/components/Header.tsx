"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCarrinho } from "@/lib/carrinho";
import type { Sessao } from "@/lib/auth";
import { IconCart, IconHome, IconPaw, IconSettings, IconTruck, IconUser } from "./Icons";

export function Header({ sessao }: { sessao: Sessao | null }) {
  const { quantidade } = useCarrinho();
  const path = usePathname();
  const ativo = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));
  const nome = sessao?.nome.split(" ")[0];

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:px-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-brand-700">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white"><IconPaw width={20} height={20} /></span>
            <span className="text-base">Casa de Ração</span>
          </Link>
          <nav className="ml-auto hidden items-center gap-1 text-sm md:flex">
            {sessao?.papel === "admin" && <Link href="/admin" className={`btn-ghost ${ativo("/admin") ? "bg-stone-100" : ""}`}>Admin</Link>}
            {sessao?.papel === "motorista" && <Link href="/motorista" className={`btn-ghost ${ativo("/motorista") ? "bg-stone-100" : ""}`}>Minha rota</Link>}
            <Link href={sessao ? "/conta" : "/login"} className="btn-ghost">{sessao ? nome : "Entrar"}</Link>
            <Link href="/carrinho" className="btn-primary relative">
              <IconCart width={18} height={18} /> Carrinho
              {quantidade > 0 && <Badge n={quantidade} />}
            </Link>
          </nav>
          <Link href="/carrinho" className="relative ml-auto grid h-11 w-11 place-items-center rounded-xl text-stone-700 active:bg-stone-100 md:hidden" aria-label="Carrinho">
            <IconCart />
            {quantidade > 0 && <Badge n={quantidade} />}
          </Link>
        </div>
      </header>

      {/* Navegação inferior (celular) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="grid h-16 grid-cols-4">
          <Tab href="/" label="Início" icon={<IconHome />} on={ativo("/")} />
          <Tab href="/carrinho" label="Carrinho" icon={<span className="relative"><IconCart />{quantidade > 0 && <Badge n={quantidade} small />}</span>} on={ativo("/carrinho") || ativo("/checkout")} />
          {sessao?.papel === "admin" ? (
            <Tab href="/admin" label="Admin" icon={<IconSettings />} on={ativo("/admin")} />
          ) : sessao?.papel === "motorista" ? (
            <Tab href="/motorista" label="Rota" icon={<IconTruck />} on={ativo("/motorista")} />
          ) : (
            <Tab href="/conta/assinaturas" label="Assinar" icon={<IconPaw />} on={ativo("/conta/assinaturas")} />
          )}
          <Tab href={sessao ? "/conta" : "/login"} label={sessao ? "Conta" : "Entrar"} icon={<IconUser />} on={ativo("/conta") || ativo("/login")} />
        </div>
      </nav>
    </>
  );
}

function Tab({ href, label, icon, on }: { href: string; label: string; icon: React.ReactNode; on: boolean }) {
  return (
    <Link href={href} className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${on ? "text-brand-700" : "text-stone-500"}`}>
      {icon}
      {label}
    </Link>
  );
}

function Badge({ n, small }: { n: number; small?: boolean }) {
  return (
    <span className={`absolute -right-2 -top-2 grid place-items-center rounded-full bg-brand-600 px-1 text-white ${small ? "h-4 min-w-4 text-[10px]" : "h-5 min-w-5 text-[11px]"}`}>
      {n}
    </span>
  );
}

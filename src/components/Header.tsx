"use client";

import Link from "next/link";
import { useCarrinho } from "@/lib/carrinho";
import type { Sessao } from "@/lib/auth";

export function Header({ sessao }: { sessao: Sessao | null }) {
  const { quantidade } = useCarrinho();
  return (
    <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold text-brand-700">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">🐾</span>
          <span className="hidden sm:inline">Casa de Ração</span>
        </Link>
        <nav className="ml-auto flex items-center gap-1 text-sm">
          {sessao?.papel === "admin" && (
            <Link href="/admin" className="btn-ghost">Admin</Link>
          )}
          {sessao?.papel === "motorista" && (
            <Link href="/motorista" className="btn-ghost">Rota</Link>
          )}
          {sessao ? (
            <Link href="/conta" className="btn-ghost">{sessao.nome.split(" ")[0]}</Link>
          ) : (
            <Link href="/login" className="btn-ghost">Entrar</Link>
          )}
          <Link href="/carrinho" className="btn-primary relative">
            Carrinho
            {quantidade > 0 && (
              <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-stone-900 px-1 text-[11px]">
                {quantidade}
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}

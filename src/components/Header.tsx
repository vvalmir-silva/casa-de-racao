"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCarrinho } from "@/lib/carrinho";
import type { Sessao } from "@/lib/auth";
import { IconCart, IconHome, IconPaw, IconSearch, IconSettings, IconTruck, IconUser } from "./Icons";

export function Header({ sessao }: { sessao: Sessao | null }) {
  const { quantidade } = useCarrinho();
  const path = usePathname();
  const router = useRouter();
  const on = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));
  const nome = sessao?.nome.split(" ")[0];
  const emAdmin = path.startsWith("/admin");

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-pine-700 text-kibble-400"><IconPaw width={22} height={22} /></span>
            <span className="leading-none">
              <span className="block text-[17px] font-extrabold tracking-tight text-ink">Casa de Ração</span>
              <span className="block text-[11px] font-semibold text-ink-3">entrega no seu bairro</span>
            </span>
          </Link>

          {!emAdmin && (
            <form
              className="relative ml-6 hidden flex-1 md:block"
              onSubmit={(e) => { e.preventDefault(); const q = new FormData(e.currentTarget).get("q"); router.push(q ? `/?q=${encodeURIComponent(String(q))}` : "/"); }}
            >
              <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-4" width={18} height={18} />
              <input name="q" placeholder="Buscar ração, marca, petisco…" className="input bg-page pl-10" />
            </form>
          )}

          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {sessao?.papel === "admin" && <Link href="/admin" className={`btn-ghost ${on("/admin") ? "bg-pine-50 text-pine-700" : ""}`}><IconSettings width={18} height={18} /> Admin</Link>}
            {sessao?.papel === "motorista" && <Link href="/motorista" className={`btn-ghost ${on("/motorista") ? "bg-pine-50 text-pine-700" : ""}`}><IconTruck width={18} height={18} /> Minha rota</Link>}
            <Link href={sessao ? "/conta" : "/login"} className="btn-ghost"><IconUser width={18} height={18} /> {sessao ? nome : "Entrar"}</Link>
            <Link href="/carrinho" className="btn-primary relative ml-1">
              <IconCart width={18} height={18} /> Carrinho
              {quantidade > 0 && <Badge n={quantidade} />}
            </Link>
          </nav>

          <Link href="/carrinho" className="relative ml-auto grid h-11 w-11 place-items-center rounded-xl text-ink hover:bg-page md:hidden" aria-label="Carrinho">
            <IconCart />
            {quantidade > 0 && <Badge n={quantidade} />}
          </Link>
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="grid h-[64px] grid-cols-4">
          <Tab href="/" label="Início" icon={<IconHome />} on={on("/")} />
          <Tab href="/carrinho" label="Carrinho" icon={<span className="relative"><IconCart />{quantidade > 0 && <Badge n={quantidade} small />}</span>} on={on("/carrinho") || on("/checkout")} />
          {sessao?.papel === "admin" ? (
            <Tab href="/admin" label="Admin" icon={<IconSettings />} on={on("/admin")} />
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
    <Link href={href} className={`flex flex-col items-center justify-center gap-1 text-[11px] font-bold ${on ? "text-pine-700" : "text-ink-4"}`}>
      <span className={`grid h-7 w-12 place-items-center rounded-full ${on ? "bg-pine-50" : ""}`}>{icon}</span>
      {label}
    </Link>
  );
}

function Badge({ n, small }: { n: number; small?: boolean }) {
  return (
    <span className={`absolute -right-2 -top-2 grid place-items-center rounded-full bg-kibble-500 px-1 font-extrabold text-ink ${small ? "h-4 min-w-4 text-[10px]" : "h-5 min-w-5 text-[11px]"}`}>{n}</span>
  );
}

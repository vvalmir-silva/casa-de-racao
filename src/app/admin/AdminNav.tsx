"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const itens: [string, string, string][] = [
  ["/admin", "Resumo", "▦"],
  ["/admin/pedidos", "Pedidos", "🧾"],
  ["/admin/rotas", "Rotas", "🚗"],
  ["/admin/produtos", "Produtos", "📦"],
  ["/admin/relatorios", "Relatórios", "📈"],
  ["/admin/entregas", "Zonas e janelas", "📍"],
  ["/admin/cupons", "Cupons", "🎟️"],
  ["/admin/avaliacoes", "Avaliações", "⭐"],
  ["/admin/usuarios", "Usuários", "👥"],
  ["/admin/notificacoes", "Notificações", "💬"],
  ["/admin/config", "Configurações", "⚙️"],
];

export function AdminNav() {
  const path = usePathname();
  const on = (h: string) => (h === "/admin" ? path === "/admin" : path.startsWith(h));
  return (
    <nav className="no-scrollbar sticky top-16 z-20 -mx-4 flex gap-1.5 overflow-x-auto border-b border-line bg-page px-4 py-2 md:static md:mx-0 md:block md:min-h-[calc(100vh-4rem)] md:border-b-0 md:border-r md:bg-white md:px-3 md:py-5">
      <div className="mb-3 hidden px-3 text-[11px] font-bold tracking-wide text-ink-4 md:block">PAINEL DA LOJA</div>
      {itens.map(([href, label, ico]) => (
        <Link
          key={href}
          href={href}
          className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition md:w-full md:py-2.5 ${on(href) ? "bg-pine-700 text-white" : "bg-white text-ink-2 hover:bg-pine-50 hover:text-pine-700 md:bg-transparent"}`}
        >
          <span className="text-base leading-none">{ico}</span>{label}
        </Link>
      ))}
    </nav>
  );
}

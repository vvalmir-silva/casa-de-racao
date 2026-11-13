import Link from "next/link";
import { exigirSessao } from "@/lib/auth";

const itens = [
  ["/admin", "Resumo"],
  ["/admin/pedidos", "Pedidos"],
  ["/admin/relatorios", "Relatórios"],
  ["/admin/rotas", "Rotas"],
  ["/admin/produtos", "Produtos"],
  ["/admin/entregas", "Zonas e janelas"],
  ["/admin/cupons", "Cupons"],
  ["/admin/usuarios", "Usuários"],
  ["/admin/notificacoes", "Notificações"],
  ["/admin/config", "Configurações"],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await exigirSessao(["admin"]);
  return (
    <div className="grid gap-4 md:grid-cols-[200px_1fr]">
      <nav className="no-scrollbar sticky top-14 z-20 -mx-3 flex gap-1 overflow-x-auto border-b border-stone-200 bg-stone-50 px-3 py-2 md:static md:mx-0 md:flex-col md:border-0 md:bg-transparent md:p-0">
        {itens.map(([href, label]) => (
          <Link key={href} href={href} className="btn-ghost shrink-0 justify-start whitespace-nowrap px-3 text-xs md:text-sm">{label}</Link>
        ))}
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

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
      <nav className="flex gap-1 overflow-x-auto md:flex-col">
        {itens.map(([href, label]) => (
          <Link key={href} href={href} className="btn-ghost justify-start whitespace-nowrap">{label}</Link>
        ))}
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

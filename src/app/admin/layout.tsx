import Link from "next/link";
import { exigirSessao } from "@/lib/auth";
import { sql } from "@/lib/db";
import { AdminNav } from "./AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await exigirSessao(["admin"]);
  const fracas = (await sql`SELECT nome FROM usuarios WHERE senha_padrao AND ativo ORDER BY papel, nome`.catch(() => [])) as { nome: string }[];
  return (
    <div className="admin-grid md:-mx-4 md:grid md:grid-cols-[220px_1fr] md:gap-0">
      <AdminNav />
      <div className="min-w-0 md:px-8 md:py-2">
        {fracas.length > 0 && (
          <div role="alert" data-print-esconde className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <span><b>Senha inicial em uso:</b> {fracas.map((f) => f.nome).join(", ")}. Qualquer pessoa que leia o README consegue entrar.</span>
            <Link href="/admin/usuarios" className="font-bold underline">Trocar agora</Link>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

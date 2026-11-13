import { sql } from "@/lib/db";
import { mascaraTelefone, dataBR } from "@/lib/utils";
import { FormAction } from "@/components/FormAction";
import { salvarUsuario } from "../actions";

export const dynamic = "force-dynamic";

type U = { id: string; nome: string; telefone: string; papel: string; ativo: boolean; criado_em: string; pedidos: string };

export default async function UsuariosAdmin({ searchParams }: { searchParams: Promise<{ q?: string; papel?: string }> }) {
  const { q, papel } = await searchParams;
  const busca = q ? `%${q}%` : null;
  const usuarios = (await sql`
    SELECT u.id, u.nome, u.telefone, u.papel, u.ativo, u.criado_em, (SELECT count(*) FROM pedidos p WHERE p.cliente_id = u.id) AS pedidos
    FROM usuarios u
    WHERE (${busca}::text IS NULL OR u.nome ILIKE ${busca} OR u.telefone ILIKE ${busca})
      AND (${papel ?? null}::text IS NULL OR u.papel = ${papel ?? null})
    ORDER BY u.papel <> 'admin', u.papel <> 'motorista', u.criado_em DESC LIMIT 300
  `) as U[];
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Usuários</h1>
      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={q} className="input w-48" placeholder="nome ou telefone" />
        <select name="papel" defaultValue={papel ?? ""} className="input w-36"><option value="">Todos</option><option value="cliente">Clientes</option><option value="motorista">Motoristas</option><option value="admin">Admins</option></select>
        <button className="btn-outline">Filtrar</button>
      </form>
      <FormAction action={salvarUsuario} className="card grid grid-cols-2 gap-2 sm:grid-cols-5">
        <h2 className="col-span-full font-semibold">Novo usuário (motorista/admin)</h2>
        <input name="nome" className="input" placeholder="Nome" required />
        <input name="telefone" className="input" placeholder="Telefone" required />
        <input name="senha" type="password" className="input" placeholder="Senha" required />
        <select name="papel" className="input" defaultValue="motorista"><option value="motorista">Motorista</option><option value="admin">Admin</option><option value="cliente">Cliente</option></select>
        <button className="btn-primary">Criar</button>
      </FormAction>
      <div className="overflow-x-auto">
        <table className="table">
          <thead><tr><th>Nome</th><th>Telefone</th><th>Papel</th><th>Pedidos</th><th>Desde</th><th>Nova senha / status</th></tr></thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className={u.ativo ? "" : "opacity-50"}>
                <td>{u.nome}</td><td>{mascaraTelefone(u.telefone)}</td>
                <td>
                  <FormAction action={salvarUsuario} className="flex gap-1">
                    <input type="hidden" name="id" value={u.id} /><input type="hidden" name="nome" value={u.nome} /><input type="hidden" name="telefone" value={u.telefone} />
                    <select name="papel" defaultValue={u.papel} className="input py-1"><option value="cliente">cliente</option><option value="motorista">motorista</option><option value="admin">admin</option></select>
                    <button className="btn-outline py-1">ok</button>
                  </FormAction>
                </td>
                <td>{u.pedidos}</td><td>{dataBR(u.criado_em.slice(0, 10))}</td>
                <td>
                  <FormAction action={salvarUsuario} className="flex gap-1">
                    <input type="hidden" name="id" value={u.id} /><input type="hidden" name="nome" value={u.nome} /><input type="hidden" name="telefone" value={u.telefone} /><input type="hidden" name="papel" value={u.papel} />
                    <input name="senha" type="password" className="input w-28 py-1" placeholder="nova senha" />
                    <select name="ativo" defaultValue={u.ativo ? "on" : "off"} className="input w-24 py-1"><option value="on">ativo</option><option value="off">inativo</option></select>
                    <button className="btn-outline py-1">ok</button>
                  </FormAction>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

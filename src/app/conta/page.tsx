import Link from "next/link";
import { exigirSessao } from "@/lib/auth";
import { sql } from "@/lib/db";
import { brl, dataBR, STATUS_PEDIDO, TIPO_ENTREGA, mascaraCep } from "@/lib/utils";
import { logoutAction } from "../login/actions";
import { EnderecoForm, ExcluirEnderecoBotao } from "./ContaClient";

export const dynamic = "force-dynamic";

export default async function ContaPage() {
  const s = await exigirSessao();
  const pedidos = (await sql`
    SELECT id, numero, status, tipo_entrega, data_entrega, total_centavos, criado_em
    FROM pedidos WHERE cliente_id = ${s.id} ORDER BY criado_em DESC LIMIT 50
  `) as { id: string; numero: number; status: string; tipo_entrega: string; data_entrega: string | null; total_centavos: number; criado_em: string }[];
  const enderecos = (await sql`
    SELECT id, apelido, cep, logradouro, numero, complemento, bairro FROM enderecos WHERE usuario_id = ${s.id} ORDER BY padrao DESC, criado_em
  `) as { id: string; apelido: string; cep: string; logradouro: string; numero: string; complemento: string | null; bairro: string }[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Olá, {s.nome.split(" ")[0]}</h1>
        <div className="flex gap-2">
          <Link href="/conta/assinaturas" className="btn-outline">Assinaturas</Link>
          <form action={logoutAction}><button className="btn-ghost">Sair</button></form>
        </div>
      </div>

      <section>
        <h2 className="mb-2 font-semibold">Meus pedidos</h2>
        {pedidos.length === 0 ? (
          <p className="text-sm text-stone-500">Você ainda não fez pedidos.</p>
        ) : (
          <div className="space-y-2">
            {pedidos.map((p) => (
              <Link key={p.id} href={`/conta/pedido/${p.id}`} className="card flex items-center justify-between gap-3 hover:bg-stone-50">
                <div>
                  <div className="font-medium">Pedido #{p.numero}</div>
                  <div className="text-xs text-stone-500">{TIPO_ENTREGA[p.tipo_entrega]} · {dataBR(p.data_entrega)}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{brl(p.total_centavos)}</div>
                  <span className={`badge ${STATUS_PEDIDO[p.status].cor}`}>{STATUS_PEDIDO[p.status].label}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Endereços</h2>
        <div className="space-y-2">
          {enderecos.map((e) => (
            <div key={e.id} className="card flex items-center justify-between text-sm">
              <div><b>{e.apelido}</b> · {e.logradouro}, {e.numero}{e.complemento ? ` - ${e.complemento}` : ""} · {e.bairro} · {mascaraCep(e.cep)}</div>
              <ExcluirEnderecoBotao id={e.id} />
            </div>
          ))}
        </div>
        <EnderecoForm />
      </section>
    </div>
  );
}

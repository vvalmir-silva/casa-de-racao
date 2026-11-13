import Link from "next/link";
import { sql } from "@/lib/db";
import { brl, dataBR, dataHoraBR, STATUS_PEDIDO, TIPO_ENTREGA, FORMA_PAGAMENTO, mascaraCep } from "@/lib/utils";
import { StatusBotoes } from "./PedidosClient";

export const dynamic = "force-dynamic";

type P = {
  id: string; numero: number; status: string; tipo_entrega: string; data_entrega: string | null; total_centavos: number; forma_pagamento: string;
  troco_para_centavos: number | null; observacoes: string | null; criado_em: string; cliente: string; telefone: string; endereco: Record<string, string> | null; itens: string; rota_id: string | null;
};

const filtros = [["", "Todos"], ["aguardando_pagamento", "Aguardando PIX"], ["pago", "Pagos"], ["separado", "Separados"], ["em_rota", "Em rota"], ["entregue", "Entregues"], ["cancelado", "Cancelados"]];

export default async function PedidosAdmin({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { status, q } = await searchParams;
  const busca = q ? `%${q}%` : null;
  const pedidos = (await sql`
    SELECT p.id, p.numero, p.status, p.tipo_entrega, p.data_entrega, p.total_centavos, p.forma_pagamento, p.troco_para_centavos, p.observacoes, p.criado_em, p.endereco, p.rota_id,
           u.nome AS cliente, u.telefone,
           (SELECT string_agg(i.qtd || '× ' || i.nome, ', ') FROM pedido_itens i WHERE i.pedido_id = p.id) AS itens
    FROM pedidos p JOIN usuarios u ON u.id = p.cliente_id
    WHERE (${status ?? null}::text IS NULL OR p.status = ${status ?? null})
      AND (${busca}::text IS NULL OR u.nome ILIKE ${busca} OR u.telefone ILIKE ${busca} OR p.numero::text = ${q ?? ""})
    ORDER BY p.criado_em DESC LIMIT 200
  `) as P[];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Pedidos</h1>
      <div className="flex flex-wrap items-center gap-2">
        {filtros.map(([v, l]) => (
          <Link key={v} href={v ? `/admin/pedidos?status=${v}` : "/admin/pedidos"} className={`badge px-3 py-1.5 ${(status ?? "") === v ? "bg-brand-600 text-white" : "border bg-white"}`}>{l}</Link>
        ))}
        <form className="ml-auto flex gap-1"><input name="q" defaultValue={q} className="input w-44 py-1.5" placeholder="nome, telefone, nº" /><button className="btn-outline py-1.5">Buscar</button></form>
      </div>
      <div className="space-y-2">
        {pedidos.map((p) => {
          const st = STATUS_PEDIDO[p.status];
          const wa = `https://wa.me/55${p.telefone}?text=${encodeURIComponent(`Olá ${p.cliente.split(" ")[0]}, sobre seu pedido #${p.numero} na Casa de Ração: `)}`;
          return (
            <div key={p.id} className="card space-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <b>#{p.numero}</b>
                <span className={`badge ${st.cor}`}>{st.label}</span>
                <span className="text-stone-500">{dataHoraBR(p.criado_em)}</span>
                <span className="ml-auto font-semibold">{brl(p.total_centavos)}</span>
              </div>
              <div>{p.cliente} · <a className="text-green-700 underline" href={wa} target="_blank">{p.telefone}</a></div>
              <div className="text-stone-600">{p.itens}</div>
              <div className="text-stone-600">
                {TIPO_ENTREGA[p.tipo_entrega]} · {dataBR(p.data_entrega)} · {FORMA_PAGAMENTO[p.forma_pagamento]}{p.troco_para_centavos ? ` (troco p/ ${brl(p.troco_para_centavos)})` : ""}
                {p.endereco && <> · {p.endereco.logradouro}, {p.endereco.numero}{p.endereco.complemento ? ` - ${p.endereco.complemento}` : ""} · {p.endereco.bairro} · {mascaraCep(p.endereco.cep)}</>}
                {p.rota_id && <> · <span className="badge bg-purple-100 text-purple-800">em rota</span></>}
              </div>
              {p.observacoes && <div className="text-stone-600">Obs.: {p.observacoes}</div>}
              <StatusBotoes id={p.id} status={p.status} />
            </div>
          );
        })}
        {pedidos.length === 0 && <p className="text-stone-500">Nenhum pedido.</p>}
      </div>
    </div>
  );
}

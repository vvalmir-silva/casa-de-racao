import Link from "next/link";
import { sql } from "@/lib/db";
import { brl, dataBR, dataHoraBR, rotuloStatus, TIPO_ENTREGA, FORMA_PAGAMENTO, mascaraCep } from "@/lib/utils";
import { StatusBotoes } from "./PedidosClient";

export const dynamic = "force-dynamic";

type P = {
  id: string; numero: number; status: string; tipo_entrega: string; data_entrega: string | null; total_centavos: number; forma_pagamento: string;
  troco_para_centavos: number | null; observacoes: string | null; criado_em: string; cliente: string; telefone: string; endereco: Record<string, string> | null; itens: string; rota_id: string | null; comprovante_url: string | null; recebido_por: string | null; cancelado_motivo: string | null; faltas: number;
};

const MOTIVO_CANCELAMENTO: Record<string, string> = {
  cliente: "pelo cliente", loja: "pela loja", pix_expirado: "PIX não pago no prazo", nao_retirado: "cliente não retirou", nao_recebido: "cliente não recebeu",
};

const filtros = [["", "Todos"], ["aguardando_pagamento", "Aguardando PIX"], ["pago", "Pagos"], ["separado", "Separados"], ["em_rota", "Em rota"], ["entregue", "Entregues"], ["cancelado", "Cancelados"]];

export default async function PedidosAdmin({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { status, q } = await searchParams;
  const busca = q ? `%${q}%` : null;
  const pedidos = (await sql`
    SELECT p.id, p.numero, p.status, p.tipo_entrega, p.data_entrega, p.total_centavos, p.forma_pagamento, p.troco_para_centavos, p.observacoes, p.criado_em, p.endereco, p.rota_id, p.comprovante_url, p.recebido_por, p.cancelado_motivo,
           u.nome AS cliente, u.telefone,
           (SELECT count(*)::int FROM pedidos f WHERE f.cliente_id = p.cliente_id AND f.status = 'cancelado' AND f.cancelado_motivo IN ('nao_retirado','nao_recebido')) AS faltas,
           (SELECT string_agg(i.qtd || '× ' || i.nome, ', ') FROM pedido_itens i WHERE i.pedido_id = p.id) AS itens
    FROM pedidos p JOIN usuarios u ON u.id = p.cliente_id
    WHERE (${status ?? null}::text IS NULL OR p.status = ${status ?? null})
      AND (${busca}::text IS NULL OR u.nome ILIKE ${busca} OR u.telefone ILIKE ${busca} OR p.numero::text = ${q ?? ""})
    ORDER BY p.criado_em DESC LIMIT 200
  `) as P[];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="h1">Pedidos</h1>
        <a href="/admin/etiquetas" className="btn-outline">🏷️ Etiquetas de hoje</a>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {filtros.map(([v, l]) => (
          <Link key={v} href={v ? `/admin/pedidos?status=${v}` : "/admin/pedidos"} className={`chip ${(status ?? "") === v ? "chip-on" : "chip"}`}>{l}</Link>
        ))}
        <form className="ml-auto flex gap-1"><input name="q" defaultValue={q} className="input w-44 py-1.5" placeholder="nome, telefone, nº" /><button className="btn-outline py-1.5">Buscar</button></form>
      </div>
      <div className="space-y-2">
        {pedidos.map((p) => {
          const st = rotuloStatus(p.status, p.forma_pagamento);
          const wa = `https://wa.me/55${p.telefone}?text=${encodeURIComponent(`Olá ${p.cliente.split(" ")[0]}, sobre seu pedido #${p.numero} na Casa de Ração: `)}`;
          return (
            <div key={p.id} className="card space-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <b>#{p.numero}</b>
                <span className={`badge ${st.cor}`}>{st.label}</span>
                <span className="text-ink-3">{dataHoraBR(p.criado_em)}</span>
                <span className="ml-auto font-semibold">{brl(p.total_centavos)}</span>
                {p.status !== "cancelado" && <a href={`/admin/etiquetas?pedido=${p.id}`} className="text-xs font-bold text-pine-700 underline">etiqueta</a>}
              </div>
              <div>{p.cliente} · <a className="font-semibold text-pine-700 underline" href={wa} target="_blank">{p.telefone}</a>
                {p.faltas > 0 && <span className="badge ml-2 bg-red-100 text-red-800" title="Pedidos não retirados ou não recebidos">⚠ {p.faltas} {p.faltas === 1 ? "falta" : "faltas"}</span>}
              </div>
              {p.status === "cancelado" && p.cancelado_motivo && <div className="text-xs font-semibold text-ink-3">Cancelado: {MOTIVO_CANCELAMENTO[p.cancelado_motivo] ?? p.cancelado_motivo}</div>}
              <div className="text-ink-2">{p.itens}</div>
              <div className="text-ink-2">
                {TIPO_ENTREGA[p.tipo_entrega]} · {dataBR(p.data_entrega)} · {FORMA_PAGAMENTO[p.forma_pagamento]}{p.troco_para_centavos ? ` (troco p/ ${brl(p.troco_para_centavos)})` : ""}
                {p.endereco && <> · {p.endereco.logradouro}, {p.endereco.numero}{p.endereco.complemento ? ` - ${p.endereco.complemento}` : ""} · {p.endereco.bairro} · {mascaraCep(p.endereco.cep)}</>}
                {p.rota_id && <> · <span className="badge bg-violet-100 text-violet-900">rota montada</span></>}
              </div>
              {p.observacoes && <div className="text-ink-2">Obs.: {p.observacoes}</div>}
              {(p.comprovante_url || p.recebido_por) && (
                <div className="flex items-center gap-3 rounded-xl bg-pine-50 p-2 text-sm text-pine-800">
                  {p.comprovante_url && (
                    <a href={p.comprovante_url} target="_blank" className="h-14 w-14 shrink-0 overflow-hidden rounded-lg">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.comprovante_url} alt="Foto da entrega" className="h-full w-full object-cover" />
                    </a>
                  )}
                  <span>Entrega comprovada{p.recebido_por ? ` · recebido por ${p.recebido_por}` : ""}</span>
                </div>
              )}
              <StatusBotoes id={p.id} status={p.status} tipo={p.tipo_entrega} />
            </div>
          );
        })}
        {pedidos.length === 0 && <p className="text-ink-3">Nenhum pedido.</p>}
      </div>
    </div>
  );
}

import { notFound } from "next/navigation";
import { exigirSessao } from "@/lib/auth";
import { sql, getConfig } from "@/lib/db";
import { brl, dataBR, STATUS_PEDIDO, TIPO_ENTREGA, FORMA_PAGAMENTO, mascaraCep } from "@/lib/utils";
import { CancelarPedidoBotao } from "../../ContaClient";
import { hm } from "@/lib/frete";

export const dynamic = "force-dynamic";

type Pedido = {
  id: string; numero: number; status: string; tipo_entrega: string; data_entrega: string | null; endereco: Record<string, string> | null;
  subtotal_centavos: number; frete_centavos: number; total_centavos: number; forma_pagamento: string; troco_para_centavos: number | null;
  observacoes: string | null; inicio: string | null; fim: string | null; criado_em: string;
};

export default async function PedidoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ novo?: string }> }) {
  const s = await exigirSessao();
  const { id } = await params;
  const { novo } = await searchParams;
  const rows = (await sql`
    SELECT p.*, j.inicio::text, j.fim::text FROM pedidos p LEFT JOIN janelas j ON j.id = p.janela_id
    WHERE p.id = ${id} AND (p.cliente_id = ${s.id} OR ${s.papel === "admin"})
  `) as Pedido[];
  const p = rows[0];
  if (!p) notFound();
  const itens = (await sql`SELECT nome, qtd, preco_centavos FROM pedido_itens WHERE pedido_id = ${id}`) as { nome: string; qtd: number; preco_centavos: number }[];
  const cfg = await getConfig();
  const st = STATUS_PEDIDO[p.status];
  const wa = cfg.loja_whatsapp ? `https://wa.me/${cfg.loja_whatsapp}?text=${encodeURIComponent(`Olá! Segue o comprovante do PIX do pedido #${p.numero}.`)}` : null;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      {novo && <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">Pedido recebido! Obrigado 🐾</div>}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Pedido #{p.numero}</h1>
        <span className={`badge ${st.cor}`}>{st.label}</span>
      </div>

      {p.status === "aguardando_pagamento" && p.forma_pagamento === "pix" && (
        <div className="card space-y-2 border-brand-200 bg-brand-50">
          <div className="font-semibold">Pague via PIX para confirmar</div>
          <div className="text-sm">Chave: <b className="select-all">{cfg.pix_chave}</b></div>
          <div className="text-sm">Valor: <b>{brl(p.total_centavos)}</b></div>
          {wa && <a href={wa} target="_blank" className="btn-primary w-full">Enviar comprovante no WhatsApp</a>}
        </div>
      )}

      <div className="card space-y-1 text-sm">
        <div><b>{TIPO_ENTREGA[p.tipo_entrega]}</b>{p.data_entrega && <> · {dataBR(p.data_entrega)}{p.inicio ? `, ${hm(p.inicio)}–${hm(p.fim!)}` : ""}</>}</div>
        {p.endereco ? (
          <div className="text-stone-600">{p.endereco.logradouro}, {p.endereco.numero}{p.endereco.complemento ? ` - ${p.endereco.complemento}` : ""} · {p.endereco.bairro} · {mascaraCep(p.endereco.cep)}</div>
        ) : (
          <div className="text-stone-600">{cfg.loja_endereco}</div>
        )}
        <div className="text-stone-600">{FORMA_PAGAMENTO[p.forma_pagamento]}{p.troco_para_centavos ? ` · troco para ${brl(p.troco_para_centavos)}` : ""}</div>
        {p.observacoes && <div className="text-stone-600">Obs.: {p.observacoes}</div>}
      </div>

      <div className="card text-sm">
        {itens.map((i, k) => (
          <div key={k} className="flex justify-between py-1"><span>{i.qtd}× {i.nome}</span><span>{brl(i.qtd * i.preco_centavos)}</span></div>
        ))}
        <div className="mt-2 border-t pt-2">
          <div className="flex justify-between"><span>Subtotal</span><span>{brl(p.subtotal_centavos)}</span></div>
          <div className="flex justify-between"><span>Frete</span><span>{p.frete_centavos ? brl(p.frete_centavos) : "Grátis"}</span></div>
          <div className="flex justify-between text-lg font-bold"><span>Total</span><span>{brl(p.total_centavos)}</span></div>
        </div>
      </div>

      {["aguardando_pagamento", "pago"].includes(p.status) && <CancelarPedidoBotao id={p.id} />}
    </div>
  );
}

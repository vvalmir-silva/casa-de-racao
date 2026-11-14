import { notFound } from "next/navigation";
import { exigirSessao } from "@/lib/auth";
import { sql, getConfig } from "@/lib/db";
import { brl, dataBR, STATUS_PEDIDO, TIPO_ENTREGA, FORMA_PAGAMENTO, mascaraCep } from "@/lib/utils";
import { CancelarPedidoBotao } from "../../ContaClient";
import { hm } from "@/lib/frete";
import { PixBox } from "@/components/PixBox";

export const dynamic = "force-dynamic";

type Pedido = {
  id: string; numero: number; status: string; tipo_entrega: string; data_entrega: string | null; endereco: Record<string, string> | null;
  subtotal_centavos: number; frete_centavos: number; total_centavos: number; forma_pagamento: string; troco_para_centavos: number | null;
  observacoes: string | null; comprovante_url: string | null; recebido_por: string | null; entregue_em: string | null; cupom_codigo: string | null; desconto_centavos: number; inicio: string | null; fim: string | null; criado_em: string;
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
      {novo && <div className="rounded-2xl bg-pine-700 p-4 text-white"><div className="text-lg font-extrabold">Pedido recebido 🐾</div><div className="text-sm text-pine-100">Obrigado! Acompanhe o status por aqui e pelo WhatsApp.</div></div>}
      <div className="flex items-center justify-between">
        <h1 className="h1">Pedido #{p.numero}</h1>
        <span className={`badge ${st.cor}`}>{st.label}</span>
      </div>

      {p.status === "aguardando_pagamento" && p.forma_pagamento === "pix" && (
        <PixBox pedidoId={p.id} total={p.total_centavos} chaveManual={cfg.pix_chave ?? ""} whatsappLink={wa} />
      )}

      {p.status === "entregue" && (p.comprovante_url || p.recebido_por) && (
        <div className="card space-y-2">
          <div className="h2">Comprovante de entrega</div>
          {p.recebido_por && <p className="text-sm text-ink-2">Recebido por <b>{p.recebido_por}</b></p>}
          {p.comprovante_url && (
            <a href={p.comprovante_url} target="_blank">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.comprovante_url} alt="Foto da entrega" className="max-h-72 w-full rounded-xl object-cover" />
            </a>
          )}
        </div>
      )}

      <div className="card space-y-1 text-sm">
        <div><b>{TIPO_ENTREGA[p.tipo_entrega]}</b>{p.data_entrega && <> · {dataBR(p.data_entrega)}{p.inicio ? `, ${hm(p.inicio)}–${hm(p.fim!)}` : ""}</>}</div>
        {p.endereco ? (
          <div className="text-ink-2">{p.endereco.logradouro}, {p.endereco.numero}{p.endereco.complemento ? ` - ${p.endereco.complemento}` : ""} · {p.endereco.bairro} · {mascaraCep(p.endereco.cep)}</div>
        ) : (
          <div className="text-ink-2">{cfg.loja_endereco}</div>
        )}
        <div className="text-ink-2">{FORMA_PAGAMENTO[p.forma_pagamento]}{p.troco_para_centavos ? ` · troco para ${brl(p.troco_para_centavos)}` : ""}</div>
        {p.observacoes && <div className="text-ink-2">Obs.: {p.observacoes}</div>}
      </div>

      <div className="card text-sm">
        {itens.map((i, k) => (
          <div key={k} className="flex justify-between py-1"><span>{i.qtd}× {i.nome}</span><span>{brl(i.qtd * i.preco_centavos)}</span></div>
        ))}
        <div className="mt-2 border-t pt-2">
          <div className="flex justify-between"><span>Subtotal</span><span>{brl(p.subtotal_centavos)}</span></div>
          <div className="flex justify-between"><span>Frete</span><span>{p.frete_centavos ? brl(p.frete_centavos) : "Grátis"}</span></div>
          {p.desconto_centavos > 0 && <div className="flex justify-between text-green-700"><span>Cupom {p.cupom_codigo}</span><span>−{brl(p.desconto_centavos)}</span></div>}
          <div className="flex justify-between text-lg font-extrabold"><span>Total</span><span>{brl(p.total_centavos)}</span></div>
        </div>
      </div>

      {["aguardando_pagamento", "pago"].includes(p.status) && <CancelarPedidoBotao id={p.id} />}
    </div>
  );
}

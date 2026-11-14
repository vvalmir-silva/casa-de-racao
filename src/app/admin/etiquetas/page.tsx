import Link from "next/link";
import { sql, getConfig } from "@/lib/db";
import { brl, dataBR, mascaraCep, FORMA_PAGAMENTO } from "@/lib/utils";
import { partesLocais } from "@/lib/frete";
import { vizinhosDeEndereco, rotuloComplemento } from "@/lib/mesmo-endereco";
import { ImprimirBotao } from "./ImprimirBotao";

export const dynamic = "force-dynamic";
export const metadata = { title: "Etiquetas" };

type Ped = {
  id: string; numero: number; cliente: string; telefone: string; endereco: Record<string, string> | null; tipo_entrega: string;
  data_entrega: string | null; inicio: string | null; fim: string | null; forma_pagamento: string; status: string; total_centavos: number;
  troco_para_centavos: number | null; peso_total_kg: string; ordem_rota: number | null; observacoes: string | null; itens: string | null; n_itens: number;
};

const fone = (t: string) => t.replace(/^(\d{2})(\d{4,5})(\d{4})$/, "($1) $2-$3");

export default async function Etiquetas({ searchParams }: { searchParams: Promise<{ rota?: string; data?: string; pedido?: string; formato?: string }> }) {
  const sp = await searchParams;
  const formato = sp.formato === "termica" ? "termica" : "a4";
  const data = sp.data ?? partesLocais().data;
  const filtro = sp.pedido ? "pedido" : sp.rota ? "rota" : "data";
  const uuid = (v?: string) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : null);

  const peds = (await sql`
    SELECT p.id, p.numero, u.nome AS cliente, u.telefone, p.endereco, p.tipo_entrega, p.data_entrega::text, j.inicio::text, j.fim::text,
           p.forma_pagamento, p.status, p.total_centavos, p.troco_para_centavos, p.peso_total_kg, p.ordem_rota, p.observacoes,
           (SELECT string_agg(i.qtd || '× ' || i.nome, ' · ' ORDER BY i.id) FROM pedido_itens i WHERE i.pedido_id = p.id) AS itens,
           (SELECT coalesce(sum(i.qtd), 0)::int FROM pedido_itens i WHERE i.pedido_id = p.id) AS n_itens
    FROM pedidos p JOIN usuarios u ON u.id = p.cliente_id LEFT JOIN janelas j ON j.id = p.janela_id
    WHERE p.status <> 'cancelado'
      AND CASE ${filtro}
        WHEN 'pedido' THEN p.id = ${uuid(sp.pedido)}::uuid
        WHEN 'rota' THEN p.rota_id = ${uuid(sp.rota)}::uuid
        ELSE p.data_entrega = ${data}::date AND p.status IN ('pago', 'separado', 'em_rota')
      END
    ORDER BY p.ordem_rota NULLS LAST, p.tipo_entrega, p.endereco->>'cep', p.numero
  `) as Ped[];
  const cfg = await getConfig();
  const vizinhos = vizinhosDeEndereco(peds);
  const base = `/admin/etiquetas?${filtro === "pedido" ? `pedido=${sp.pedido}` : filtro === "rota" ? `rota=${sp.rota}` : `data=${data}`}`;

  return (
    <div className={`etiquetas-${formato}`}>
      {formato === "termica" && <style>{"@media print { @page { size: 100mm 150mm; margin: 2mm; } }"}</style>}
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <h1 className="h1 mr-auto">Etiquetas</h1>
        <div className="flex rounded-full bg-white p-1 text-sm font-bold">
          <Link href={`${base}&formato=a4`} className={`rounded-full px-3 py-1.5 ${formato === "a4" ? "bg-pine-700 text-white" : "text-ink-2"}`}>Folha A4</Link>
          <Link href={`${base}&formato=termica`} className={`rounded-full px-3 py-1.5 ${formato === "termica" ? "bg-pine-700 text-white" : "text-ink-2"}`}>Térmica 10×15</Link>
        </div>
        <ImprimirBotao />
      </div>
      <p className="no-print muted mb-4">
        {peds.length} {peds.length === 1 ? "etiqueta" : "etiquetas"}
        {filtro === "data" && <> · pedidos pagos de {dataBR(data)}</>}. Cole uma em cada sacola: o motorista confere o número do pedido com a tela.
      </p>
      {peds.length === 0 && <div className="no-print card text-center"><p className="font-bold">Nada para imprimir</p><p className="muted">Não há pedidos pagos para esta seleção.</p></div>}

      <div className="folha-etiquetas">
        {peds.map((p) => {
          const viz = vizinhos.get(p.id) ?? [];
          const receber = p.forma_pagamento !== "pix" && p.status !== "entregue";
          const e = p.endereco;
          return (
            <article key={p.id} className="etiqueta">
              <header className="flex items-start justify-between gap-2 border-b-2 border-ink pb-1.5">
                <div className="text-[34px] font-extrabold leading-none tracking-tight">#{p.numero}</div>
                <div className="text-right text-[11px] font-bold leading-tight">
                  {p.ordem_rota ? <div className="text-[15px]">Parada {p.ordem_rota}</div> : null}
                  <div>{p.tipo_entrega === "retirada" ? "RETIRADA NA LOJA" : p.tipo_entrega === "expresso" ? "EXPRESSO" : `${dataBR(p.data_entrega)}${p.inicio ? ` · ${p.inicio.slice(0, 5)}–${p.fim?.slice(0, 5)}` : ""}`}</div>
                </div>
              </header>
              <div className="mt-1.5 text-[17px] font-extrabold leading-tight">{p.cliente}</div>
              <div className="text-[12px]">{fone(p.telefone)}</div>
              {e && p.tipo_entrega !== "retirada" ? (
                <div className="mt-1.5 text-[13px] leading-snug">
                  <div className="font-bold">{e.logradouro}, {e.numero}</div>
                  <div className="my-1 inline-block rounded border-2 border-ink px-1.5 py-0.5 text-[15px] font-extrabold uppercase">{rotuloComplemento(e)}</div>
                  <div>{e.bairro} · {mascaraCep(e.cep)}</div>
                  {e.referencia && <div className="italic">Ref.: {e.referencia}</div>}
                </div>
              ) : (
                <div className="mt-1.5 text-[13px]">{cfg.loja_endereco}</div>
              )}
              {viz.length > 0 && (
                <div className="mt-1.5 rounded border-2 border-dashed border-ink px-1.5 py-1 text-[12px] font-bold leading-tight">
                  ⚠ Mesmo endereço: também {viz.map((v) => `#${v.numero} (${rotuloComplemento(v.endereco)})`).join(", ")}
                </div>
              )}
              {p.observacoes && <div className="mt-1 text-[11px] leading-tight">Obs.: {p.observacoes}</div>}
              <footer className="mt-auto border-t border-ink/40 pt-1 text-[11px] leading-tight">
                <div className="line-clamp-2">{p.n_itens} {p.n_itens === 1 ? "item" : "itens"} · {Number(p.peso_total_kg).toLocaleString("pt-BR")} kg — {p.itens}</div>
                <div className="mt-0.5 text-[13px] font-extrabold">
                  {receber
                    ? `RECEBER ${brl(p.total_centavos)} · ${FORMA_PAGAMENTO[p.forma_pagamento] ?? p.forma_pagamento}${p.troco_para_centavos ? ` · troco p/ ${brl(p.troco_para_centavos)}` : ""}`
                    : "PAGO ✓"}
                </div>
              </footer>
            </article>
          );
        })}
      </div>
    </div>
  );
}

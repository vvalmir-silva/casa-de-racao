import { sql, getConfig } from "@/lib/db";
import { linksMaps, formatarDistancia, formatarDuracao } from "@/lib/rota";
import { partesLocais, somarDias } from "@/lib/frete";
import { brl, dataBR, mascaraCep, DIAS_SEMANA } from "@/lib/utils";
import { FormAction, BotaoAction } from "@/components/FormAction";
import { criarRota, atualizarRota, removerDaRota, excluirRota, otimizarRotaAction } from "../actions";
import { diaSemanaDe } from "@/lib/frete";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // geocodificação gratuita é 1 endereço/segundo

type PedidoPend = { id: string; numero: number; cliente: string; zona_id: number | null; zona: string | null; endereco: Record<string, string>; total_centavos: number; peso_total_kg: string; status: string; inicio: string | null; fim: string | null };
type Rota = { id: string; data: string; status: string; motorista: string | null; motorista_id: string | null; zona: string | null; qtd: number; entregues: number; distancia_m: number | null; duracao_s: number | null; otimizada_por: string | null };
type PedRota = { id: string; numero: number; rota_id: string; ordem_rota: number; cliente: string; endereco: Record<string, string>; status: string; comprovante_url: string | null; recebido_por: string | null };

export default async function RotasAdmin({ searchParams }: { searchParams: Promise<{ data?: string }> }) {
  const hoje = partesLocais().data;
  const { data = hoje } = await searchParams;
  const pendentes = (await sql`
    SELECT p.id, p.numero, u.nome AS cliente, p.zona_id, z.nome AS zona, p.endereco, p.total_centavos, p.peso_total_kg, p.status, j.inicio::text, j.fim::text
    FROM pedidos p JOIN usuarios u ON u.id = p.cliente_id LEFT JOIN zonas z ON z.id = p.zona_id LEFT JOIN janelas j ON j.id = p.janela_id
    WHERE p.tipo_entrega IN ('rota','expresso') AND p.rota_id IS NULL AND p.status IN ('pago','separado') AND p.data_entrega <= ${data}
    ORDER BY p.zona_id, p.endereco->>'cep'
  `) as PedidoPend[];
  const rotas = (await sql`
    SELECT r.id, r.data::text, r.status, r.motorista_id, m.nome AS motorista, z.nome AS zona, r.distancia_m, r.duracao_s, r.otimizada_por,
      (SELECT count(*) FROM pedidos p WHERE p.rota_id = r.id) AS qtd,
      (SELECT count(*) FROM pedidos p WHERE p.rota_id = r.id AND p.status = 'entregue') AS entregues
    FROM rotas r LEFT JOIN usuarios m ON m.id = r.motorista_id LEFT JOIN zonas z ON z.id = r.zona_id
    WHERE r.data = ${data} ORDER BY r.criado_em
  `) as Rota[];
  const pedRotas = (await sql`
    SELECT p.id, p.numero, p.rota_id, p.ordem_rota, u.nome AS cliente, p.endereco, p.status, p.comprovante_url, p.recebido_por
    FROM pedidos p JOIN usuarios u ON u.id = p.cliente_id WHERE p.rota_id = ANY(${rotas.map((r) => r.id)}::uuid[]) ORDER BY p.ordem_rota
  `) as PedRota[];
  const motoristas = (await sql`SELECT id, nome FROM usuarios WHERE papel IN ('motorista','admin') AND ativo ORDER BY nome`) as { id: string; nome: string }[];
  const zonas = (await sql`SELECT id, nome FROM zonas WHERE ativa ORDER BY ordem`) as { id: number; nome: string }[];
  const cfg = await getConfig();
  const origem = cfg.loja_endereco ?? "";
  const nomeOtimizador: Record<string, string> = { google: "Google Maps", osrm: "OpenStreetMap", local: "estimativa por distância", cep: "ordem de CEP" };
  const aguardandoPix = (await sql`SELECT count(*) AS n FROM pedidos WHERE status = 'aguardando_pagamento' AND data_entrega = ${data}`) as { n: string }[];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="h1">Rotas</h1>
        <form className="flex items-center gap-2"><input type="date" name="data" defaultValue={data} className="input w-40 py-1.5" /><button className="btn-outline py-1.5">Ver</button></form>
        <div className="flex gap-1 text-sm">
          <a className="btn-ghost py-1" href={`/admin/rotas?data=${somarDias(data, -1)}`}>‹</a>
          <span className="py-1 text-ink-2">{DIAS_SEMANA[diaSemanaDe(data)]}, {dataBR(data)}</span>
          <a className="btn-ghost py-1" href={`/admin/rotas?data=${somarDias(data, 1)}`}>›</a>
        </div>
      </div>
      {Number(aguardandoPix[0].n) > 0 && (
        <p className="rounded-lg bg-kibble-50 p-3 text-sm text-ink">{aguardandoPix[0].n} pedido(s) para esta data ainda aguardando PIX — não entram na rota até confirmar.</p>
      )}

      <section className="card space-y-3">
        <h2 className="h2">Pedidos prontos para rota ({pendentes.length})</h2>
        {pendentes.length === 0 ? <p className="muted">Nenhum pedido pago sem rota até esta data.</p> : (
          <FormAction action={criarRota} className="space-y-3">
            <input type="hidden" name="data" value={data} />
            <div className="max-h-96 space-y-1 overflow-y-auto">
              {pendentes.map((p) => (
                <label key={p.id} className="flex items-start gap-2 rounded-lg border border-line p-2 text-sm">
                  <input type="checkbox" name="pedido_id" value={p.id} defaultChecked className="mt-1" />
                  <div className="flex-1">
                    <b>#{p.numero}</b> {p.cliente} · <span className="text-ink-3">{p.zona ?? "sem zona"}{p.inicio ? ` · ${p.inicio.slice(0, 5)}–${p.fim?.slice(0, 5)}` : " · expresso"}</span>
                    <div className="text-xs text-ink-2">{p.endereco.logradouro}, {p.endereco.numero} · {p.endereco.bairro} · {mascaraCep(p.endereco.cep)} · {Number(p.peso_total_kg)} kg · {brl(p.total_centavos)}</div>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <select name="motorista_id" className="input w-48"><option value="">Motorista (depois)</option>{motoristas.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</select>
              <select name="zona_id" className="input w-48"><option value="">Zona (opcional)</option>{zonas.map((z) => <option key={z.id} value={z.id}>{z.nome}</option>)}</select>
              <button className="btn-primary">Criar rota com selecionados</button>
            </div>
          </FormAction>
        )}
      </section>

      {rotas.map((r) => {
        const peds = pedRotas.filter((p) => p.rota_id === r.id);
        const pendentesRota = peds.filter((p) => p.status !== "entregue" && p.status !== "cancelado");
        const links = linksMaps(origem, pendentesRota.map((p) => `${p.endereco.logradouro}, ${p.endereco.numero}, ${p.endereco.bairro}, ${p.endereco.cidade}`));
        return (
          <section key={r.id} className="card space-y-4">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="h2">Rota{r.zona ? ` · ${r.zona}` : ""}</h2>
                  <span className={`badge ${r.status === "concluida" ? "bg-pine-100 text-pine-800" : r.status === "em_andamento" ? "bg-violet-100 text-violet-900" : "bg-page text-ink-2"}`}>{r.status === "em_andamento" ? "em andamento" : r.status}</span>
                </div>
                <div className="mt-1 text-sm text-ink-2">
                  {r.entregues}/{r.qtd} entregues{r.distancia_m != null ? ` · ${formatarDistancia(r.distancia_m)}` : ""}{r.duracao_s != null ? ` · ~${formatarDuracao(r.duracao_s)}` : ""}
                  {r.otimizada_por && <span className="text-ink-3"> · ordem por {nomeOtimizador[r.otimizada_por] ?? r.otimizada_por}</span>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {r.status !== "concluida" && pendentesRota.length > 1 && <BotaoAction className="btn-outline" action={otimizarRotaAction} args={[r.id]}>Otimizar ordem</BotaoAction>}
                {links.map((l, i) => <a key={l} href={l} target="_blank" className="btn-primary">{links.length > 1 ? `Maps · trecho ${i + 1}` : "Abrir no Maps"}</a>)}
                {r.status === "planejada" && <BotaoAction className="btn-outline text-red-700" action={excluirRota} args={[r.id]} confirmar="Excluir rota? Os pedidos voltam para a lista.">Excluir</BotaoAction>}
              </div>
            </div>
            <FormAction action={atualizarRota} className="flex gap-2">
              <input type="hidden" name="rota_id" value={r.id} />
              <select name="motorista_id" className="input sm:w-56" defaultValue={r.motorista_id ?? ""}><option value="">Sem motorista</option>{motoristas.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</select>
              <button className="btn-outline shrink-0">Atribuir</button>
            </FormAction>
            <ol className="space-y-2 text-sm">
              {peds.map((p) => (
                <li key={p.id} className={`flex items-center gap-3 rounded-xl border p-3 ${p.status === "entregue" ? "border-pine-200 bg-pine-50" : "border-line"}`}>
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${p.status === "entregue" ? "bg-pine-500 text-white" : "bg-pine-700 text-white"}`}>{p.status === "entregue" ? "✓" : p.ordem_rota}</span>
                  <span className="min-w-0 flex-1"><b>#{p.numero}</b> {p.cliente}<span className="block text-ink-3">{p.endereco.logradouro}, {p.endereco.numero} · {p.endereco.bairro}</span>
                    {p.recebido_por && <span className="block text-xs text-ink-3">Recebido por {p.recebido_por}</span>}
                  </span>
                  {p.comprovante_url && (
                    <a href={p.comprovante_url} target="_blank" title="Foto da entrega" className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-line">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.comprovante_url} alt="Comprovante" className="h-full w-full object-cover" />
                    </a>
                  )}
                  {p.status !== "entregue" && r.status === "planejada" && <BotaoAction className="text-xs font-semibold text-red-600" action={removerDaRota} args={[p.id]}>remover</BotaoAction>}
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

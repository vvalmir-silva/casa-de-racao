import { sql } from "@/lib/db";
import { partesLocais, somarDias } from "@/lib/frete";
import { brl, dataBR, mascaraCep, DIAS_SEMANA } from "@/lib/utils";
import { FormAction, BotaoAction } from "@/components/FormAction";
import { criarRota, atualizarRota, removerDaRota, excluirRota } from "../actions";
import { diaSemanaDe } from "@/lib/frete";

export const dynamic = "force-dynamic";

type PedidoPend = { id: string; numero: number; cliente: string; zona_id: number | null; zona: string | null; endereco: Record<string, string>; total_centavos: number; peso_total_kg: string; status: string; inicio: string | null; fim: string | null };
type Rota = { id: string; data: string; status: string; motorista: string | null; motorista_id: string | null; zona: string | null; qtd: number; entregues: number };
type PedRota = { id: string; numero: number; rota_id: string; ordem_rota: number; cliente: string; endereco: Record<string, string>; status: string };

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
    SELECT r.id, r.data::text, r.status, r.motorista_id, m.nome AS motorista, z.nome AS zona,
      (SELECT count(*) FROM pedidos p WHERE p.rota_id = r.id) AS qtd,
      (SELECT count(*) FROM pedidos p WHERE p.rota_id = r.id AND p.status = 'entregue') AS entregues
    FROM rotas r LEFT JOIN usuarios m ON m.id = r.motorista_id LEFT JOIN zonas z ON z.id = r.zona_id
    WHERE r.data = ${data} ORDER BY r.criado_em
  `) as Rota[];
  const pedRotas = (await sql`
    SELECT p.id, p.numero, p.rota_id, p.ordem_rota, u.nome AS cliente, p.endereco, p.status
    FROM pedidos p JOIN usuarios u ON u.id = p.cliente_id WHERE p.rota_id = ANY(${rotas.map((r) => r.id)}::uuid[]) ORDER BY p.ordem_rota
  `) as PedRota[];
  const motoristas = (await sql`SELECT id, nome FROM usuarios WHERE papel IN ('motorista','admin') AND ativo ORDER BY nome`) as { id: string; nome: string }[];
  const zonas = (await sql`SELECT id, nome FROM zonas WHERE ativa ORDER BY ordem`) as { id: number; nome: string }[];
  const aguardandoPix = (await sql`SELECT count(*) AS n FROM pedidos WHERE status = 'aguardando_pagamento' AND data_entrega = ${data}`) as { n: string }[];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">Rotas</h1>
        <form className="flex items-center gap-2"><input type="date" name="data" defaultValue={data} className="input w-40 py-1.5" /><button className="btn-outline py-1.5">Ver</button></form>
        <div className="flex gap-1 text-sm">
          <a className="btn-ghost py-1" href={`/admin/rotas?data=${somarDias(data, -1)}`}>‹</a>
          <span className="py-1 text-stone-600">{DIAS_SEMANA[diaSemanaDe(data)]}, {dataBR(data)}</span>
          <a className="btn-ghost py-1" href={`/admin/rotas?data=${somarDias(data, 1)}`}>›</a>
        </div>
      </div>
      {Number(aguardandoPix[0].n) > 0 && (
        <p className="rounded-lg bg-yellow-50 p-2 text-sm text-yellow-800">{aguardandoPix[0].n} pedido(s) para esta data ainda aguardando PIX — não entram na rota até confirmar.</p>
      )}

      <section className="card space-y-3">
        <h2 className="font-semibold">Pedidos prontos para rota ({pendentes.length})</h2>
        {pendentes.length === 0 ? <p className="text-sm text-stone-500">Nenhum pedido pago sem rota até esta data.</p> : (
          <FormAction action={criarRota} className="space-y-3">
            <input type="hidden" name="data" value={data} />
            <div className="max-h-96 space-y-1 overflow-y-auto">
              {pendentes.map((p) => (
                <label key={p.id} className="flex items-start gap-2 rounded-lg border border-stone-200 p-2 text-sm">
                  <input type="checkbox" name="pedido_id" value={p.id} defaultChecked className="mt-1" />
                  <div className="flex-1">
                    <b>#{p.numero}</b> {p.cliente} · <span className="text-stone-500">{p.zona ?? "sem zona"}{p.inicio ? ` · ${p.inicio.slice(0, 5)}–${p.fim?.slice(0, 5)}` : " · expresso"}</span>
                    <div className="text-xs text-stone-600">{p.endereco.logradouro}, {p.endereco.numero} · {p.endereco.bairro} · {mascaraCep(p.endereco.cep)} · {Number(p.peso_total_kg)} kg · {brl(p.total_centavos)}</div>
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
        const waypoints = peds.map((p) => encodeURIComponent(`${p.endereco.logradouro}, ${p.endereco.numero}, ${p.endereco.bairro}, ${p.endereco.cidade}`));
        const maps = `https://www.google.com/maps/dir/?api=1&destination=${waypoints[waypoints.length - 1] ?? ""}&waypoints=${waypoints.slice(0, -1).join("|")}&travelmode=driving`;
        return (
          <section key={r.id} className="card space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">Rota {r.zona ? `· ${r.zona}` : ""}</h2>
              <span className={`badge ${r.status === "concluida" ? "bg-green-100 text-green-800" : r.status === "em_andamento" ? "bg-purple-100 text-purple-800" : "bg-stone-100"}`}>{r.status.replace("_", " ")}</span>
              <span className="text-sm text-stone-500">{r.entregues}/{r.qtd} entregues</span>
              <a href={maps} target="_blank" className="btn-outline ml-auto py-1.5">Abrir no Maps</a>
              {r.status === "planejada" && <BotaoAction className="btn-outline py-1.5 text-red-700" action={excluirRota} args={[r.id]} confirmar="Excluir rota? Os pedidos voltam para a lista.">Excluir</BotaoAction>}
            </div>
            <FormAction action={atualizarRota} className="flex gap-2">
              <input type="hidden" name="rota_id" value={r.id} />
              <select name="motorista_id" className="input w-48" defaultValue={r.motorista_id ?? ""}><option value="">Sem motorista</option>{motoristas.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</select>
              <button className="btn-outline">Atribuir</button>
            </FormAction>
            <ol className="space-y-1 text-sm">
              {peds.map((p) => (
                <li key={p.id} className="flex items-center gap-2 rounded border border-stone-100 p-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-stone-900 text-xs text-white">{p.ordem_rota}</span>
                  <span className="flex-1">#{p.numero} {p.cliente} · {p.endereco.logradouro}, {p.endereco.numero} · {p.endereco.bairro}</span>
                  <span className="badge bg-stone-100">{p.status}</span>
                  {p.status !== "entregue" && r.status === "planejada" && <BotaoAction className="text-xs text-red-600" action={removerDaRota} args={[p.id]}>remover</BotaoAction>}
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

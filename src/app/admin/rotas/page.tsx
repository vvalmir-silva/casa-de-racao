import { sql, getConfig } from "@/lib/db";
import { linksMaps, formatarDistancia, formatarDuracao } from "@/lib/rota";
import { partesLocais, somarDias } from "@/lib/frete";
import { brl, dataBR, mascaraCep, DIAS_SEMANA } from "@/lib/utils";
import { FormAction, BotaoAction } from "@/components/FormAction";
import { criarRota, atualizarRota, removerDaRota, excluirRota, otimizarRotaAction, pedirConfirmacaoAction, naoConfirmadosParaFim, registrarAcerto } from "../actions";
import { esperadoDaRota } from "@/lib/acerto";
import { SeloConfirmacao } from "@/components/SeloConfirmacao";
import { diaSemanaDe } from "@/lib/frete";
import { vizinhosDeEndereco, rotuloComplemento } from "@/lib/mesmo-endereco";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // geocodificação gratuita é 1 endereço/segundo

type PedidoPend = { id: string; numero: number; cliente: string; zona_id: number | null; zona: string | null; endereco: Record<string, string>; total_centavos: number; peso_total_kg: string; status: string; inicio: string | null; fim: string | null; confirmacao: string | null };
type Rota = { id: string; data: string; status: string; motorista: string | null; motorista_id: string | null; zona: string | null; qtd: number; entregues: number; distancia_m: number | null; duracao_s: number | null; otimizada_por: string | null };
type PedRota = { id: string; numero: number; rota_id: string; ordem_rota: number; cliente: string; endereco: Record<string, string>; status: string; comprovante_url: string | null; recebido_por: string | null; confirmacao: string | null; confirmacao_pedida_em: string | null; forma_pagamento: string; total_centavos: number; troco_para_centavos: number | null };
type Acerto = { rota_id: string; esperado_dinheiro: number; esperado_cartao: number; recebido_dinheiro: number; recebido_cartao: number; observacao: string | null; conferido_em: string; conferido_por: string | null };

export default async function RotasAdmin({ searchParams }: { searchParams: Promise<{ data?: string }> }) {
  const hoje = partesLocais().data;
  const { data = hoje } = await searchParams;
  const pendentes = (await sql`
    SELECT p.id, p.numero, u.nome AS cliente, p.zona_id, z.nome AS zona, p.endereco, p.total_centavos, p.peso_total_kg, p.status, j.inicio::text, j.fim::text, p.confirmacao
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
    SELECT p.id, p.numero, p.rota_id, p.ordem_rota, u.nome AS cliente, p.endereco, p.status, p.comprovante_url, p.recebido_por, p.confirmacao, p.confirmacao_pedida_em::text, p.forma_pagamento, p.total_centavos, p.troco_para_centavos
    FROM pedidos p JOIN usuarios u ON u.id = p.cliente_id WHERE p.rota_id = ANY(${rotas.map((r) => r.id)}::uuid[]) ORDER BY p.ordem_rota
  `) as PedRota[];
  const acertos = (await sql`
    SELECT a.*, a.conferido_em::text, u.nome AS conferido_por FROM acertos_caixa a LEFT JOIN usuarios u ON u.id = a.conferido_por
    WHERE a.rota_id = ANY(${rotas.map((r) => r.id)}::uuid[])
  `) as Acerto[];
  const esperados = new Map(await Promise.all(rotas.map(async (r) => [r.id, await esperadoDaRota(r.id)] as const)));
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
                    <b>#{p.numero}</b> {p.cliente} {p.confirmacao === "nao" && <span className="badge bg-oferta-50 text-oferta">✗ disse que não vai estar — combine outro dia</span>} · <span className="text-ink-3">{p.zona ?? "sem zona"}{p.inicio ? ` · ${p.inicio.slice(0, 5)}–${p.fim?.slice(0, 5)}` : " · expresso"}</span>
                    <div className="text-xs text-ink-2">{p.endereco.logradouro}, {p.endereco.numero} · <b>{rotuloComplemento(p.endereco)}</b> · {p.endereco.bairro} · {mascaraCep(p.endereco.cep)} · {Number(p.peso_total_kg)} kg · {brl(p.total_centavos)}</div>
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
        const vizinhos = vizinhosDeEndereco(peds.filter((p) => p.status !== "entregue" && p.status !== "cancelado"));
        const pendentesRota = peds.filter((p) => p.status !== "entregue" && p.status !== "cancelado");
        const aberto = pendentesRota;
        const conf = { sim: aberto.filter((p) => p.confirmacao === "sim").length, nao: aberto.filter((p) => p.confirmacao === "nao").length, sem: aberto.filter((p) => !p.confirmacao).length, pedidas: aberto.filter((p) => p.confirmacao_pedida_em).length };
        const esp = esperados.get(r.id);
        const acerto = acertos.find((a) => a.rota_id === r.id);
        const precisaAcerto = !!esp && (esp.dinheiro + esp.cartao > 0) && r.entregues > 0;
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
                <a href={`/admin/etiquetas?rota=${r.id}`} className="btn-outline">🏷️ Etiquetas</a>
                {links.map((l, i) => <a key={l} href={l} target="_blank" className="btn-primary">{links.length > 1 ? `Maps · trecho ${i + 1}` : "Abrir no Maps"}</a>)}
                {r.status === "planejada" && <BotaoAction className="btn-outline text-red-700" action={excluirRota} args={[r.id]} confirmar="Excluir rota? Os pedidos voltam para a lista.">Excluir</BotaoAction>}
              </div>
            </div>
            <FormAction action={atualizarRota} className="flex gap-2">
              <input type="hidden" name="rota_id" value={r.id} />
              <select name="motorista_id" className="input sm:w-56" defaultValue={r.motorista_id ?? ""}><option value="">Sem motorista</option>{motoristas.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</select>
              <button className="btn-outline shrink-0">Atribuir</button>
            </FormAction>
            {pendentesRota.length > 0 && r.status !== "concluida" && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl bg-page p-3 text-sm">
                <span className="font-semibold">Vão estar em casa?</span>
                <span className="badge bg-pine-100 text-pine-800">✓ {conf.sim}</span>
                <span className="badge bg-oferta-50 text-oferta">✗ {conf.nao}</span>
                <span className="badge bg-white text-ink-2">? {conf.sem}{conf.pedidas < pendentesRota.length ? ` (${pendentesRota.length - conf.pedidas} sem aviso)` : ""}</span>
                <span className="flex-1" />
                {conf.sem > 0 && <BotaoAction className="btn-outline min-h-[40px] py-1" action={pedirConfirmacaoAction} args={[r.id]}>{conf.pedidas ? "Perguntar de novo" : "Pedir confirmação"}</BotaoAction>}
                {conf.sem + conf.nao > 0 && conf.sim > 0 && <BotaoAction className="btn-outline min-h-[40px] py-1" action={naoConfirmadosParaFim} args={[r.id]}>Não confirmados para o fim</BotaoAction>}
              </div>
            )}
            <ol className="space-y-2 text-sm">
              {peds.map((p) => (
                <li key={p.id} className={`flex items-center gap-3 rounded-xl border p-3 ${p.status === "entregue" ? "border-pine-200 bg-pine-50" : "border-line"}`}>
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${p.status === "entregue" ? "bg-pine-500 text-white" : "bg-pine-700 text-white"}`}>{p.status === "entregue" ? "✓" : p.ordem_rota}</span>
                  <span className="min-w-0 flex-1"><b>#{p.numero}</b> {p.cliente} {p.status !== "entregue" && p.status !== "cancelado" && <SeloConfirmacao valor={p.confirmacao} />}
                    {p.forma_pagamento === "dinheiro" && p.status !== "cancelado" && <span className="ml-1 text-xs font-semibold text-ink-2">💵 {brl(p.total_centavos)}{p.troco_para_centavos && p.troco_para_centavos > p.total_centavos ? ` · troco ${brl(p.troco_para_centavos - p.total_centavos)}` : ""}</span>}
                    {p.forma_pagamento === "cartao_entrega" && p.status !== "cancelado" && <span className="ml-1 text-xs font-semibold text-ink-2">💳 {brl(p.total_centavos)}</span>}
                    <span className="block text-ink-3">{p.endereco.logradouro}, {p.endereco.numero} · <b className="text-ink-2">{rotuloComplemento(p.endereco)}</b> · {p.endereco.bairro}</span>
                    {vizinhos.get(p.id) && <span className="mt-1 inline-block rounded-md bg-kibble-50 px-1.5 py-0.5 text-xs font-bold text-ink">⚠ mesmo endereço que {vizinhos.get(p.id)!.map((v) => `#${v.numero}`).join(", ")}</span>}
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
            {esp && esp.troco > 0 && r.status !== "concluida" && (
              <p className="rounded-xl bg-kibble-50 px-3 py-2 text-sm">💰 O motorista precisa sair com <b>{brl(esp.troco)}</b> de troco.</p>
            )}
            {precisaAcerto && (
              <div className="space-y-3 rounded-xl border border-line p-3" data-testid="acerto">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-extrabold">Acerto de caixa</h3>
                  {acerto ? (
                    acerto.recebido_dinheiro + acerto.recebido_cartao === acerto.esperado_dinheiro + acerto.esperado_cartao
                      ? <span className="badge bg-pine-100 text-pine-800">✓ conferido, bateu</span>
                      : <span className="badge bg-oferta-50 text-oferta">diferença de {brl(acerto.recebido_dinheiro + acerto.recebido_cartao - acerto.esperado_dinheiro - acerto.esperado_cartao)}</span>
                  ) : <span className="badge bg-kibble-50 text-ink">a conferir</span>}
                </div>
                <p className="text-sm text-ink-2">Esperado: 💵 dinheiro <b>{brl(esp!.dinheiro)}</b> ({esp!.qtdDinheiro}) · 💳 cartão <b>{brl(esp!.cartao)}</b> ({esp!.qtdCartao}){esp!.troco > 0 ? <> · mais o troco que saiu com ele: <b>{brl(esp!.troco)}</b></> : null}</p>
                {acerto && <p className="text-xs text-ink-3">Conferido{acerto.conferido_por ? ` por ${acerto.conferido_por}` : ""} em {new Date(acerto.conferido_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}: dinheiro {brl(acerto.recebido_dinheiro)}, cartão {brl(acerto.recebido_cartao)}{acerto.observacao ? ` — ${acerto.observacao}` : ""}</p>}
                <FormAction action={registrarAcerto} className="grid gap-2 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end">
                  <input type="hidden" name="rota_id" value={r.id} />
                  <div><label className="label" htmlFor={`ac-din-${r.id}`}>Dinheiro recebido (R$)</label><input id={`ac-din-${r.id}`} name="recebido_dinheiro" className="input" inputMode="decimal" required defaultValue={((acerto?.recebido_dinheiro ?? esp!.dinheiro) / 100).toFixed(2).replace(".", ",")} /></div>
                  <div><label className="label" htmlFor={`ac-cart-${r.id}`}>Cartão (comprovantes, R$)</label><input id={`ac-cart-${r.id}`} name="recebido_cartao" className="input" inputMode="decimal" required defaultValue={((acerto?.recebido_cartao ?? esp!.cartao) / 100).toFixed(2).replace(".", ",")} /></div>
                  <div><label className="label" htmlFor={`ac-obs-${r.id}`}>Observação (obrigatória se não bater)</label><input id={`ac-obs-${r.id}`} name="observacao" className="input" defaultValue={acerto?.observacao ?? ""} /></div>
                  <button className="btn-primary">{acerto ? "Corrigir" : "Conferir"}</button>
                </FormAction>
                <p className="text-xs text-ink-3">Não conte o troco: ele volta para o caixa à parte. Confira cartão pelo extrato da maquininha.</p>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

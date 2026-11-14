"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { brl, FORMA_PAGAMENTO } from "@/lib/utils";
import { linksMaps, formatarDistancia, formatarDuracao } from "@/lib/rota-cliente";
import { reordenarRota, otimizarRotaAction } from "../admin/actions";
import { iniciarRota, concluirRota } from "./actions";
import { EntregaForm } from "./EntregaForm";
import { vizinhosDeEndereco, rotuloComplemento } from "@/lib/mesmo-endereco";
import type { RotaDoDia } from "./page";

export function RotaMotorista({ rota, origem, fotoObrigatoria }: { rota: RotaDoDia; origem: string; fotoObrigatoria: boolean }) {
  const [p, start] = useTransition();
  const router = useRouter();
  const [ordem, setOrdem] = useState(rota.paradas.map((x) => x.id));
  const [entregando, setEntregando] = useState<{ id: string; numero: number } | null>(null);
  const [msg, setMsg] = useState("");
  const paradas = ordem.map((id) => rota.paradas.find((x) => x.id === id)!).filter(Boolean);
  const pendentes = paradas.filter((x) => x.status !== "entregue" && x.status !== "cancelado");
  const prox = pendentes[0];
  const ativa = rota.status === "em_andamento";
  // pendentes no mesmo endereço (prédio/condomínio): avisa para conferir apto e nome
  const vizinhos = vizinhosDeEndereco(pendentes);
  const AvisoMesmoEndereco = ({ id, escuro }: { id: string; escuro?: boolean }) => {
    const v = vizinhos.get(id);
    if (!v?.length) return null;
    return (
      <div role="note" className={`mt-2 rounded-xl border-2 border-dashed px-2.5 py-1.5 text-[13px] font-bold leading-snug ${escuro ? "border-kibble-400 text-kibble-50" : "border-kibble-500 bg-kibble-50 text-ink"}`}>
        ⚠ Mesmo endereço: também {v.map((o) => `#${o.numero} ${o.cliente.split(" ")[0]} (${rotuloComplemento(o.endereco)})`).join(", ")}. Confira o nº do pedido na etiqueta.
      </div>
    );
  };

  function mover(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= ordem.length) return;
    const n = [...ordem];
    [n[i], n[j]] = [n[j], n[i]];
    setOrdem(n);
    start(async () => { await reordenarRota(rota.id, n); });
  }

  const endTxt = (e: Record<string, string>) => `${e.logradouro}, ${e.numero}, ${e.bairro}, ${e.cidade}`;
  const navUrl = (e: Record<string, string>) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(endTxt(e))}&travelmode=driving`;
  const wazeUrl = (e: Record<string, string>) => `https://waze.com/ul?q=${encodeURIComponent(endTxt(e))}&navigate=yes`;
  const links = linksMaps(origem, pendentes.map((x) => endTxt(x.endereco)));

  return (
    <section className="space-y-3">
      <div className="card space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="h2">{rota.zona ?? "Rota do dia"}</div>
            <div className="muted">{paradas.length - pendentes.length} de {paradas.length} entregues{rota.distancia_m != null ? ` · ${formatarDistancia(rota.distancia_m)}` : ""}{rota.duracao_s != null ? ` · ~${formatarDuracao(rota.duracao_s)}` : ""}</div>
          </div>
          <span className={`badge ${rota.status === "concluida" ? "bg-pine-100 text-pine-800" : ativa ? "bg-violet-100 text-violet-900" : "bg-page text-ink-2"}`}>{rota.status === "em_andamento" ? "em andamento" : rota.status}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-page"><div className="h-full rounded-full bg-pine-500 transition-all" style={{ width: `${paradas.length ? ((paradas.length - pendentes.length) / paradas.length) * 100 : 0}%` }} /></div>
        <div className="flex flex-wrap gap-2">
          {rota.status === "planejada" && <button className="btn-primary flex-1" disabled={p} onClick={() => start(async () => { await iniciarRota(rota.id); router.refresh(); })}>Iniciar rota</button>}
          {ativa && pendentes.length === 0 && <button className="btn-primary flex-1" disabled={p} onClick={() => start(async () => { await concluirRota(rota.id); router.refresh(); })}>Concluir rota</button>}
          {rota.status !== "concluida" && pendentes.length > 1 && (
            <button className="btn-outline flex-1" disabled={p} onClick={() => start(async () => { setMsg(""); const r = await otimizarRotaAction(rota.id); if (r.erro) setMsg(r.erro); router.refresh(); })}>
              {p ? "Calculando…" : "Otimizar ordem"}
            </button>
          )}
          {rota.status !== "concluida" && links.map((l, i) => <a key={l} className="btn-outline flex-1" href={l} target="_blank">{links.length > 1 ? `Rota no Maps ${i + 1}/${links.length}` : "Rota completa no Maps"}</a>)}
        </div>
        {msg && <p className="rounded-xl bg-kibble-50 px-3 py-2 text-sm">{msg}</p>}
      </div>

      {prox && ativa && (
        <div className="rounded-2xl bg-pine-700 p-4 text-white">
          <div className="text-[13px] font-bold text-kibble-400">Próxima parada</div>
          <div className="mt-0.5 text-lg font-extrabold">#{prox.numero} · {prox.cliente}</div>
          <div className="text-sm text-pine-100">{endTxt(prox.endereco)}</div>
          <div className="mt-1 inline-block rounded-lg bg-white/15 px-2 py-0.5 text-[15px] font-extrabold">{rotuloComplemento(prox.endereco)}</div>
          <AvisoMesmoEndereco id={prox.id} escuro />
          {prox.forma_pagamento !== "pix" && <div className="mt-1 text-sm font-bold text-kibble-400">Receber {brl(prox.total_centavos)} · {FORMA_PAGAMENTO[prox.forma_pagamento]}{prox.troco_para_centavos ? ` · troco p/ ${brl(prox.troco_para_centavos)}` : ""}</div>}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <a className="btn bg-white text-ink" href={navUrl(prox.endereco)} target="_blank">Maps</a>
            <a className="btn bg-white text-ink" href={wazeUrl(prox.endereco)} target="_blank">Waze</a>
            <a className="btn bg-white text-ink" href={`https://wa.me/55${prox.telefone}?text=${encodeURIComponent(`Olá ${prox.cliente.split(" ")[0]}! Sou o entregador da Casa de Ração, estou chegando com seu pedido #${prox.numero}.`)}`} target="_blank">Avisar</a>
          </div>
          <button className="btn-accent mt-2 w-full" onClick={() => setEntregando({ id: prox.id, numero: prox.numero })}>Entregue</button>
        </div>
      )}

      <ol className="space-y-2">
        {paradas.map((x, i) => {
          const feito = x.status === "entregue";
          return (
            <li key={x.id} className={`rounded-2xl border bg-white p-3 text-sm ${feito ? "border-pine-200 opacity-70" : "border-line"}`}>
              <div className="flex items-start gap-3">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-extrabold ${feito ? "bg-pine-500 text-white" : "bg-page text-ink"}`}>{feito ? "✓" : i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-bold">#{x.numero} · {x.cliente}{x.inicio ? <span className="ml-1 font-semibold text-ink-3">{x.inicio.slice(0, 5)}–{x.fim?.slice(0, 5)}</span> : null}</div>
                  <div className="text-ink-2">{x.endereco.logradouro}, {x.endereco.numero} · <b className="text-ink">{rotuloComplemento(x.endereco)}</b> · {x.endereco.bairro}</div>
                  {x.endereco.referencia && <div className="text-ink-3">Ref.: {x.endereco.referencia}</div>}
                  <div className="text-ink-3">{x.itens}</div>
                  <div className="font-semibold">{x.forma_pagamento === "pix" ? "PIX · já pago" : `Receber ${brl(x.total_centavos)} · ${FORMA_PAGAMENTO[x.forma_pagamento]}`}{x.troco_para_centavos ? ` · troco p/ ${brl(x.troco_para_centavos)}` : ""}</div>
                  {x.observacoes && <div className="mt-1 rounded-lg bg-kibble-50 px-2 py-1 text-ink">{x.observacoes}</div>}
                  {!feito && <AvisoMesmoEndereco id={x.id} />}
                </div>
                {feito && x.comprovante_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={x.comprovante_url} alt="Comprovante" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                )}
                {!feito && rota.status !== "concluida" && (
                  <div className="flex shrink-0 flex-col">
                    <button className="grid h-9 w-9 place-items-center rounded-lg text-ink-3 hover:bg-page disabled:opacity-30" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir">▲</button>
                    <button className="grid h-9 w-9 place-items-center rounded-lg text-ink-3 hover:bg-page disabled:opacity-30" onClick={() => mover(i, 1)} disabled={i === ordem.length - 1} aria-label="Descer">▼</button>
                  </div>
                )}
              </div>
              {!feito && ativa && x.id !== prox?.id && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <a className="btn-outline" href={navUrl(x.endereco)} target="_blank">Navegar</a>
                  <button className="btn-primary" onClick={() => setEntregando({ id: x.id, numero: x.numero })}>Entregue</button>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {entregando && <EntregaForm pedidoId={entregando.id} numero={entregando.numero} fotoObrigatoria={fotoObrigatoria} onFechar={() => setEntregando(null)} />}
    </section>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { brl, FORMA_PAGAMENTO } from "@/lib/utils";
import { mudarStatusPedido, reordenarRota } from "../admin/actions";
import { iniciarRota, concluirRota } from "./actions";
import type { RotaDoDia } from "./page";

export function RotaMotorista({ rota }: { rota: RotaDoDia }) {
  const [p, start] = useTransition();
  const router = useRouter();
  const [ordem, setOrdem] = useState(rota.paradas.map((x) => x.id));
  const paradas = ordem.map((id) => rota.paradas.find((x) => x.id === id)!);
  const pendentes = paradas.filter((x) => x.status !== "entregue" && x.status !== "cancelado");
  const prox = pendentes[0];

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

  return (
    <section className="card space-y-3">
      <div className="flex items-center gap-2">
        <b>{rota.zona ?? "Rota"}</b>
        <span className="text-sm text-ink-3">{paradas.length - pendentes.length}/{paradas.length} entregues</span>
        <div className="ml-auto flex gap-2">
          {rota.status === "planejada" && <button className="btn-primary py-1.5" disabled={p} onClick={() => start(async () => { await iniciarRota(rota.id); router.refresh(); })}>Iniciar rota</button>}
          {rota.status === "em_andamento" && pendentes.length === 0 && <button className="btn-primary py-1.5" disabled={p} onClick={() => start(async () => { await concluirRota(rota.id); router.refresh(); })}>Concluir</button>}
        </div>
      </div>

      {prox && rota.status === "em_andamento" && (
        <div className="rounded-lg border border-kibble-400 bg-kibble-50 p-3">
          <div className="text-xs font-semibold uppercase text-pine-700">Próxima parada</div>
          <div className="font-medium">#{prox.numero} · {prox.cliente}</div>
          <div className="text-sm">{endTxt(prox.endereco)}{prox.endereco.complemento ? ` · ${prox.endereco.complemento}` : ""}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <a className="btn-primary py-1.5" href={navUrl(prox.endereco)} target="_blank">Maps</a>
            <a className="btn-outline py-1.5" href={wazeUrl(prox.endereco)} target="_blank">Waze</a>
            <a className="btn-outline py-1.5" href={`https://wa.me/55${prox.telefone}?text=${encodeURIComponent(`Olá ${prox.cliente.split(" ")[0]}! Sou o entregador da Casa de Ração, estou chegando com seu pedido #${prox.numero}.`)}`} target="_blank">WhatsApp</a>
          </div>
        </div>
      )}

      <ol className="space-y-2">
        {paradas.map((x, i) => {
          const feito = x.status === "entregue";
          return (
            <li key={x.id} className={`rounded-lg border p-3 text-sm ${feito ? "border-pine-200 bg-pine-50 opacity-70" : "border-line"}`}>
              <div className="flex items-start gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-pine-700 text-xs text-white">{i + 1}</span>
                <div className="flex-1">
                  <div className="font-medium">#{x.numero} · {x.cliente}{x.inicio ? <span className="ml-1 text-xs text-ink-3">({x.inicio.slice(0, 5)}–{x.fim?.slice(0, 5)})</span> : null}</div>
                  <div>{x.endereco.logradouro}, {x.endereco.numero}{x.endereco.complemento ? ` - ${x.endereco.complemento}` : ""} · {x.endereco.bairro}</div>
                  {x.endereco.referencia && <div className="text-xs text-ink-3">Ref.: {x.endereco.referencia}</div>}
                  <div className="text-xs text-ink-2">{x.itens}</div>
                  <div className="text-xs font-medium">{FORMA_PAGAMENTO[x.forma_pagamento]} · {brl(x.total_centavos)}{x.troco_para_centavos ? ` · troco p/ ${brl(x.troco_para_centavos)}` : ""}{x.forma_pagamento === "pix" ? " · já pago" : " · RECEBER"}</div>
                  {x.observacoes && <div className="text-xs text-ink-2">Obs.: {x.observacoes}</div>}
                </div>
                {!feito && rota.status !== "concluida" && (
                  <div className="flex flex-col gap-1">
                    <button className="btn-ghost px-2 py-0.5" onClick={() => mover(i, -1)} disabled={i === 0}>▲</button>
                    <button className="btn-ghost px-2 py-0.5" onClick={() => mover(i, 1)} disabled={i === ordem.length - 1}>▼</button>
                  </div>
                )}
              </div>
              {!feito && rota.status === "em_andamento" && (
                <div className="mt-2 flex gap-2">
                  <a className="btn-outline flex-1 py-1.5" href={navUrl(x.endereco)} target="_blank">Navegar</a>
                  <button className="btn-primary flex-1 py-1.5" disabled={p} onClick={() => start(async () => { const r = await mudarStatusPedido(x.id, "entregue"); if (r.erro) alert(r.erro); router.refresh(); })}>Entregue ✓</button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

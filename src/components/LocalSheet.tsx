"use client";

import { useEffect, useRef, useState } from "react";
import { useLocal } from "@/lib/local";
import { brl, limparCep, mascaraCep } from "@/lib/utils";
import { IconPin, IconTruck } from "./Icons";

type Resp = { atende: boolean; zona: { nome: string } | null; opcoes: { tipo: string; titulo: string; taxa_centavos: number }[] };

/** Chip "Entregar em…" do topo. */
export function LocalChip({ escuro }: { escuro?: boolean }) {
  const { local, abrir } = useLocal();
  return (
    <button
      onClick={abrir}
      className={`group flex min-h-[44px] min-w-0 items-center gap-2 rounded-full px-3 text-left transition active:scale-[.98] ${escuro ? "bg-white/10 text-white hover:bg-white/15" : "bg-page hover:bg-pine-50"}`}
    >
      <IconPin width={18} height={18} className={escuro ? "text-kibble-400" : "text-pine-700"} />
      <span className="min-w-0 leading-tight">
        <span className={`block text-[11px] font-semibold ${escuro ? "text-white/70" : "text-ink-3"}`}>{local ? (local.atende ? local.rotulo : "Fora da área de entrega") : "Entregar em"}</span>
        <span className="block truncate text-[13px] font-extrabold">{local ? (local.bairro || mascaraCep(local.cep)) : "Informe seu CEP"}</span>
      </span>
      <svg width="14" height="14" viewBox="0 0 24 24" className="shrink-0 opacity-60" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6" /></svg>
    </button>
  );
}

/** Folha de baixo (celular) / modal (desktop) para consultar a entrega por CEP. */
export function LocalSheet() {
  const { aberto, fechar, local, setLocal } = useLocal();
  const [cep, setCep] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!aberto) return;
    setCep(local ? mascaraCep(local.cep) : "");
    setErro("");
    setTimeout(() => input.current?.focus(), 80);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps

  async function consultar() {
    const c = limparCep(cep);
    if (c.length !== 8) return setErro("Digite os 8 números do CEP.");
    setCarregando(true); setErro("");
    try {
      const [f, e] = await Promise.all([
        fetch(`/api/frete?cep=${c}&subtotal=0&peso=1`).then((r) => r.json() as Promise<Resp>),
        fetch(`/api/cep?cep=${c}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      const rota = f.opcoes.find((o) => o.tipo === "rota");
      setLocal({ cep: c, atende: f.atende && !!rota, bairro: e?.bairro || undefined, zona: f.zona?.nome, rotulo: rota?.titulo, taxa: rota?.taxa_centavos });
    } catch {
      setErro("Não deu para consultar agora. Tente de novo.");
    } finally {
      setCarregando(false);
    }
  }

  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Endereço de entrega">
      <button className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" aria-label="Fechar" onClick={fechar} />
      <div className="relative w-full max-w-md animate-[subir_.22s_ease-out] rounded-t-[28px] bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-[28px]">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line sm:hidden" />
        <h2 className="text-xl font-extrabold tracking-tight">Onde vamos entregar?</h2>
        <p className="muted mt-1">Veja o dia, o horário e o frete para o seu endereço.</p>
        <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); consultar(); }}>
          <input ref={input} value={cep} onChange={(e) => setCep(mascaraCep(e.target.value))} inputMode="numeric" autoComplete="off" maxLength={9} placeholder="00000-000" aria-label="CEP" className="input min-h-[52px] flex-1 text-lg font-bold tracking-wide" />
          <button className="btn-primary min-h-[52px] px-5" disabled={carregando}>{carregando ? "…" : "Consultar"}</button>
        </form>
        {erro && <p className="mt-2 text-sm font-semibold text-red-700">{erro}</p>}
        {local && !carregando && (
          local.atende ? (
            <div className="mt-4 flex gap-3 rounded-2xl bg-pine-50 p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-pine-700 text-kibble-400"><IconTruck width={20} height={20} /></span>
              <div className="text-sm">
                <div className="font-extrabold text-pine-800">Entregamos{local.bairro ? ` na ${local.bairro}` : " aí"}!</div>
                <div className="text-ink-2">{local.rotulo}</div>
                <div className="text-ink-2">Frete {local.taxa ? brl(local.taxa) : "grátis"} · grátis acima de R$ 150</div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl bg-kibble-50 p-4 text-sm">
              <div className="font-extrabold">Ainda não entregamos nesse CEP</div>
              <div className="text-ink-2">Você pode comprar e retirar na loja, sem custo.</div>
            </div>
          )
        )}
        {local && <button className="btn-ghost mt-3 w-full" onClick={fechar}>Continuar comprando</button>}
      </div>
    </div>
  );
}

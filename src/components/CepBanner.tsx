"use client";

import { useEffect, useState } from "react";
import { mascaraCep, limparCep, brl } from "@/lib/utils";
import { IconTruck } from "./Icons";

type Resp = { atende: boolean; zona: { nome: string } | null; opcoes: { tipo: string; titulo: string; taxa_centavos: number }[] };

/** Hero da home: a promessa de entrega + consulta de CEP. */
export function CepBanner() {
  const [cep, setCep] = useState("");
  const [r, setR] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const c = localStorage.getItem("cr_cep");
    if (c) { setCep(mascaraCep(c)); consultar(c); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function consultar(c: string) {
    const limpo = limparCep(c);
    if (limpo.length !== 8) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/frete?cep=${limpo}&subtotal=0&peso=1`);
      setR(await res.json());
      localStorage.setItem("cr_cep", limpo);
    } finally { setLoading(false); }
  }

  const rota = r?.opcoes.find((o) => o.tipo === "rota");
  return (
    <section className="relative overflow-hidden rounded-3xl bg-pine-700 px-5 py-7 text-white sm:px-10 sm:py-12">
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-pine-600" />
      <div className="pointer-events-none absolute -bottom-24 right-24 h-56 w-56 rounded-full bg-pine-800" />
      <div className="relative max-w-xl">
        <h1 className="text-[28px] font-extrabold leading-[1.05] tracking-tight sm:text-[40px]">
          Ração na sua porta,<br />no dia certo.
        </h1>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-pine-100 sm:text-base">
          Pedidos até 15h chegam hoje à noite. Saco de 15 kg sem carregar peso: a gente leva até a sua porta.
        </p>
        <form className="mt-5 flex gap-2" onSubmit={(e) => { e.preventDefault(); consultar(cep); }}>
          <input
            value={cep}
            onChange={(e) => setCep(mascaraCep(e.target.value))}
            placeholder="Seu CEP"
            inputMode="numeric"
            aria-label="CEP"
            className="input min-h-[50px] flex-1 border-0 bg-white text-base text-ink focus:ring-kibble-400 sm:max-w-[220px]"
          />
          <button className="btn-accent min-h-[50px] shrink-0 px-5" disabled={loading}>{loading ? "…" : "Ver entrega"}</button>
        </form>
        {r && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-white/10 p-3 text-sm">
            <IconTruck className="mt-0.5 shrink-0 text-kibble-400" width={20} height={20} />
            {r.atende && rota ? (
              <span><b>Entregamos aí.</b> {rota.titulo}, a partir de {brl(rota.taxa_centavos)} — grátis acima de R$ 150.</span>
            ) : (
              <span><b>Ainda não entregamos neste CEP.</b> Você pode retirar na loja ou pedir expresso para itens leves.</span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

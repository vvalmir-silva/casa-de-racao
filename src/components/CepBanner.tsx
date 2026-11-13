"use client";

import { useEffect, useState } from "react";
import { mascaraCep, limparCep, brl } from "@/lib/utils";

type Resp = { atende: boolean; zona: { nome: string } | null; opcoes: { tipo: string; titulo: string; taxa_centavos: number }[] };

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
    const res = await fetch(`/api/frete?cep=${limpo}&subtotal=0&peso=1`);
    setR(await res.json());
    localStorage.setItem("cr_cep", limpo);
    setLoading(false);
  }

  const rota = r?.opcoes.find((o) => o.tipo === "rota");
  return (
    <div className="card flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="text-sm font-medium">Entregamos no seu bairro?</div>
      <form
        className="flex gap-2"
        onSubmit={(e) => { e.preventDefault(); consultar(cep); }}
      >
        <input value={cep} onChange={(e) => setCep(mascaraCep(e.target.value))} placeholder="CEP" inputMode="numeric" className="input w-32" />
        <button className="btn-outline" disabled={loading}>{loading ? "..." : "Ver"}</button>
      </form>
      {r && (
        <div className="text-sm">
          {r.atende && rota ? (
            <span className="text-green-700">✓ {r.zona?.nome} · {rota.titulo} · a partir de {brl(rota.taxa_centavos)}</span>
          ) : (
            <span className="text-stone-600">Ainda não entregamos neste CEP — retirada na loja disponível.</span>
          )}
        </div>
      )}
    </div>
  );
}

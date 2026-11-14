"use client";

import { useEffect, useRef, useState } from "react";

export type EnderecoCep = { cep: string; logradouro: string; bairro: string; cidade: string; uf: string };
export type StatusCep = "vazio" | "buscando" | "ok" | "nao_encontrado" | "erro";

/**
 * Busca o endereço quando o CEP fica com 8 números.
 * Chama `aoEncontrar` uma vez por CEP buscado (não sobrescreve se o mesmo CEP for digitado de novo).
 */
export function useBuscaCep(cep: string, aoEncontrar: (e: EnderecoCep) => void) {
  const [status, setStatus] = useState<StatusCep>("vazio");
  const [endereco, setEndereco] = useState<EnderecoCep | null>(null);
  const ultimo = useRef("");
  const cb = useRef(aoEncontrar);
  cb.current = aoEncontrar;

  useEffect(() => {
    const c = cep.replace(/\D/g, "");
    if (c.length !== 8) { setStatus("vazio"); ultimo.current = ""; return; }
    if (c === ultimo.current) return;
    ultimo.current = c;
    const ctrl = new AbortController();
    setStatus("buscando");
    fetch(`/api/cep?cep=${c}`, { signal: ctrl.signal })
      .then(async (r) => {
        if (r.status === 404) { setStatus("nao_encontrado"); setEndereco(null); return; }
        if (!r.ok) { setStatus("erro"); setEndereco(null); return; }
        const j = (await r.json()) as EnderecoCep;
        setEndereco(j);
        setStatus("ok");
        cb.current(j);
      })
      .catch((e) => { if (e?.name !== "AbortError") setStatus("erro"); });
    return () => ctrl.abort();
  }, [cep]);

  return { status, endereco };
}

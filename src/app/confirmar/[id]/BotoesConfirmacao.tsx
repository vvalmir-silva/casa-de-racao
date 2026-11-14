"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { responderConfirmacao } from "./actions";

export function BotoesConfirmacao({ id, t, atual, emRota }: { id: string; t: string; atual: "sim" | "nao" | null; emRota: boolean }) {
  const [resp, setResp] = useState(atual);
  const [erro, setErro] = useState("");
  const [pend, start] = useTransition();
  const router = useRouter();

  function responder(r: "sim" | "nao") {
    setErro("");
    const fd = new FormData();
    fd.set("id", id); fd.set("t", t); fd.set("resposta", r);
    start(async () => {
      const res = await responderConfirmacao(fd);
      if (res.erro) return setErro(res.erro);
      setResp(r);
      router.refresh();
    });
  }

  if (resp === "sim") return (
    <div role="status" className="rounded-xl bg-pine-50 px-3 py-3 text-sm">
      <p className="font-bold">✓ Confirmado! Obrigado.</p>
      <p className="text-ink-2">O entregador vai até você no horário combinado.</p>
      <button type="button" className="mt-2 text-xs font-semibold text-pine-700 underline" disabled={pend} onClick={() => responder("nao")}>Mudou de ideia? Não vou estar</button>
    </div>
  );
  if (resp === "nao") return (
    <div role="status" className="rounded-xl bg-kibble-50 px-3 py-3 text-sm">
      <p className="font-bold">Tudo bem, avisamos a loja.</p>
      <p className="text-ink-2">{emRota ? "O entregador vai pular sua parada." : "Seu pedido saiu da rota. A loja vai combinar outro dia com você."}</p>
    </div>
  );
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn-primary" disabled={pend} onClick={() => responder("sim")}>Sim, vou estar</button>
        <button type="button" className="btn-outline" disabled={pend} onClick={() => responder("nao")}>Não vou estar</button>
      </div>
      {erro && <p role="alert" className="text-sm text-oferta">{erro}</p>}
    </div>
  );
}

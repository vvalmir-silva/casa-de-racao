"use client";

import { useState } from "react";
import { FormAction } from "./FormAction";

const rotulos = ["", "Ruim", "Fraco", "Ok", "Bom", "Excelente"];

export function AvaliacaoForm({ pedidoId, action }: { pedidoId: string; action: (fd: FormData) => Promise<{ ok?: true; erro?: string }> }) {
  const [nota, setNota] = useState(0);
  const [enviado, setEnviado] = useState(false);
  if (enviado) {
    return <div className="card text-center"><div className="text-2xl">🐾</div><div className="h2">Obrigado pela avaliação!</div><p className="muted">Sua opinião ajuda a loja a melhorar.</p></div>;
  }
  return (
    <FormAction action={action} onOk={() => setEnviado(true)} className="card space-y-3">
      <div className="h2">Como foi sua compra?</div>
      <input type="hidden" name="pedido_id" value={pedidoId} />
      <input type="hidden" name="nota" value={nota || ""} />
      <div role="radiogroup" aria-label="Nota de 1 a 5" className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={nota === n}
            aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}`}
            onClick={() => setNota(n)}
            className={`grid h-11 w-11 place-items-center rounded-xl text-3xl leading-none transition ${n <= nota ? "text-kibble-500" : "text-ink-4 hover:text-kibble-400"}`}
          >
            ★
          </button>
        ))}
        <span className="ml-2 text-sm font-semibold text-ink-2">{rotulos[nota]}</span>
      </div>
      <div>
        <label htmlFor="comentario" className="label">Conte como foi (opcional)</label>
        <textarea id="comentario" name="comentario" maxLength={500} rows={3} className="input" placeholder="Entrega, atendimento, produtos…" />
      </div>
      <button className="btn-primary w-full" disabled={!nota}>Enviar avaliação</button>
    </FormAction>
  );
}

"use client";

/**
 * Complemento obrigatório, a não ser que o cliente marque que é casa.
 * Evita a dúvida do motorista em prédio/condomínio com vários pedidos no mesmo número.
 */
export function CampoComplemento({ id, valor, semComplemento, onValor, onSem, comNomes }: {
  id: string; valor: string; semComplemento: boolean;
  onValor: (v: string) => void; onSem: (v: boolean) => void; comNomes?: boolean;
}) {
  return (
    <div className="col-span-2 sm:col-span-1">
      <label className="label" htmlFor={id}>Complemento</label>
      <input
        id={id}
        name={comNomes ? "complemento" : undefined}
        className="input disabled:bg-page disabled:text-ink-4"
        placeholder={semComplemento ? "Casa" : "Apto, bloco, casa 2…"}
        value={semComplemento ? "" : valor}
        disabled={semComplemento}
        required={!semComplemento}
        aria-describedby={`${id}-dica`}
        onChange={(e) => onValor(e.target.value)}
      />
      <label className="mt-1.5 flex items-center gap-2 text-[13px] font-semibold text-ink-2">
        <input type="checkbox" name={comNomes ? "sem_complemento" : undefined} checked={semComplemento} onChange={(e) => onSem(e.target.checked)} />
        É casa, sem complemento
      </label>
      <p id={`${id}-dica`} className="sr-only">Informe apartamento e bloco, ou marque que é casa.</p>
    </div>
  );
}

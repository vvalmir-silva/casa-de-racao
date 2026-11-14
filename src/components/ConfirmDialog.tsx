"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Pop-up de confirmação (folha de baixo no celular, janela no desktop). Esc e toque fora fecham. */
export function ConfirmDialog({
  aberto, titulo, children, textoConfirmar = "Confirmar", textoVoltar = "Voltar", perigo = false, carregando = false, erro, onConfirmar, onFechar,
}: {
  aberto: boolean; titulo: string; children?: ReactNode; textoConfirmar?: string; textoVoltar?: string; perigo?: boolean;
  carregando?: boolean; erro?: string; onConfirmar: () => void; onFechar: () => void;
}) {
  const voltar = useRef<HTMLButtonElement>(null);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const anterior = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    voltar.current?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !carregando) onFechar();
      if (e.key === "Tab" && caixa.current) {
        const f = caixa.current.querySelectorAll<HTMLElement>("button:not([disabled])");
        if (!f.length) return;
        const [primeiro, ultimo] = [f[0], f[f.length - 1]];
        if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
        else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
      }
    };
    document.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("keydown", tecla); document.body.style.overflow = overflow; anterior?.focus?.(); };
  }, [aberto, carregando, onFechar]);

  if (!aberto) return null;
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/50 sm:items-center sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !carregando) onFechar(); }}
    >
      <div
        ref={caixa}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-titulo"
        aria-describedby={children ? "confirm-texto" : undefined}
        className="w-full max-w-sm space-y-4 rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-pop sm:rounded-3xl sm:pb-5"
      >
        {perigo && <div className="grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-2xl text-red-600" aria-hidden>!</div>}
        <div className="space-y-1.5">
          <h2 id="confirm-titulo" className="text-lg font-extrabold leading-snug">{titulo}</h2>
          {children && <div id="confirm-texto" className="text-sm text-ink-2">{children}</div>}
        </div>
        {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{erro}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button ref={voltar} type="button" className="btn-ghost w-full sm:w-auto" disabled={carregando} onClick={onFechar}>{textoVoltar}</button>
          <button
            type="button"
            className={`w-full sm:w-auto ${perigo ? "btn-primary !bg-red-600 hover:!bg-red-700" : "btn-primary"}`}
            disabled={carregando}
            onClick={onConfirmar}
          >
            {carregando ? "Aguarde…" : textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}

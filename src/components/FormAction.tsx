"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

type R = { ok?: true; erro?: string } | void;

/** Form que chama uma server action, mostra erro e dá refresh. */
export function FormAction({ action, children, className, onOk, confirmar }: {
  action: (fd: FormData) => Promise<R>; children: ReactNode; className?: string; onOk?: () => void; confirmar?: string;
}) {
  const [erro, setErro] = useState("");
  const [p, start] = useTransition();
  const router = useRouter();
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirmar && !confirm(confirmar)) return;
        const fd = new FormData(e.currentTarget);
        start(async () => {
          setErro("");
          const r = await action(fd);
          if (r && "erro" in r && r.erro) return setErro(r.erro);
          onOk?.();
          router.refresh();
        });
      }}
    >
      <fieldset disabled={p} className="contents">{children}</fieldset>
      {erro && <p className="col-span-full mt-1 text-sm text-red-600">{erro}</p>}
    </form>
  );
}

/** Botão que chama uma server action sem formulário. */
export function BotaoAction({ action, children, className = "btn-outline", confirmar }: {
  action: () => Promise<R>; children: ReactNode; className?: string; confirmar?: string;
}) {
  const [p, start] = useTransition();
  const router = useRouter();
  return (
    <button
      className={className}
      disabled={p}
      onClick={() => {
        if (confirmar && !confirm(confirmar)) return;
        start(async () => { const r = await action(); if (r && "erro" in r && r.erro) alert(r.erro); router.refresh(); });
      }}
    >
      {children}
    </button>
  );
}

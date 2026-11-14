"use client";

import { useCallback, useRef, useState, useTransition, type ReactNode } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import { useRouter } from "next/navigation";

type R = { ok?: true; erro?: string } | void;

/** Form que chama uma server action, mostra erro e dá refresh. */
export function FormAction({ action, children, className, onOk, confirmar }: {
  action: (fd: FormData) => Promise<R>; children: ReactNode; className?: string; onOk?: () => void; confirmar?: string;
}) {
  const [erro, setErro] = useState("");
  const [p, start] = useTransition();
  const [pendente, setPendente] = useState<FormData | null>(null);
  const router = useRouter();
  const executar = (fd: FormData) => start(async () => {
    setErro("");
    const r = await action(fd);
    setPendente(null);
    if (r && "erro" in r && r.erro) return setErro(r.erro);
    onOk?.();
    router.refresh();
  });
  const fechar = useCallback(() => setPendente(null), []);
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        if (confirmar) return setPendente(fd);
        executar(fd);
      }}
    >
      <fieldset disabled={p} className="contents">{children}</fieldset>
      {erro && <p className="col-span-full mt-1 text-sm text-red-600">{erro}</p>}
      {confirmar && (
        <ConfirmDialog aberto={!!pendente} titulo={confirmar} carregando={p} onFechar={fechar} onConfirmar={() => pendente && executar(pendente)} />
      )}
    </form>
  );
}

/** Botão que chama uma server action (referência + args serializáveis) sem formulário. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function BotaoAction<A extends any[]>({ action, args, children, className = "btn-outline", confirmar }: {
  action: (...a: A) => Promise<R>; args: A; children: ReactNode; className?: string; confirmar?: string;
}) {
  const [p, start] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState("");
  const router = useRouter();
  const argsRef = useRef(args);
  argsRef.current = args;
  const executar = () => start(async () => {
    setErro("");
    const r = await action(...argsRef.current);
    if (r && "erro" in r && r.erro) { setErro(r.erro); if (!confirmar) alert(r.erro); return; }
    setAberto(false);
    router.refresh();
  });
  const fechar = useCallback(() => { setAberto(false); setErro(""); }, []);
  const perigo = !!confirmar && /cancel|exclu|desativ|remov/i.test(confirmar);
  return (
    <>
      <button className={className} disabled={p} onClick={() => (confirmar ? setAberto(true) : executar())}>
        {children}
      </button>
      {confirmar && (
        <ConfirmDialog
          aberto={aberto}
          titulo={confirmar}
          perigo={perigo}
          textoConfirmar={perigo ? "Sim, continuar" : "Confirmar"}
          carregando={p}
          erro={erro}
          onFechar={fechar}
          onConfirmar={executar}
        />
      )}
    </>
  );
}

"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { loginAction } from "./actions";

export function LoginForm() {
  const sp = useSearchParams();
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <div className="mx-auto max-w-sm pt-4 sm:pt-10">
      <h1 className="h1 mb-1">Entrar</h1>
      <p className="muted mb-5">Use o telefone cadastrado.</p>
      <form action={action} className="card space-y-4">
        <input type="hidden" name="next" value={sp.get("next") ?? ""} />
        <div><label className="label">Telefone (WhatsApp)</label><input name="telefone" inputMode="tel" required className="input" placeholder="(11) 99999-9999" /></div>
        <div><label className="label">Senha</label><input name="senha" type="password" required className="input" /></div>
        {state?.erro && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{state.erro}</p>}
        <button className="btn-primary w-full" disabled={pending}>{pending ? "Entrando..." : "Entrar"}</button>
        <p className="text-center text-sm text-ink-2">
          Não tem conta? <Link href={`/cadastro?next=${sp.get("next") ?? ""}`} className="font-bold text-pine-700 underline">Cadastre-se</Link>
        </p>
      </form>
    </div>
  );
}

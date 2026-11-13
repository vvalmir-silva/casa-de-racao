"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { loginAction } from "./actions";

export function LoginForm() {
  const sp = useSearchParams();
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-4 text-xl font-bold">Entrar</h1>
      <form action={action} className="card space-y-3">
        <input type="hidden" name="next" value={sp.get("next") ?? ""} />
        <div><label className="label">Telefone (WhatsApp)</label><input name="telefone" inputMode="tel" required className="input" placeholder="(11) 99999-9999" /></div>
        <div><label className="label">Senha</label><input name="senha" type="password" required className="input" /></div>
        {state?.erro && <p className="text-sm text-red-600">{state.erro}</p>}
        <button className="btn-primary w-full" disabled={pending}>{pending ? "Entrando..." : "Entrar"}</button>
        <p className="text-center text-sm text-stone-600">
          Não tem conta? <Link href={`/cadastro?next=${sp.get("next") ?? ""}`} className="text-brand-700 underline">Cadastre-se</Link>
        </p>
      </form>
    </div>
  );
}

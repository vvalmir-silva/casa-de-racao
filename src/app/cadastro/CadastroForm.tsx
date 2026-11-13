"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cadastroAction } from "../login/actions";

export function CadastroForm() {
  const sp = useSearchParams();
  const [state, action, pending] = useActionState(cadastroAction, undefined);
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-4 text-xl font-bold">Criar conta</h1>
      <form action={action} className="card space-y-3">
        <input type="hidden" name="next" value={sp.get("next") ?? ""} />
        <div><label className="label">Nome</label><input name="nome" required className="input" /></div>
        <div><label className="label">Telefone (WhatsApp)</label><input name="telefone" inputMode="tel" required className="input" placeholder="(11) 99999-9999" /></div>
        <div><label className="label">E-mail (opcional)</label><input name="email" type="email" className="input" /></div>
        <div><label className="label">Senha</label><input name="senha" type="password" minLength={6} required className="input" /></div>
        {state?.erro && <p className="text-sm text-red-600">{state.erro}</p>}
        <button className="btn-primary w-full" disabled={pending}>{pending ? "Criando..." : "Criar conta"}</button>
        <p className="text-center text-sm text-stone-600">
          Já tem conta? <Link href="/login" className="text-brand-700 underline">Entrar</Link>
        </p>
      </form>
    </div>
  );
}

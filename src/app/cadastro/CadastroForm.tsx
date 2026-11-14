"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cadastroAction } from "../login/actions";

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function CadastroForm({ convite }: { convite?: { codigo: string; nome: string; desconto: number; minimo: number } | null }) {
  const sp = useSearchParams();
  const [state, action, pending] = useActionState(cadastroAction, undefined);
  return (
    <div className="mx-auto max-w-sm pt-4 sm:pt-10">
      <h1 className="h1 mb-1">Criar conta</h1>
      <p className="muted mb-5">Leva menos de um minuto. Só telefone e senha.</p>
      {convite && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-kibble-50 p-4" role="note" data-testid="convite">
          <span className="text-2xl" aria-hidden>🎁</span>
          <p className="text-sm"><b>{convite.nome} te deu {brl(convite.desconto)}</b> de desconto na primeira compra{convite.minimo > 0 ? ` (a partir de ${brl(convite.minimo)})` : ""}. O cupom aparece sozinho no checkout.</p>
        </div>
      )}
      <form action={action} className="card space-y-4">
        <input type="hidden" name="next" value={sp.get("next") ?? ""} />
        {convite && <input type="hidden" name="ind" value={convite.codigo} />}
        <div><label className="label" htmlFor="cd-nome">Nome</label><input id="cd-nome" name="nome" required className="input" /></div>
        <div><label className="label" htmlFor="cd-telefone-whatsapp">Telefone (WhatsApp)</label><input id="cd-telefone-whatsapp" name="telefone" inputMode="tel" required className="input" placeholder="(11) 99999-9999" /></div>
        <div><label className="label" htmlFor="cd-e-mail-opcional">E-mail (opcional)</label><input id="cd-e-mail-opcional" name="email" type="email" className="input" /></div>
        <div><label className="label" htmlFor="cd-senha">Senha</label><input id="cd-senha" name="senha" type="password" minLength={6} required className="input" /></div>
        {state?.erro && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{state.erro}</p>}
        <button className="btn-primary w-full" disabled={pending}>{pending ? "Criando..." : "Criar conta"}</button>
        <p className="text-center text-sm text-ink-2">
          Já tem conta? <Link href="/login" className="font-bold text-pine-700 underline">Entrar</Link>
        </p>
      </form>
    </div>
  );
}

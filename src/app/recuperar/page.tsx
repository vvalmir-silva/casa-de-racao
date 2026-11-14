"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { solicitarCodigoAction, redefinirSenhaAction, type EstadoRecuperar } from "./actions";

export default function RecuperarPage() {
  const [pedido, pedir, pedindo] = useActionState(solicitarCodigoAction, undefined);
  const [troca, trocar, trocando] = useActionState(redefinirSenhaAction, undefined);
  const [estado, setEstado] = useState<EstadoRecuperar | undefined>(undefined);
  const [pedirDeNovo, setPedirDeNovo] = useState(false);
  useEffect(() => { if (pedido) { setEstado(pedido); setPedirDeNovo(false); } }, [pedido]);
  useEffect(() => { if (troca) setEstado(troca); }, [troca]);

  const naEtapaCodigo = estado?.etapa === "codigo" && !pedirDeNovo;

  return (
    <div className="mx-auto max-w-sm pt-4 sm:pt-10">
      <h1 className="h1 mb-1">Trocar senha</h1>
      <p className="muted mb-5">{naEtapaCodigo ? "Digite o código que chegou no WhatsApp e escolha a nova senha." : "Enviamos um código no WhatsApp do número cadastrado."}</p>

      {!naEtapaCodigo ? (
        <form action={pedir} className="card space-y-4">
          <div><label className="label" htmlFor="tel">Telefone (WhatsApp)</label><input id="tel" name="telefone" inputMode="tel" autoComplete="tel" required className="input" placeholder="(11) 99999-9999" /></div>
          {!pedirDeNovo && estado?.etapa === "telefone" && estado.erro && (
            <div className="rounded-xl bg-kibble-50 px-3 py-2.5 text-sm text-ink">
              {estado.erro}
              {estado.contatoLoja && <a className="mt-2 block font-bold text-pine-700 underline" href={`https://wa.me/${estado.contatoLoja}?text=${encodeURIComponent("Olá! Preciso trocar a senha da minha conta.")}`} target="_blank">Chamar a loja no WhatsApp</a>}
            </div>
          )}
          <button className="btn-primary w-full" disabled={pedindo}>{pedindo ? "Enviando…" : "Enviar código"}</button>
        </form>
      ) : (
        <form action={trocar} className="card space-y-4">
          <input type="hidden" name="telefone" value={estado.telefone} />
          {estado.aviso && !estado.erro && <p className="rounded-xl bg-pine-50 px-3 py-2.5 text-sm text-pine-800">{estado.aviso}</p>}
          <div><label className="label" htmlFor="cod">Código</label><input id="cod" name="codigo" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required className="input text-center text-2xl font-extrabold tracking-[0.4em]" placeholder="000000" /></div>
          <div><label className="label" htmlFor="nova">Nova senha</label><input id="nova" name="senha" type="password" minLength={6} autoComplete="new-password" required className="input" /></div>
          {estado.erro && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{estado.erro}</p>}
          <button className="btn-primary w-full" disabled={trocando}>{trocando ? "Salvando…" : "Salvar nova senha"}</button>
          <button type="button" className="btn-ghost w-full" onClick={() => setPedirDeNovo(true)}>Pedir outro código</button>
        </form>
      )}
      <p className="mt-4 text-center text-sm text-ink-2"><Link href="/login" className="font-bold text-pine-700 underline">Voltar para entrar</Link></p>
    </div>
  );
}

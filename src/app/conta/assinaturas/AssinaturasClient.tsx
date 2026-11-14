"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { brl } from "@/lib/utils";
import { criarAssinatura, alternarAssinatura } from "../actions";

export function AlternarAssinatura({ id, ativa }: { id: string; ativa: boolean }) {
  const [p, start] = useTransition();
  const router = useRouter();
  return (
    <button className="btn-outline" disabled={p} onClick={() => start(async () => { await alternarAssinatura(id, !ativa); router.refresh(); })}>
      {ativa ? "Pausar" : "Reativar"}
    </button>
  );
}

export function AssinaturaForm({ produtos, enderecos }: { produtos: { id: string; nome: string; preco_centavos: number }[]; enderecos: { id: string; apelido: string; logradouro: string; numero: string }[] }) {
  const [erro, setErro] = useState("");
  const [p, start] = useTransition();
  const router = useRouter();
  return (
    <form className="card grid gap-2 sm:grid-cols-2" action={(fd) => start(async () => { const r = await criarAssinatura(fd); if (r?.erro) setErro(r.erro); else router.refresh(); })}>
      <h2 className="col-span-full font-semibold">Nova assinatura</h2>
      <div className="sm:col-span-2"><label className="label" htmlFor="as-produto">Produto</label>
        <select id="as-produto" name="produto_id" className="input" required>{produtos.map((x) => <option key={x.id} value={x.id}>{x.nome} — {brl(x.preco_centavos)}</option>)}</select></div>
      <div><label className="label" htmlFor="as-quantidade">Quantidade</label><input id="as-quantidade" name="qtd" type="number" min={1} defaultValue={1} className="input" /></div>
      <div><label className="label" htmlFor="as-a-cada-dias">A cada (dias)</label>
        <select id="as-a-cada-dias" name="intervalo_dias" className="input" defaultValue={30}><option value={15}>15</option><option value={30}>30</option><option value={45}>45</option><option value={60}>60</option></select></div>
      <div><label className="label" htmlFor="as-endereco">Endereço</label>
        <select id="as-endereco" name="endereco_id" className="input">{enderecos.map((e) => <option key={e.id} value={e.id}>{e.apelido} — {e.logradouro}, {e.numero}</option>)}</select></div>
      <div><label className="label" htmlFor="as-pagamento">Pagamento</label>
        <select id="as-pagamento" name="forma_pagamento" className="input"><option value="pix">PIX</option><option value="dinheiro">Dinheiro na entrega</option><option value="cartao_entrega">Cartão na entrega</option></select></div>
      {erro && <p className="col-span-full text-sm text-red-600">{erro}</p>}
      <div className="col-span-full"><button className="btn-primary" disabled={p}>Assinar</button></div>
    </form>
  );
}

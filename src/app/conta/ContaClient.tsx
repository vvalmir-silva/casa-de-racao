"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { mascaraCep, limparCep } from "@/lib/utils";
import { salvarEndereco, excluirEndereco, cancelarMeuPedido } from "./actions";

export function ExcluirEnderecoBotao({ id }: { id: string }) {
  const [p, start] = useTransition();
  return (
    <button className="text-xs text-red-600" disabled={p} onClick={() => { if (confirm("Excluir endereço?")) start(() => excluirEndereco(id)); }}>
      excluir
    </button>
  );
}

export function EnderecoForm() {
  const [aberto, setAberto] = useState(false);
  const [cep, setCep] = useState("");
  const [auto, setAuto] = useState({ logradouro: "", bairro: "", cidade: "", uf: "" });
  const [erro, setErro] = useState("");
  const [p, start] = useTransition();
  const router = useRouter();

  async function buscarCep(v: string) {
    setCep(mascaraCep(v));
    const c = limparCep(v);
    if (c.length === 8) {
      const r = await fetch(`/api/cep?cep=${c}`);
      if (r.ok) setAuto(await r.json());
    }
  }
  if (!aberto) return <button className="btn-outline mt-2" onClick={() => setAberto(true)}>+ Novo endereço</button>;
  return (
    <form
      className="card mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3"
      action={(fd) => start(async () => {
        const r = await salvarEndereco(fd);
        if (r?.erro) return setErro(r.erro);
        setAberto(false); setCep(""); router.refresh();
      })}
    >
      <div><label className="label">CEP</label><input name="cep" className="input" value={cep} onChange={(e) => buscarCep(e.target.value)} inputMode="numeric" required /></div>
      <div className="col-span-2"><label className="label">Rua</label><input name="logradouro" className="input" defaultValue={auto.logradouro} key={`l${auto.logradouro}`} required /></div>
      <div><label className="label">Número</label><input name="numero" className="input" required /></div>
      <div><label className="label">Complemento</label><input name="complemento" className="input" /></div>
      <div><label className="label">Bairro</label><input name="bairro" className="input" defaultValue={auto.bairro} key={`b${auto.bairro}`} required /></div>
      <div><label className="label">Cidade</label><input name="cidade" className="input" defaultValue={auto.cidade} key={`c${auto.cidade}`} required /></div>
      <div><label className="label">UF</label><input name="uf" className="input" maxLength={2} defaultValue={auto.uf} key={`u${auto.uf}`} required /></div>
      <div><label className="label">Apelido</label><input name="apelido" className="input" defaultValue="Casa" /></div>
      <div className="col-span-2 sm:col-span-3"><label className="label">Referência</label><input name="referencia" className="input" /></div>
      {erro && <p className="col-span-full text-sm text-red-600">{erro}</p>}
      <div className="col-span-full flex gap-2">
        <button className="btn-primary" disabled={p}>Salvar</button>
        <button type="button" className="btn-ghost" onClick={() => setAberto(false)}>Cancelar</button>
      </div>
    </form>
  );
}

export function CancelarPedidoBotao({ id }: { id: string }) {
  const [p, start] = useTransition();
  const [erro, setErro] = useState("");
  const router = useRouter();
  return (
    <div>
      <button className="btn-outline text-red-700" disabled={p} onClick={() => {
        if (!confirm("Cancelar este pedido?")) return;
        start(async () => { const r = await cancelarMeuPedido(id); if (r?.erro) setErro(r.erro); else router.refresh(); });
      }}>Cancelar pedido</button>
      {erro && <p className="mt-1 text-xs text-red-600">{erro}</p>}
    </div>
  );
}

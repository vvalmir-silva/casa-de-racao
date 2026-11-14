"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { mascaraCep } from "@/lib/utils";
import { useBuscaCep } from "@/hooks/useBuscaCep";
import { CepStatus } from "@/components/CepStatus";
import { salvarEndereco, excluirEndereco, cancelarMeuPedido, alternarLembretes } from "./actions";

export function ExcluirEnderecoBotao({ id }: { id: string }) {
  const [p, start] = useTransition();
  return (
    <button className="text-xs text-red-600" disabled={p} onClick={() => { if (confirm("Excluir endereço?")) start(() => excluirEndereco(id)); }}>
      excluir
    </button>
  );
}

export function EnderecoForm() {
  const vazio = { cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "", apelido: "Casa", referencia: "" };
  const [aberto, setAberto] = useState(false);
  const [f, setF] = useState(vazio);
  const [erro, setErro] = useState("");
  const [p, start] = useTransition();
  const numeroRef = useRef<HTMLInputElement>(null);
  const ruaRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const busca = useBuscaCep(aberto ? f.cep : "", (e) => {
    setF((x) => ({ ...x, logradouro: e.logradouro || x.logradouro, bairro: e.bairro || x.bairro, cidade: e.cidade, uf: e.uf }));
    setTimeout(() => (e.logradouro ? numeroRef.current : ruaRef.current)?.focus(), 50);
  });
  const campo = (k: keyof typeof vazio) => ({ name: k, value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: k === "uf" ? e.target.value.toUpperCase() : e.target.value }) });

  if (!aberto) return <button className="btn-outline mt-2" onClick={() => setAberto(true)}>+ Novo endereço</button>;
  return (
    <form
      className="card mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3"
      action={(fd) => start(async () => {
        const r = await salvarEndereco(fd);
        if (r?.erro) return setErro(r.erro);
        setAberto(false); setF(vazio); router.refresh();
      })}
    >
      <div className="col-span-2 sm:col-span-3">
        <label className="label" htmlFor="ce-cep">CEP</label>
        <input id="ce-cep" name="cep" className="input sm:max-w-[220px]" inputMode="numeric" autoComplete="postal-code" maxLength={9} placeholder="00000-000" required value={f.cep} onChange={(e) => setF({ ...f, cep: mascaraCep(e.target.value) })} />
        <CepStatus status={busca.status} endereco={busca.endereco} />
      </div>
      <div className="col-span-2"><label className="label" htmlFor="ce-rua">Rua</label><input id="ce-rua" ref={ruaRef} className="input" required {...campo("logradouro")} /></div>
      <div><label className="label" htmlFor="ce-numero">Número</label><input id="ce-numero" ref={numeroRef} className="input" required {...campo("numero")} /></div>
      <div><label className="label" htmlFor="ce-complemento">Complemento</label><input id="ce-complemento" className="input" {...campo("complemento")} /></div>
      <div><label className="label" htmlFor="ce-bairro">Bairro</label><input id="ce-bairro" className="input" required {...campo("bairro")} /></div>
      <div><label className="label" htmlFor="ce-cidade">Cidade</label><input id="ce-cidade" className="input" required {...campo("cidade")} /></div>
      <div><label className="label" htmlFor="ce-uf">UF</label><input id="ce-uf" className="input" maxLength={2} required {...campo("uf")} /></div>
      <div><label className="label" htmlFor="ce-apelido">Apelido</label><input id="ce-apelido" className="input" {...campo("apelido")} /></div>
      <div className="col-span-2 sm:col-span-3"><label className="label" htmlFor="ce-referencia">Referência</label><input id="ce-referencia" className="input" {...campo("referencia")} /></div>
      {erro && <p className="col-span-full rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{erro}</p>}
      <div className="col-span-full flex gap-2">
        <button className="btn-primary" disabled={p}>Salvar endereço</button>
        <button type="button" className="btn-ghost" onClick={() => { setAberto(false); setF(vazio); }}>Cancelar</button>
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

export function LembretesToggle({ ativo }: { ativo: boolean }) {
  const [p, start] = useTransition();
  const router = useRouter();
  return (
    <button className={ativo ? "btn-outline" : "btn-primary"} disabled={p} onClick={() => start(async () => { await alternarLembretes(!ativo); router.refresh(); })}>
      {ativo ? "Desativar" : "Ativar"}
    </button>
  );
}

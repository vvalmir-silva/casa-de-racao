"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CampoComplemento } from "@/components/CampoComplemento";
import { useRouter } from "next/navigation";
import { mascaraCep } from "@/lib/utils";
import { useBuscaCep } from "@/hooks/useBuscaCep";
import { CepStatus } from "@/components/CepStatus";
import { salvarEndereco, excluirEndereco, cancelarMeuPedido, alternarLembretes } from "./actions";

export function ExcluirEnderecoBotao({ id }: { id: string }) {
  const [p, start] = useTransition();
  const [aberto, setAberto] = useState(false);
  const fechar = useCallback(() => setAberto(false), []);
  return (
    <>
      <button className="text-xs text-red-600" disabled={p} onClick={() => setAberto(true)}>excluir</button>
      <ConfirmDialog
        aberto={aberto}
        perigo
        titulo="Excluir este endereço?"
        textoConfirmar="Sim, excluir"
        carregando={p}
        onFechar={fechar}
        onConfirmar={() => start(async () => { await excluirEndereco(id); setAberto(false); })}
      >
        Assinaturas que usam este endereço serão pausadas.
      </ConfirmDialog>
    </>
  );
}

export function EnderecoForm() {
  const vazio = { cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "", apelido: "Casa", referencia: "" };
  const [semComp, setSemComp] = useState(false);
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
      <CampoComplemento id="ce-complemento" comNomes valor={f.complemento} semComplemento={semComp}
        onValor={(v) => setF({ ...f, complemento: v })} onSem={(v) => { setSemComp(v); if (v) setF({ ...f, complemento: "" }); }} />
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

export function CancelarPedidoBotao({ id, numero, pago }: { id: string; numero?: number; pago?: boolean }) {
  const [p, start] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState("");
  const router = useRouter();
  const fechar = useCallback(() => { setAberto(false); setErro(""); }, []);
  return (
    <>
      <button className="btn-outline w-full text-red-700 sm:w-auto" onClick={() => setAberto(true)}>Cancelar pedido</button>
      <ConfirmDialog
        aberto={aberto}
        perigo
        titulo={`Cancelar o pedido${numero ? ` #${numero}` : ""}?`}
        textoConfirmar="Sim, cancelar"
        textoVoltar="Manter pedido"
        carregando={p}
        erro={erro}
        onFechar={fechar}
        onConfirmar={() => start(async () => {
          const r = await cancelarMeuPedido(id);
          if (r?.erro) return setErro(r.erro);
          setAberto(false);
          router.refresh();
        })}
      >
        <p>O pedido não será entregue e não dá para desfazer.</p>
        {pago && <p className="mt-2 rounded-xl bg-kibble-50 p-2.5 text-ink">Como o PIX já foi pago, fale com a loja pelo WhatsApp para receber o valor de volta.</p>}
      </ConfirmDialog>
    </>
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

"use client";

type FormaPagamento = "pix" | "dinheiro" | "cartao_entrega" | "na_loja";

import { CampoComplemento } from "@/components/CampoComplemento";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useCarrinho } from "@/lib/carrinho";
import { brl, limparCep, mascaraCep } from "@/lib/utils";
import { finalizarPedidoAction } from "./actions";
import { useBuscaCep } from "@/hooks/useBuscaCep";
import { CepStatus } from "@/components/CepStatus";

export type EnderecoSalvo = {
  id: string; apelido: string; cep: string; logradouro: string; numero: string; complemento: string | null;
  bairro: string; cidade: string; uf: string; referencia: string | null; padrao: boolean;
};
type Opcao = { tipo: "retirada" | "rota" | "expresso"; titulo: string; descricao: string; taxa_centavos: number; data_entrega: string | null; janela_id: number | null };
type Frete = { atende: boolean; zona: { nome: string } | null; opcoes: Opcao[] };

const vazio = { apelido: "Casa", cep: "", logradouro: "", numero: "", complemento: "", sem_complemento: false, bairro: "", cidade: "", uf: "", referencia: "" };

export function CheckoutForm({ enderecos, pixChave, lojaEndereco, freteGratisMinimo, regraPagarDepois, prazoRetiradaHoras = 0 }: {
  enderecos: EnderecoSalvo[]; pixChave: string; lojaEndereco: string; freteGratisMinimo: number;
  regraPagarDepois: { liberado: boolean; motivo?: string; valorMax: number }; prazoRetiradaHoras?: number;
}) {
  const { itens, subtotal, peso, pronto, limpar } = useCarrinho();
  const router = useRouter();
  const [enderecoId, setEnderecoId] = useState<string | "novo">(enderecos[0]?.id ?? "novo");
  const [novo, setNovo] = useState({ ...vazio });
  const [salvar, setSalvar] = useState(true);
  const [frete, setFrete] = useState<Frete | null>(null);
  const [carregandoFrete, setCarregandoFrete] = useState(false);
  const [escolha, setEscolha] = useState<string>("");
  const [pagamento, setPagamento] = useState<FormaPagamento>("pix");
  const [troco, setTroco] = useState("");
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState("");
  const [pending, start] = useTransition();
  const [cupomInput, setCupomInput] = useState("");
  const [cupom, setCupom] = useState<{ codigo: string; descricao: string | null; desconto_centavos: number; frete_gratis: boolean } | null>(null);
  const [cupomErro, setCupomErro] = useState("");
  const concluido = useRef(false);
  const escolhaManual = useRef(false);

  // carrinho vazio (e não foi um pedido recém-concluído) → volta pro carrinho
  useEffect(() => {
    if (pronto && itens.length === 0 && !concluido.current) router.replace("/carrinho");
  }, [pronto, itens.length, router]);

  const cepAtual = enderecoId === "novo" ? limparCep(novo.cep) : enderecos.find((e) => e.id === enderecoId)?.cep ?? "";

  // Preenche endereço pelo CEP (ViaCEP → BrasilAPI → OpenCEP)
  const numeroRef = useRef<HTMLInputElement>(null);
  const ruaRef = useRef<HTMLInputElement>(null);
  const busca = useBuscaCep(enderecoId === "novo" ? novo.cep : "", (e) => {
    setNovo((n) => ({ ...n, logradouro: e.logradouro || n.logradouro, bairro: e.bairro || n.bairro, cidade: e.cidade, uf: e.uf }));
    setTimeout(() => (e.logradouro ? numeroRef.current : ruaRef.current)?.focus(), 50);
  });

  // Calcula frete quando CEP/carrinho mudam
  useEffect(() => {
    if (!pronto) return;
    const c = cepAtual;
    setCarregandoFrete(true);
    const url = c.length === 8 ? `/api/frete?cep=${c}&subtotal=${subtotal}&peso=${peso}` : `/api/frete?cep=&subtotal=${subtotal}&peso=${peso}`;
    fetch(url).then((r) => r.json()).then((f: Frete) => {
      setFrete(f);
      setEscolha((e) => {
        const padrao = chave(f.opcoes.find((o) => o.tipo === "rota") ?? f.opcoes[0]);
        if (!escolhaManual.current) return padrao;
        return f.opcoes.some((o) => chave(o) === e) ? e : padrao;
      });
    }).finally(() => setCarregandoFrete(false));
  }, [cepAtual, subtotal, peso, pronto]);

  const opcao = useMemo(() => frete?.opcoes.find((o) => chave(o) === escolha) ?? null, [frete, escolha]);
  // troca de entrega ↔ retirada: forma de pagamento que não vale mais volta para PIX
  useEffect(() => {
    if (!opcao) return;
    const ok = opcao.tipo === "retirada" ? ["pix", "na_loja"] : ["pix", "dinheiro", "cartao_entrega"];
    if (!ok.includes(pagamento)) setPagamento("pix");
  }, [opcao, pagamento]);
  const freteBase = opcao?.taxa_centavos ?? 0;
  const freteFinal = cupom?.frete_gratis ? 0 : freteBase;
  const desconto = cupom && !cupom.frete_gratis ? cupom.desconto_centavos : 0;
  const total = Math.max(0, subtotal + freteFinal - desconto);
  const bloqueioPagarDepois = !regraPagarDepois.liberado
    ? regraPagarDepois.motivo ?? "Por enquanto, só PIX pelo app."
    : regraPagarDepois.valorMax > 0 && total > regraPagarDepois.valorMax
      ? `Pedidos acima de ${brl(regraPagarDepois.valorMax)} são pagos por PIX pelo app.`
      : null;

  async function aplicarCupom() {
    setCupomErro("");
    const r = await fetch(`/api/cupom?codigo=${encodeURIComponent(cupomInput)}&subtotal=${subtotal}&frete=${freteBase}`);
    const j = await r.json();
    if (!r.ok) { setCupom(null); return setCupomErro(j.erro ?? "Cupom inválido"); }
    setCupom(j);
  }
  const faltaGratis = freteGratisMinimo - subtotal;

  // pagar depois bloqueado (1º pedido, valor alto ou faltas): volta para PIX
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => { if (bloqueioPagarDepois && pagamento !== "pix") setPagamento("pix"); }, [bloqueioPagarDepois, pagamento]);

  if (!pronto || itens.length === 0) return null;

  const retirada = opcao?.tipo === "retirada";
  const opcoesPagamento: [FormaPagamento, string, string][] = retirada
    ? [["pix", "PIX pelo app", "Paga agora e só retira"], ["na_loja", "Pagar na loja", `Dinheiro, cartão ou PIX no balcão${prazoRetiradaHoras ? ` · retire em até ${prazoRetiradaHoras}h` : ""}`]]
    : [["pix", "PIX pelo app", "Confirmação na hora"], ["dinheiro", "Dinheiro na entrega", "Avise se precisa de troco"], ["cartao_entrega", "Cartão na entrega", "Débito ou crédito na maquininha"]];

  function enviar() {
    setErro("");
    if (!opcao) return setErro("Escolha uma forma de entrega.");
    if (opcao.tipo !== "retirada" && enderecoId === "novo" && !novo.complemento.trim() && !novo.sem_complemento) {
      document.getElementById("ck-complemento")?.focus();
      return setErro("Informe o complemento (apto, bloco) ou marque “É casa, sem complemento”.");
    }
    const payload = {
      itens: itens.map((i) => ({ id: i.id, qtd: i.qtd })),
      tipo_entrega: opcao.tipo,
      janela_id: opcao.janela_id,
      endereco_id: opcao.tipo !== "retirada" && enderecoId !== "novo" ? enderecoId : null,
      endereco_novo: opcao.tipo !== "retirada" && enderecoId === "novo" ? { ...novo, cep: limparCep(novo.cep) } : null,
      salvar_endereco: salvar,
      forma_pagamento: pagamento,
      troco_para_centavos: pagamento === "dinheiro" && troco ? Math.round(Number(troco.replace(",", ".")) * 100) : null,
      observacoes: obs,
      cupom: cupom?.codigo ?? "",
    };
    start(async () => {
      const r = await finalizarPedidoAction(payload);
      if (!r.ok) return setErro(r.erro);
      concluido.current = true;
      router.push(`/conta/pedido/${r.id}?novo=1`);
      limpar();
    });
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_340px]">
      <div className="space-y-5">
        {/* Endereço */}
        <section className="card space-y-3">
          <h2 className="h2">Endereço de entrega</h2>
          {enderecos.length > 0 && (
            <div className="space-y-2">
              {enderecos.map((e) => (
                <label key={e.id} className={`flex cursor-pointer gap-3 rounded-2xl border-2 p-3.5 text-sm ${enderecoId === e.id ? "border-pine-700 bg-pine-50" : "border-page bg-page"}`}>
                  <input type="radio" name="end" checked={enderecoId === e.id} onChange={() => setEnderecoId(e.id)} />
                  <div><b>{e.apelido}</b> · {e.logradouro}, {e.numero}{e.complemento ? ` - ${e.complemento}` : ""} · {e.bairro} · {mascaraCep(e.cep)}</div>
                </label>
              ))}
              <label className={`flex cursor-pointer gap-3 rounded-2xl border-2 p-3.5 text-sm ${enderecoId === "novo" ? "border-pine-700 bg-pine-50" : "border-page bg-page"}`}>
                <input type="radio" name="end" checked={enderecoId === "novo"} onChange={() => setEnderecoId("novo")} />
                <div>Novo endereço</div>
              </label>
            </div>
          )}
          {enderecoId === "novo" && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="col-span-2 sm:col-span-3">
                <label className="label" htmlFor="ck-cep">CEP</label>
                <input id="ck-cep" className="input sm:max-w-[220px]" inputMode="numeric" autoComplete="postal-code" maxLength={9} placeholder="00000-000" value={novo.cep} onChange={(e) => setNovo({ ...novo, cep: mascaraCep(e.target.value) })} />
                <CepStatus status={busca.status} endereco={busca.endereco} />
              </div>
              <div className="col-span-2"><label className="label" htmlFor="ck-rua">Rua</label><input id="ck-rua" ref={ruaRef} className="input" autoComplete="address-line1" value={novo.logradouro} onChange={(e) => setNovo({ ...novo, logradouro: e.target.value })} /></div>
              <div><label className="label" htmlFor="ck-numero">Número</label><input id="ck-numero" ref={numeroRef} className="input" inputMode="numeric" value={novo.numero} onChange={(e) => setNovo({ ...novo, numero: e.target.value })} /></div>
              <CampoComplemento id="ck-complemento" valor={novo.complemento} semComplemento={novo.sem_complemento}
                onValor={(v) => setNovo({ ...novo, complemento: v })} onSem={(v) => setNovo({ ...novo, sem_complemento: v, complemento: v ? "" : novo.complemento })} />
              <div><label className="label" htmlFor="ck-bairro">Bairro</label><input id="ck-bairro" className="input" value={novo.bairro} onChange={(e) => setNovo({ ...novo, bairro: e.target.value })} /></div>
              <div><label className="label" htmlFor="ck-cidade">Cidade</label><input id="ck-cidade" className="input" value={novo.cidade} onChange={(e) => setNovo({ ...novo, cidade: e.target.value })} /></div>
              <div><label className="label" htmlFor="ck-uf">UF</label><input id="ck-uf" className="input" maxLength={2} value={novo.uf} onChange={(e) => setNovo({ ...novo, uf: e.target.value.toUpperCase() })} /></div>
              <div><label className="label" htmlFor="ck-apelido">Apelido</label><input id="ck-apelido" className="input" value={novo.apelido} onChange={(e) => setNovo({ ...novo, apelido: e.target.value })} /></div>
              <div className="col-span-2 sm:col-span-3"><label className="label" htmlFor="ck-referencia">Referência</label><input id="ck-referencia" className="input" value={novo.referencia} onChange={(e) => setNovo({ ...novo, referencia: e.target.value })} /></div>
              <label className="col-span-2 flex items-center gap-2 text-sm sm:col-span-3"><input type="checkbox" checked={salvar} onChange={(e) => setSalvar(e.target.checked)} /> Salvar este endereço</label>
            </div>
          )}
        </section>

        {/* Entrega */}
        <section className="card space-y-3">
          <h2 className="h2">Quando entregar</h2>
          {carregandoFrete && <p className="muted">Calculando...</p>}
          {frete && cepAtual.length === 8 && !frete.atende && (
            <p className="rounded-xl bg-kibble-50 p-3 text-sm text-ink">Ainda não entregamos neste CEP. Você pode retirar na loja.</p>
          )}
          {frete && cepAtual.length !== 8 && (
            <p className="muted">Informe o CEP para ver as opções de entrega.</p>
          )}
          {faltaGratis > 0 && frete?.atende && (
            <p className="muted">Faltam {brl(faltaGratis)} para frete grátis em rota.</p>
          )}
          <div className="space-y-2">
            {frete?.opcoes.map((o) => (
              <label key={chave(o)} className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-3.5 text-sm ${escolha === chave(o) ? "border-pine-700 bg-pine-50" : "border-page bg-page"}`}>
                <input type="radio" name="ent" checked={escolha === chave(o)} onChange={() => { escolhaManual.current = true; setEscolha(chave(o)); }} className="mt-1" />
                <div className="flex-1">
                  <div className="font-bold">{o.titulo}</div>
                  <div className="muted">{o.tipo === "retirada" ? lojaEndereco : o.descricao}</div>
                </div>
                <div className="font-extrabold">{o.taxa_centavos === 0 ? "Grátis" : brl(o.taxa_centavos)}</div>
              </label>
            ))}
          </div>
        </section>

        {/* Pagamento */}
        <section className="card space-y-3">
          <h2 className="h2">Pagamento</h2>
          {retirada && <p className="-mt-1 text-sm text-ink-3">Você vai retirar na loja: pague agora pelo app ou na hora de retirar.</p>}
          <div role="radiogroup" aria-label="Forma de pagamento" className={`grid gap-2 ${opcoesPagamento.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            {opcoesPagamento.map(([v, l, d]) => {
              const travado = v !== "pix" && !!bloqueioPagarDepois;
              return (
              <label key={v} className={`flex flex-col rounded-2xl border-2 p-3.5 text-sm transition-colors ${travado ? "cursor-not-allowed border-page bg-page opacity-50" : pagamento === v ? "cursor-pointer border-pine-700 bg-pine-50" : "cursor-pointer border-page bg-page hover:border-line-2"}`}>
                <input type="radio" name="forma_pagamento" className="sr-only" checked={pagamento === v} disabled={travado} onChange={() => setPagamento(v)} />
                <span className="font-bold text-ink">{l}</span>
                <span className="text-[12.5px] text-ink-3">{d}</span>
              </label>
              );
            })}
          </div>
          {bloqueioPagarDepois && <p role="note" className="rounded-xl bg-kibble-50 px-3 py-2 text-sm text-ink">{bloqueioPagarDepois}</p>}
          {pagamento === "pix" && pixChave && (
            <p className="text-sm text-ink-2">Chave PIX: <b>{pixChave}</b>. O pedido é confirmado após o pagamento.</p>
          )}
          {pagamento === "dinheiro" && (
            <div><label className="label" htmlFor="ck-troco-para-r-opcional">Troco para (R$, opcional)</label><input id="ck-troco-para-r-opcional" className="input" inputMode="decimal" value={troco} onChange={(e) => setTroco(e.target.value)} placeholder="ex.: 200" /></div>
          )}
          <div><label className="label" htmlFor="ck-observacoes">Observações</label><textarea id="ck-observacoes" className="input" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Portão azul, deixar com o porteiro..." /></div>
        </section>
      </div>

      <aside className="card h-fit space-y-3 md:sticky md:top-20">
        <h2 className="h2">Resumo</h2>
        <ul className="space-y-1 text-sm">
          {itens.map((i) => (
            <li key={i.id} className="flex justify-between gap-2"><span className="truncate">{i.qtd}× {i.nome}</span><span>{brl(i.preco_centavos * i.qtd)}</span></li>
          ))}
        </ul>
        <div className="border-t pt-2">
          {cupom ? (
            <div className="flex items-center justify-between rounded-xl bg-pine-50 p-2.5 text-sm text-pine-800">
              <span>🎟️ {cupom.codigo}{cupom.descricao ? ` · ${cupom.descricao}` : ""}</span>
              <button className="text-xs underline" onClick={() => { setCupom(null); setCupomInput(""); }}>remover</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input className="input py-1.5 uppercase" placeholder="Cupom" value={cupomInput} onChange={(e) => setCupomInput(e.target.value.toUpperCase())} />
              <button className="btn-outline py-1.5" onClick={aplicarCupom} disabled={!cupomInput}>Aplicar</button>
            </div>
          )}
          {cupomErro && <p className="mt-1 text-xs text-red-600">{cupomErro}</p>}
        </div>
        <div className="border-t pt-2 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{brl(subtotal)}</span></div>
          <div className="flex justify-between"><span>Frete</span><span>{opcao ? (freteFinal === 0 ? "Grátis" : brl(freteFinal)) : "—"}</span></div>
          {desconto > 0 && <div className="flex justify-between text-green-700"><span>Desconto</span><span>−{brl(desconto)}</span></div>}
          <div className="mt-1 flex justify-between text-lg font-extrabold"><span>Total</span><span>{brl(total)}</span></div>
        </div>
        {erro && <p className="rounded-xl bg-red-50 p-2.5 text-sm font-semibold text-red-700">{erro}</p>}
        <button className="btn-primary hidden w-full md:flex" disabled={pending || !opcao || carregandoFrete} onClick={enviar}>
          {pending ? "Enviando..." : "Confirmar pedido"}
        </button>
      </aside>

      {/* barra fixa no celular */}
      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-line bg-white p-3 md:hidden">
        {erro && <p className="mb-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">{erro}</p>}
        <div className="flex items-center gap-3">
          <div><div className="muted">Total</div><div className="text-lg font-extrabold">{brl(total)}</div></div>
          <button className="btn-primary flex-1" disabled={pending || !opcao || carregandoFrete} onClick={enviar}>
            {pending ? "Enviando..." : "Confirmar pedido"}
          </button>
        </div>
      </div>
      <div className="h-20 md:hidden" />
    </div>
  );
}

function chave(o: Opcao | undefined) {
  return o ? `${o.tipo}:${o.janela_id ?? ""}` : "";
}

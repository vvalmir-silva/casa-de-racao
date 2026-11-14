"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { analisarPlanilha, importarPlanilha, type ResultadoPlanilha } from "./planilha-actions";

const COR = { novo: "bg-green-100 text-green-800", atualizar: "bg-pine-100 text-pine-800", erro: "bg-red-100 text-red-800" } as const;
const ROTULO = { novo: "novo", atualizar: "atualizar", erro: "erro" } as const;

/** Importa/atualiza produtos de uma planilha: escolhe o arquivo → confere a prévia → importa. */
export function ImportarPlanilha() {
  const [aberto, setAberto] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [res, setRes] = useState<ResultadoPlanilha | null>(null);
  const [feito, setFeito] = useState<ResultadoPlanilha["importados"] | null>(null);
  const [p, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const fd = () => { const f = new FormData(); if (arquivo) f.append("arquivo", arquivo); return f; };
  const conferir = (f: File) => { setArquivo(f); setFeito(null); start(async () => { const x = new FormData(); x.append("arquivo", f); setRes(await analisarPlanilha(x)); }); };
  const importar = () => start(async () => {
    const r = await importarPlanilha(fd());
    setRes(r);
    if (r.importados) { setFeito(r.importados); router.refresh(); }
  });
  const limpar = () => { setArquivo(null); setRes(null); setFeito(null); if (input.current) input.current.value = ""; };

  if (!aberto) return <button className="btn-outline" onClick={() => setAberto(true)}>📄 Importar planilha</button>;

  const linhas = res?.linhas ?? [];
  const n = { novo: linhas.filter((l) => l.acao === "novo").length, atualizar: linhas.filter((l) => l.acao === "atualizar").length, erro: linhas.filter((l) => l.acao === "erro").length };
  const ok = n.novo + n.atualizar;

  return (
    <section className="card order-last w-full basis-full space-y-4" aria-labelledby="imp-titulo">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="imp-titulo" className="h2">Importar produtos por planilha</h2>
          <p className="muted">Cadastre ou atualize vários produtos de uma vez (preço, estoque, oferta…). Nada é gravado antes de você conferir.</p>
        </div>
        <button className="btn-ghost shrink-0" onClick={() => { limpar(); setAberto(false); }}>Fechar</button>
      </div>

      <ol className="grid gap-3 text-sm sm:grid-cols-3">
        <li className="rounded-2xl bg-page p-3">
          <b className="block">1. Baixe o modelo</b>
          <span className="text-ink-3">Já vem com os produtos atuais. Edite no Excel ou Google Planilhas.</span>
          <a href="/admin/produtos/planilha" className="mt-2 inline-flex font-bold text-pine-700 underline" download>Baixar planilha (.csv)</a>
        </li>
        <li className="rounded-2xl bg-page p-3">
          <b className="block">2. Preencha</b>
          <span className="text-ink-3">Obrigatórios para produto novo: <b>nome, categoria, preco</b>. Preço como 79,90. Ativo/destaque: sim ou não. Deixe “codigo” vazio em produtos novos.</span>
        </li>
        <li className="rounded-2xl bg-page p-3">
          <b className="block">3. Envie e confira</b>
          <label className="mt-2 block">
            <span className="sr-only">Arquivo da planilha</span>
            <input ref={input} type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-pine-700 file:px-4 file:py-2 file:font-bold file:text-white"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) conferir(f); }} />
          </label>
        </li>
      </ol>

      {p && <p className="text-sm font-semibold text-pine-700" role="status">{feito === null && res === null ? "Lendo a planilha…" : "Processando…"}</p>}
      {res?.erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{res.erro}</p>}

      {feito && (
        <div role="status" className="rounded-2xl bg-green-50 p-4 text-green-900">
          <b>Pronto! {feito.novos} {feito.novos === 1 ? "produto novo" : "produtos novos"} e {feito.atualizados} {feito.atualizados === 1 ? "atualizado" : "atualizados"}.</b>
          {n.erro > 0 && <div className="text-sm">{n.erro} {n.erro === 1 ? "linha ficou" : "linhas ficaram"} de fora por erro (veja abaixo).</div>}
          <button className="btn-outline mt-2" onClick={limpar}>Importar outra planilha</button>
        </div>
      )}

      {linhas.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className={`badge ${COR.novo}`}>{n.novo} novos</span>
            <span className={`badge ${COR.atualizar}`}>{n.atualizar} para atualizar</span>
            <span className={`badge ${COR.erro}`}>{n.erro} com erro</span>
            {!feito && (
              <button className="btn-primary ml-auto" disabled={p || ok === 0} onClick={importar}>
                {p ? "Importando…" : `Importar ${ok} ${ok === 1 ? "produto" : "produtos"}`}
              </button>
            )}
          </div>
          {n.erro > 0 && !feito && <p className="text-sm text-ink-3">Linhas com erro não entram. Corrija na planilha e envie de novo, ou importe só as válidas.</p>}
          <div className="max-h-[420px] overflow-auto rounded-2xl border border-line">
            <table className="table">
              <thead className="sticky top-0 bg-white"><tr><th>Linha</th><th>Produto</th><th>Ação</th><th>Detalhes</th></tr></thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.linha} className={l.acao === "erro" ? "bg-red-50/50" : ""}>
                    <td className="text-ink-3">{l.linha}</td>
                    <td className="font-semibold">{l.nome}</td>
                    <td><span className={`badge ${COR[l.acao]}`}>{ROTULO[l.acao]}</span></td>
                    <td className="text-xs">
                      {l.erros.map((e) => <div key={e} className="text-red-700">• {e}</div>)}
                      {l.avisos.map((a) => <div key={a} className="text-ink-3">• {a}</div>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

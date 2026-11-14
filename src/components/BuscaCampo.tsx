"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IconSearch } from "./Icons";
import { brl } from "@/lib/utils";

type Sugestao = { slug: string; nome: string; marca: string | null; preco_centavos: number; imagem_url: string | null; estoque: number };

/** Campo de busca com sugestões enquanto digita (combobox acessível). */
export function BuscaCampo({ className = "" }: { className?: string }) {
  const sp = useSearchParams();
  const router = useRouter();
  const inicial = sp.get("q") ?? "";
  const [q, setQ] = useState(inicial);
  const [itens, setItens] = useState<Sugestao[]>([]);
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  const [carregando, setCarregando] = useState(false);
  const lista = useId();
  const caixa = useRef<HTMLFormElement>(null);
  const ultimo = useRef(0);
  const [tocado, setTocado] = useState(false); // só busca sugestões depois que a pessoa mexe no campo

  useEffect(() => { setQ(inicial); }, [inicial]);

  useEffect(() => {
    const termo = q.trim();
    if (!tocado) return;
    if (termo.length < 2) { setItens([]); setCarregando(false); return; }
    setCarregando(true);
    const id = ++ultimo.current;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/busca?q=${encodeURIComponent(termo)}`);
        const j = (await r.json()) as { itens: Sugestao[] };
        if (id === ultimo.current) { setItens(j.itens); setAtivo(-1); }
      } catch {
        if (id === ultimo.current) setItens([]);
      } finally {
        if (id === ultimo.current) setCarregando(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [q, tocado]);

  useEffect(() => {
    const fora = (e: MouseEvent) => { if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false); };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  const ir = (slug?: string) => {
    setAberto(false);
    (document.activeElement as HTMLElement | null)?.blur();
    if (slug) return router.push(`/produto/${slug}`);
    const termo = q.trim();
    router.push(termo ? `/?q=${encodeURIComponent(termo)}` : "/");
  };

  const mostrar = aberto && q.trim().length >= 2 && (itens.length > 0 || !carregando);

  return (
    <form
      ref={caixa}
      role="search"
      className={`relative ${className}`}
      onSubmit={(e) => { e.preventDefault(); ir(ativo >= 0 ? itens[ativo]?.slug : undefined); }}
    >
      <IconSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" width={18} height={18} />
      <input
        name="q"
        value={q}
        onChange={(e) => { setQ(e.target.value); setTocado(true); setAberto(true); }}
        onFocus={() => { setTocado(true); setAberto(true); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setAberto(true); setAtivo((a) => Math.min(a + 1, itens.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setAtivo((a) => Math.max(a - 1, -1)); }
          else if (e.key === "Escape") { setAberto(false); setAtivo(-1); }
        }}
        placeholder="Buscar ração, marca, petisco…"
        aria-label="Buscar"
        role="combobox"
        aria-expanded={mostrar}
        aria-controls={lista}
        aria-autocomplete="list"
        aria-activedescendant={ativo >= 0 ? `${lista}-${ativo}` : undefined}
        autoComplete="off"
        enterKeyHint="search"
        className="h-12 w-full rounded-full border border-transparent bg-page pl-11 pr-10 text-[15px] font-medium outline-none transition placeholder:text-ink-4 focus:border-pine-500 focus:bg-white focus:ring-4 focus:ring-pine-50"
      />
      {q && (
        <button type="button" aria-label="Limpar busca" onClick={() => { setQ(""); setItens([]); setAberto(false); }}
          className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-ink-3 hover:bg-line">✕</button>
      )}
      {mostrar && (
        <div className="absolute inset-x-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-2xl border border-line bg-white shadow-pop">
          {itens.length === 0 ? (
            <p className="px-4 py-3 text-sm text-ink-3">Nada com “{q.trim()}”. Tente a marca ou o tipo do pet.</p>
          ) : (
            <ul id={lista} role="listbox" aria-label="Sugestões">
              {itens.map((s, i) => (
                <li key={s.slug} id={`${lista}-${i}`} role="option" aria-selected={i === ativo}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => ir(s.slug)}
                    onMouseEnter={() => setAtivo(i)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left ${i === ativo ? "bg-pine-50" : ""}`}
                  >
                    <span className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-page">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {s.imagem_url ? <img src={s.imagem_url} alt="" className="h-full w-full object-cover" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink">{s.nome}</span>
                      <span className="block text-xs text-ink-3">{s.marca ?? ""}{s.estoque <= 0 ? " · esgotado" : ""}</span>
                    </span>
                    <span className="text-sm font-extrabold">{brl(s.preco_centavos)}</span>
                  </button>
                </li>
              ))}
              <li role="option" aria-selected={false}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => ir()} className="w-full border-t border-line px-4 py-2.5 text-left text-sm font-bold text-pine-700">
                  Ver todos os resultados para “{q.trim()}”
                </button>
              </li>
            </ul>
          )}
        </div>
      )}
    </form>
  );
}

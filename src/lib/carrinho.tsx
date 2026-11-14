"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { carregarCarrinho, salvarCarrinho } from "@/app/carrinho-actions";

export type ItemCarrinho = {
  id: string;
  slug: string;
  nome: string;
  preco_centavos: number;
  peso_kg: number;
  estoque: number;
  imagem_url: string | null;
  qtd: number;
};

type Ctx = {
  itens: ItemCarrinho[];
  adicionar: (p: Omit<ItemCarrinho, "qtd">, qtd?: number) => void;
  alterar: (id: string, qtd: number) => void;
  remover: (id: string) => void;
  limpar: () => void;
  subtotal: number;
  peso: number;
  quantidade: number;
  pronto: boolean;
};

const CarrinhoCtx = createContext<Ctx | null>(null);
const KEY = "cr_carrinho_v1";

export function CarrinhoProvider({ children, logado = false }: { children: ReactNode; logado?: boolean }) {
  const [itens, setItens] = useState<ItemCarrinho[]>([]);
  const [pronto, setPronto] = useState(false);
  const sincronizado = useRef(false);
  const carregando = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItens(JSON.parse(raw));
    } catch {}
    setPronto(true);
  }, []);

  useEffect(() => {
    if (!pronto) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(itens));
    } catch {}
  }, [itens, pronto]);

  // Cliente logado: se este aparelho está vazio, traz o carrinho salvo (de outro aparelho ou do lembrete)
  useEffect(() => {
    if (!pronto || !logado) { sincronizado.current = false; return; }
    if (sincronizado.current) return;
    sincronizado.current = true;
    if (itens.length > 0) return;
    carregando.current = true;
    carregarCarrinho().then((salvos) => {
      if (salvos.length) setItens((cur) => (cur.length ? cur : salvos.map((s) => ({ ...s, peso_kg: Number(s.peso_kg) }))));
    }).catch(() => {}).finally(() => { carregando.current = false; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto, logado]);

  // ...e guarda cada mudança no servidor (1,5s depois da última)
  useEffect(() => {
    if (!pronto || !logado || !sincronizado.current) return;
    const t = setTimeout(() => {
      if (carregando.current && itens.length === 0) return; // ainda trazendo o carrinho salvo: não apaga
      salvarCarrinho(itens.map((i) => ({ id: i.id, qtd: i.qtd }))).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [itens, pronto, logado]);

  const api = useMemo<Ctx>(() => {
    const subtotal = itens.reduce((s, i) => s + i.preco_centavos * i.qtd, 0);
    const peso = itens.reduce((s, i) => s + Number(i.peso_kg) * i.qtd, 0);
    const quantidade = itens.reduce((s, i) => s + i.qtd, 0);
    return {
      itens,
      subtotal,
      peso,
      quantidade,
      pronto,
      adicionar: (p, qtd = 1) =>
        setItens((cur) => {
          const ex = cur.find((i) => i.id === p.id);
          if (ex) return cur.map((i) => (i.id === p.id ? { ...i, qtd: Math.min(i.qtd + qtd, p.estoque) } : i));
          return [...cur, { ...p, qtd: Math.min(qtd, p.estoque) }];
        }),
      alterar: (id, qtd) =>
        setItens((cur) => cur.map((i) => (i.id === id ? { ...i, qtd: Math.max(1, Math.min(qtd, i.estoque)) } : i))),
      remover: (id) => setItens((cur) => cur.filter((i) => i.id !== id)),
      limpar: () => setItens([]),
    };
  }, [itens, pronto]);

  return <CarrinhoCtx.Provider value={api}>{children}</CarrinhoCtx.Provider>;
}

export function useCarrinho() {
  const c = useContext(CarrinhoCtx);
  if (!c) throw new Error("useCarrinho fora do CarrinhoProvider");
  return c;
}

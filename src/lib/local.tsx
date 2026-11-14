"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/** Resultado da consulta de entrega para o CEP informado nesta visita (não é salvo). */
export type Local = { cep: string; atende: boolean; bairro?: string; zona?: string; rotulo?: string; taxa?: number } | null;

type Ctx = { local: Local; setLocal: (l: Local) => void; aberto: boolean; abrir: () => void; fechar: () => void };
const LocalCtx = createContext<Ctx | null>(null);

export function LocalProvider({ children }: { children: ReactNode }) {
  const [local, setLocal] = useState<Local>(null);
  const [aberto, setAberto] = useState(false);
  return (
    <LocalCtx.Provider value={{ local, setLocal, aberto, abrir: () => setAberto(true), fechar: () => setAberto(false) }}>
      {children}
    </LocalCtx.Provider>
  );
}

export function useLocal() {
  const c = useContext(LocalCtx);
  if (!c) throw new Error("useLocal fora do LocalProvider");
  return c;
}

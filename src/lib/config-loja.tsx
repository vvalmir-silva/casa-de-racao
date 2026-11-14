"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ConfigParcelas } from "./ofertas";

/** Configurações públicas da loja que os componentes do cliente precisam (parcelamento etc.). */
export type ConfigLoja = ConfigParcelas & { freteGratis: number; logado: boolean };
const Ctx = createContext<ConfigLoja>({ parcelasMax: 1, parcelaMin: 3000, freteGratis: 15000, logado: false });

export function ConfigLojaProvider({ valor, children }: { valor: ConfigLoja; children: ReactNode }) {
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
export const useConfigLoja = () => useContext(Ctx);


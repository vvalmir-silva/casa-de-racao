/** Regras de exibição de oferta e parcelamento (puras: servem no servidor e no navegador). */
export type ConfigParcelas = { parcelasMax: number; parcelaMin: number };

/** Quantas parcelas sem juros mostrar para um preço (0 = não mostra). */
export function parcelas(preco: number, c: ConfigParcelas) {
  if (c.parcelasMax < 2) return 0;
  const n = Math.min(c.parcelasMax, Math.floor(preco / Math.max(1, c.parcelaMin)));
  return n >= 2 ? n : 0;
}

export const descontoPct = (de: number | null | undefined, por: number) => (de && de > por ? Math.round((1 - por / de) * 100) : 0);

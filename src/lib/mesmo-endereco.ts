/** Agrupa entregas que vão para o mesmo endereço (CEP + número), para o motorista não trocar sacolas. */
type ComEndereco = { id: string; numero: number; endereco: Record<string, string> | null };

export function chaveEndereco(e: Record<string, string> | null) {
  if (!e) return "";
  const cep = String(e.cep ?? "").replace(/\D/g, "");
  const num = String(e.numero ?? "").toLowerCase().replace(/[^0-9a-z]/g, "");
  return cep && num ? `${cep}:${num}` : "";
}

/** Para cada pedido, os outros pedidos da lista no mesmo endereço (vazio se não houver). */
export function vizinhosDeEndereco<T extends ComEndereco>(lista: T[]) {
  const grupos = new Map<string, T[]>();
  for (const p of lista) {
    const k = chaveEndereco(p.endereco);
    if (!k) continue;
    grupos.set(k, [...(grupos.get(k) ?? []), p]);
  }
  const out = new Map<string, T[]>();
  for (const g of grupos.values()) if (g.length > 1) for (const p of g) out.set(p.id, g.filter((x) => x.id !== p.id));
  return out;
}

export const rotuloComplemento = (e: Record<string, string> | null) => (e?.complemento?.trim() ? e.complemento.trim() : "Sem complemento");

import { sql } from "./db";

export type Cupom = {
  id: number; codigo: string; descricao: string | null; tipo: "percentual" | "fixo" | "frete_gratis"; valor: number;
  minimo_centavos: number; primeira_compra: boolean; limite_usos: number | null; usos: number; valido_ate: string | null; ativo: boolean;
  usuario_id?: string | null; origem?: string | null;
};

export type ResultadoCupom = { ok: true; cupom: Cupom; desconto_centavos: number; frete_gratis: boolean } | { ok: false; erro: string };

export function normalizarCodigo(c: string) {
  return c.trim().toUpperCase().replace(/\s+/g, "");
}

/** Valida e calcula o desconto. frete_centavos é o frete antes do cupom. */
export async function validarCupom(codigo: string, clienteId: string | null, subtotal: number, frete_centavos: number): Promise<ResultadoCupom> {
  const cod = normalizarCodigo(codigo);
  if (!cod) return { ok: false, erro: "Informe o código." };
  const rows = (await sql`SELECT *, valido_ate::text FROM cupons WHERE codigo = ${cod}`) as Cupom[];
  const c = rows[0];
  if (!c || !c.ativo) return { ok: false, erro: "Cupom inválido." };
  if (c.usuario_id && c.usuario_id !== clienteId) return { ok: false, erro: clienteId ? "Este cupom é de outra conta." : "Faça login para usar este cupom." };
  if (c.valido_ate && c.valido_ate < new Date().toISOString().slice(0, 10)) return { ok: false, erro: "Cupom expirado." };
  if (c.limite_usos !== null && c.usos >= c.limite_usos) return { ok: false, erro: "Cupom esgotado." };
  if (subtotal < c.minimo_centavos) return { ok: false, erro: `Pedido mínimo de ${(c.minimo_centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} para este cupom.` };
  if (c.primeira_compra) {
    if (!clienteId) return { ok: false, erro: "Faça login para usar este cupom." };
    const n = (await sql`SELECT count(*)::int AS n FROM pedidos WHERE cliente_id = ${clienteId} AND status <> 'cancelado'`) as { n: number }[];
    if (n[0].n > 0) return { ok: false, erro: "Cupom válido apenas na primeira compra." };
  }
  let desconto = 0;
  let freteGratis = false;
  if (c.tipo === "percentual") desconto = Math.round((subtotal * c.valor) / 100);
  else if (c.tipo === "fixo") desconto = Math.min(c.valor, subtotal);
  else { freteGratis = true; desconto = frete_centavos; }
  return { ok: true, cupom: c, desconto_centavos: desconto, frete_gratis: freteGratis };
}

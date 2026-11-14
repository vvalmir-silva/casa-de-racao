export function brl(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function limparCep(cep: string) {
  return cep.replace(/\D/g, "").slice(0, 8);
}

export function mascaraCep(cep: string) {
  const c = limparCep(cep);
  return c.length > 5 ? `${c.slice(0, 5)}-${c.slice(5)}` : c;
}

export function mascaraTelefone(t: string) {
  const d = t.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const STATUS_PEDIDO: Record<string, { label: string; cor: string }> = {
  aguardando_pagamento: { label: "Aguardando pagamento", cor: "bg-kibble-100 text-ink" },
  pago: { label: "Pago", cor: "bg-sky-100 text-sky-900" },
  separado: { label: "Separado", cor: "bg-indigo-100 text-indigo-900" },
  em_rota: { label: "Em rota", cor: "bg-violet-100 text-violet-900" },
  entregue: { label: "Entregue", cor: "bg-pine-100 text-pine-800" },
  cancelado: { label: "Cancelado", cor: "bg-line text-ink-3" },
};

export const TIPO_ENTREGA: Record<string, string> = {
  retirada: "Retirada na loja",
  rota: "Entrega em rota",
  expresso: "Expresso",
};

export const FORMA_PAGAMENTO: Record<string, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro na entrega",
  cartao_entrega: "Cartão na entrega",
  na_loja: "Pagar na loja",
};

/** Formas aceitas por tipo de entrega: retirada paga no app (PIX) ou na loja; entrega aceita todas da entrega. */
export const PAGAMENTOS_POR_ENTREGA: Record<string, string[]> = {
  retirada: ["pix", "na_loja"],
  rota: ["pix", "dinheiro", "cartao_entrega"],
  expresso: ["pix", "dinheiro", "cartao_entrega"],
};

/** "Pago" só quando já pagou de fato (PIX); pagamento na entrega/loja aparece como "Confirmado". */
export function rotuloStatus(status: string, forma?: string | null) {
  const st = STATUS_PEDIDO[status] ?? { label: status, cor: "bg-line text-ink-3" };
  return status === "pago" && forma && forma !== "pix" ? { ...st, label: "Confirmado" } : st;
}

export const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function dataBR(v: string | Date | null | undefined) {
  if (!v) return "—";
  if (v instanceof Date) {
    return `${String(v.getDate()).padStart(2, "0")}/${String(v.getMonth() + 1).padStart(2, "0")}/${v.getFullYear()}`;
  }
  const [y, m, d] = String(v).slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function dataHoraBR(v: string | Date | null | undefined) {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}

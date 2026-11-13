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
  aguardando_pagamento: { label: "Aguardando pagamento", cor: "bg-yellow-100 text-yellow-800" },
  pago: { label: "Pago", cor: "bg-blue-100 text-blue-800" },
  separado: { label: "Separado", cor: "bg-indigo-100 text-indigo-800" },
  em_rota: { label: "Em rota", cor: "bg-purple-100 text-purple-800" },
  entregue: { label: "Entregue", cor: "bg-green-100 text-green-800" },
  cancelado: { label: "Cancelado", cor: "bg-gray-200 text-gray-700" },
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
};

export const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function dataBR(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function dataHoraBR(v: string | Date | null | undefined) {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}

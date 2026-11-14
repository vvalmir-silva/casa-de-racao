"use client";

import { BotaoAction } from "@/components/FormAction";
import { mudarStatusPedido, registrarFalta } from "../actions";

const acoes: Record<string, [string, string, string][]> = {
  aguardando_pagamento: [["pago", "Confirmar pagamento", "btn-primary"], ["cancelado", "Cancelar", "btn-outline text-red-700"]],
  pago: [["separado", "Marcar separado", "btn-primary"], ["cancelado", "Cancelar", "btn-outline text-red-700"]],
  separado: [["em_rota", "Saiu para entrega", "btn-primary"], ["entregue", "Entregue / retirado", "btn-outline"], ["cancelado", "Cancelar", "btn-outline text-red-700"]],
  em_rota: [["entregue", "Entregue", "btn-primary"], ["separado", "Voltou à loja", "btn-outline"]],
};

export function StatusBotoes({ id, status, tipo }: { id: string; status: string; tipo: string }) {
  const lista = acoes[status] ?? [];
  if (!lista.length) return null;
  const retirada = tipo === "retirada";
  const falta = (retirada && ["pago", "separado"].includes(status)) || (!retirada && ["separado", "em_rota"].includes(status));
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {lista.map(([novo, label, cls]) => (
        <BotaoAction key={novo} className={`${cls} py-1.5`} action={mudarStatusPedido} args={[id, novo]} confirmar={novo === "cancelado" ? "Cancelar o pedido e devolver o estoque?" : undefined}>
          {label}
        </BotaoAction>
      ))}
      {falta && (
        <BotaoAction className="btn-ghost py-1.5 text-red-700" action={registrarFalta} args={[id]}
          confirmar={retirada ? "Cliente não retirou? O pedido será cancelado, o estoque volta e conta 1 falta para o cliente." : "Cliente não recebeu (ausente ou recusou)? O pedido será cancelado, o estoque volta e conta 1 falta."}>
          {retirada ? "Não retirou" : "Não recebeu"}
        </BotaoAction>
      )}
    </div>
  );
}

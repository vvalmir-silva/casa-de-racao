"use client";

import { BotaoAction } from "@/components/FormAction";
import { mudarStatusPedido } from "../actions";

const acoes: Record<string, [string, string, string][]> = {
  aguardando_pagamento: [["pago", "Confirmar pagamento", "btn-primary"], ["cancelado", "Cancelar", "btn-outline text-red-700"]],
  pago: [["separado", "Marcar separado", "btn-primary"], ["cancelado", "Cancelar", "btn-outline text-red-700"]],
  separado: [["em_rota", "Saiu para entrega", "btn-primary"], ["entregue", "Entregue / retirado", "btn-outline"], ["cancelado", "Cancelar", "btn-outline text-red-700"]],
  em_rota: [["entregue", "Entregue", "btn-primary"], ["separado", "Voltou à loja", "btn-outline"]],
};

export function StatusBotoes({ id, status }: { id: string; status: string }) {
  const lista = acoes[status] ?? [];
  if (!lista.length) return null;
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {lista.map(([novo, label, cls]) => (
        <BotaoAction key={novo} className={`${cls} py-1.5`} action={() => mudarStatusPedido(id, novo)} confirmar={novo === "cancelado" ? "Cancelar o pedido e devolver o estoque?" : undefined}>
          {label}
        </BotaoAction>
      ))}
    </div>
  );
}

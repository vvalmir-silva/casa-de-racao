import Link from "next/link";
import { sql } from "@/lib/db";
import { brl } from "@/lib/utils";
import { partesLocais } from "@/lib/frete";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const hoje = partesLocais().data;
  const [r] = (await sql`
    SELECT
      (SELECT count(*) FROM pedidos WHERE status = 'aguardando_pagamento') AS aguardando,
      (SELECT count(*) FROM pedidos WHERE status IN ('pago','separado') AND data_entrega = ${hoje}) AS hoje_pendentes,
      (SELECT count(*) FROM pedidos WHERE data_entrega = ${hoje} AND status <> 'cancelado') AS hoje_total,
      (SELECT coalesce(sum(total_centavos),0) FROM pedidos WHERE status <> 'cancelado' AND criado_em::date = ${hoje}::date) AS vendas_hoje,
      (SELECT coalesce(sum(total_centavos),0) FROM pedidos WHERE status <> 'cancelado' AND criado_em >= date_trunc('month', now())) AS vendas_mes,
      (SELECT count(*) FROM produtos WHERE ativo AND estoque <= 3) AS baixo_estoque,
      (SELECT count(*) FROM assinaturas WHERE ativa) AS assinaturas
  `) as Record<string, string>[];
  const cards = [
    ["Aguardando PIX", r.aguardando, "/admin/pedidos?status=aguardando_pagamento"],
    ["Entregas hoje", `${r.hoje_pendentes}/${r.hoje_total}`, "/admin/rotas"],
    ["Vendas hoje", brl(Number(r.vendas_hoje)), "/admin/pedidos"],
    ["Vendas no mês", brl(Number(r.vendas_mes)), "/admin/pedidos"],
    ["Estoque baixo", r.baixo_estoque, "/admin/produtos?baixo=1"],
    ["Assinaturas ativas", r.assinaturas, "/admin/pedidos"],
  ];
  return (
    <div>
      <h1 className="h1 mb-1">Resumo</h1>
      <p className="muted mb-5">O que precisa de atenção hoje.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map(([t, v, h]) => (
          <Link key={t} href={h} className="stat hover:border-pine-200">
            <div className="stat-t">{t}</div>
            <div className="stat-v">{v}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

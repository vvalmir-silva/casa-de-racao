import { exigirSessao } from "@/lib/auth";
import { sql } from "@/lib/db";
import { partesLocais, somarDias } from "@/lib/frete";
import { brl, dataBR } from "@/lib/utils";
import { RotaMotorista } from "./RotaMotorista";

export const dynamic = "force-dynamic";

export type Parada = {
  id: string; numero: number; ordem_rota: number; status: string; cliente: string; telefone: string; endereco: Record<string, string>;
  total_centavos: number; forma_pagamento: string; troco_para_centavos: number | null; observacoes: string | null; itens: string; inicio: string | null; fim: string | null;
};
export type RotaDoDia = { id: string; data: string; status: string; zona: string | null; paradas: Parada[] };

export default async function MotoristaPage({ searchParams }: { searchParams: Promise<{ data?: string }> }) {
  const s = await exigirSessao(["motorista", "admin"]);
  const hoje = partesLocais().data;
  const { data = hoje } = await searchParams;
  const rotas = (await sql`
    SELECT r.id, r.data::text, r.status, z.nome AS zona FROM rotas r LEFT JOIN zonas z ON z.id = r.zona_id
    WHERE r.data = ${data} AND (r.motorista_id = ${s.id} OR ${s.papel === "admin"}) ORDER BY r.criado_em
  `) as Omit<RotaDoDia, "paradas">[];
  const paradas = (await sql`
    SELECT p.id, p.numero, p.ordem_rota, p.status, u.nome AS cliente, u.telefone, p.endereco, p.total_centavos, p.forma_pagamento, p.troco_para_centavos, p.observacoes,
           p.rota_id, j.inicio::text, j.fim::text,
           (SELECT string_agg(i.qtd || '× ' || i.nome, ', ') FROM pedido_itens i WHERE i.pedido_id = p.id) AS itens
    FROM pedidos p JOIN usuarios u ON u.id = p.cliente_id LEFT JOIN janelas j ON j.id = p.janela_id
    WHERE p.rota_id = ANY(${rotas.map((r) => r.id)}::uuid[]) ORDER BY p.ordem_rota
  `) as (Parada & { rota_id: string })[];
  const lista: RotaDoDia[] = rotas.map((r) => ({ ...r, paradas: paradas.filter((p) => p.rota_id === r.id) }));

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="h1">Minha rota</h1>
        <div className="flex items-center gap-1 text-sm">
          <a className="btn-ghost py-1" href={`/motorista?data=${somarDias(data, -1)}`}>‹</a>
          <span>{dataBR(data)}</span>
          <a className="btn-ghost py-1" href={`/motorista?data=${somarDias(data, 1)}`}>›</a>
        </div>
      </div>
      {lista.length === 0 && <p className="card muted">Nenhuma rota atribuída para esta data.</p>}
      {lista.map((r) => <RotaMotorista key={r.id} rota={r} />)}
      {paradas.length > 0 && (
        <p className="text-xs text-ink-3">A receber na porta (dinheiro/cartão): <b>{brl(paradas.filter((p) => p.forma_pagamento !== "pix" && p.status !== "entregue").reduce((a, p) => a + p.total_centavos, 0))}</b>. PIX já está pago.</p>
      )}
    </div>
  );
}

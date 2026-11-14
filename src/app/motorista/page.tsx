import { exigirSessao } from "@/lib/auth";
import { sql, getConfig } from "@/lib/db";
import { partesLocais, somarDias } from "@/lib/frete";
import { brl, dataBR } from "@/lib/utils";
import { RotaMotorista } from "./RotaMotorista";
import { esperadoDaRota } from "@/lib/acerto";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export type Parada = {
  id: string; numero: number; ordem_rota: number; status: string; cliente: string; telefone: string; endereco: Record<string, string>;
  total_centavos: number; forma_pagamento: string; troco_para_centavos: number | null; observacoes: string | null; itens: string; inicio: string | null; fim: string | null;
  comprovante_url: string | null; confirmacao: string | null;
};
export type Caixa = { troco: number; dinheiro: number; cartao: number; conferido: boolean; diferenca: number };
export type RotaDoDia = {
  id: string; data: string; status: string; zona: string | null; distancia_m: number | null; duracao_s: number | null; otimizada_por: string | null; paradas: Parada[];
};

export default async function MotoristaPage({ searchParams }: { searchParams: Promise<{ data?: string }> }) {
  const s = await exigirSessao(["motorista", "admin"]);
  const hoje = partesLocais().data;
  const { data = hoje } = await searchParams;
  const rotas = (await sql`
    SELECT r.id, r.data::text, r.status, z.nome AS zona, r.distancia_m, r.duracao_s, r.otimizada_por
    FROM rotas r LEFT JOIN zonas z ON z.id = r.zona_id
    WHERE r.data = ${data} AND (r.motorista_id = ${s.id} OR ${s.papel === "admin"}) ORDER BY r.criado_em
  `) as Omit<RotaDoDia, "paradas">[];
  const paradas = (await sql`
    SELECT p.id, p.numero, p.ordem_rota, p.status, u.nome AS cliente, u.telefone, p.endereco, p.total_centavos, p.forma_pagamento, p.troco_para_centavos, p.observacoes,
           p.rota_id, p.comprovante_url, p.confirmacao, j.inicio::text, j.fim::text,
           (SELECT string_agg(i.qtd || '× ' || i.nome, ', ') FROM pedido_itens i WHERE i.pedido_id = p.id) AS itens
    FROM pedidos p JOIN usuarios u ON u.id = p.cliente_id LEFT JOIN janelas j ON j.id = p.janela_id
    WHERE p.rota_id = ANY(${rotas.map((r) => r.id)}::uuid[]) ORDER BY p.ordem_rota
  `) as (Parada & { rota_id: string })[];
  const lista: RotaDoDia[] = rotas.map((r) => ({ ...r, paradas: paradas.filter((p) => p.rota_id === r.id) }));
  const cfg = await getConfig();
  const acertos = (await sql`SELECT rota_id, recebido_dinheiro + recebido_cartao - esperado_dinheiro - esperado_cartao AS diferenca FROM acertos_caixa WHERE rota_id = ANY(${rotas.map((r) => r.id)}::uuid[])`) as { rota_id: string; diferenca: number }[];
  const caixas = new Map<string, Caixa>(await Promise.all(rotas.map(async (r) => {
    const e = await esperadoDaRota(r.id);
    const a = acertos.find((x) => x.rota_id === r.id);
    return [r.id, { troco: e?.troco ?? 0, dinheiro: e?.dinheiro ?? 0, cartao: e?.cartao ?? 0, conferido: !!a, diferenca: Number(a?.diferenca ?? 0) }] as const;
  })));
  const aReceber = paradas.filter((p) => p.forma_pagamento !== "pix" && p.status !== "entregue").reduce((a, p) => a + p.total_centavos, 0);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="h1">Minha rota</h1>
        <div className="flex items-center rounded-xl border border-line bg-white">
          <a className="grid h-11 w-11 place-items-center text-lg" href={`/motorista?data=${somarDias(data, -1)}`} aria-label="Dia anterior">‹</a>
          <span className="px-1 text-sm font-bold">{data === hoje ? "Hoje" : dataBR(data)}</span>
          <a className="grid h-11 w-11 place-items-center text-lg" href={`/motorista?data=${somarDias(data, 1)}`} aria-label="Próximo dia">›</a>
        </div>
      </div>
      {lista.length === 0 && (
        <div className="card-flat py-10 text-center"><div className="text-3xl">🚗</div><p className="mt-2 font-bold">Nenhuma rota para este dia</p><p className="muted">Quando a loja montar a rota, ela aparece aqui.</p></div>
      )}
      {aReceber > 0 && (
        <div className="flex items-center justify-between rounded-2xl bg-kibble-50 px-4 py-3 text-sm"><span>Receber na porta (dinheiro/cartão)</span><b className="text-base">{brl(aReceber)}</b></div>
      )}
      {lista.map((r) => (
        <RotaMotorista key={r.id + r.paradas.map((p) => p.id + p.ordem_rota).join()} rota={r} origem={cfg.loja_endereco ?? ""} fotoObrigatoria={cfg.comprovante_obrigatorio === "true"} caixa={caixas.get(r.id)!} />
      ))}
    </div>
  );
}

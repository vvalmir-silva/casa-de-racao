import { sql } from "@/lib/db";
import { brl, dataBR, TIPO_ENTREGA, FORMA_PAGAMENTO } from "@/lib/utils";
import { partesLocais, somarDias } from "@/lib/frete";

export const dynamic = "force-dynamic";

type Resumo = { pedidos: number; receita: number; frete: number; descontos: number; ticket: number; custo: number; clientes: number; novos_clientes: number; cancelados: number };
type Linha = { chave: string; pedidos: number; receita: number };
type TopProduto = { nome: string; qtd: number; receita: number; custo: number | null };

const periodos: [string, string][] = [["7", "7 dias"], ["30", "30 dias"], ["90", "90 dias"], ["mes", "Este mês"], ["365", "12 meses"]];

export default async function RelatoriosAdmin({ searchParams }: { searchParams: Promise<{ p?: string; de?: string; ate?: string }> }) {
  const sp = await searchParams;
  const hoje = partesLocais().data;
  let de: string, ate = hoje;
  const p = sp.p ?? "30";
  if (sp.de && sp.ate) { de = sp.de; ate = sp.ate; }
  else if (p === "mes") de = hoje.slice(0, 8) + "01";
  else de = somarDias(hoje, -(Number(p) - 1));

  const [r] = (await sql`
    SELECT count(*)::int AS pedidos,
           coalesce(sum(total_centavos),0)::int AS receita,
           coalesce(sum(frete_centavos),0)::int AS frete,
           coalesce(sum(desconto_centavos),0)::int AS descontos,
           coalesce(avg(total_centavos),0)::int AS ticket,
           coalesce((SELECT sum(i.qtd * pr.custo_centavos) FROM pedido_itens i JOIN pedidos p2 ON p2.id = i.pedido_id JOIN produtos pr ON pr.id = i.produto_id
                     WHERE p2.status <> 'cancelado' AND (p2.criado_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN ${de}::date AND ${ate}::date AND pr.custo_centavos IS NOT NULL),0)::int AS custo,
           count(DISTINCT cliente_id)::int AS clientes,
           (SELECT count(*)::int FROM usuarios u WHERE u.papel='cliente' AND (u.criado_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN ${de}::date AND ${ate}::date) AS novos_clientes,
           (SELECT count(*)::int FROM pedidos c WHERE c.status='cancelado' AND (c.criado_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN ${de}::date AND ${ate}::date) AS cancelados
    FROM pedidos WHERE status <> 'cancelado' AND (criado_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN ${de}::date AND ${ate}::date
  `) as Resumo[];

  const porDia = (await sql`
    SELECT to_char((criado_em AT TIME ZONE 'America/Sao_Paulo')::date, 'YYYY-MM-DD') AS chave, count(*)::int AS pedidos, sum(total_centavos)::int AS receita
    FROM pedidos WHERE status <> 'cancelado' AND (criado_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN ${de}::date AND ${ate}::date
    GROUP BY 1 ORDER BY 1
  `) as Linha[];
  const top = (await sql`
    SELECT i.nome, sum(i.qtd)::int AS qtd, sum(i.qtd * i.preco_centavos)::int AS receita, (sum(i.qtd * pr.custo_centavos))::int AS custo
    FROM pedido_itens i JOIN pedidos p ON p.id = i.pedido_id LEFT JOIN produtos pr ON pr.id = i.produto_id
    WHERE p.status <> 'cancelado' AND (p.criado_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN ${de}::date AND ${ate}::date
    GROUP BY i.nome ORDER BY receita DESC LIMIT 10
  `) as TopProduto[];
  const porPag = (await sql`
    SELECT forma_pagamento AS chave, count(*)::int AS pedidos, sum(total_centavos)::int AS receita FROM pedidos
    WHERE status <> 'cancelado' AND (criado_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN ${de}::date AND ${ate}::date GROUP BY 1 ORDER BY 3 DESC
  `) as Linha[];
  const porEntrega = (await sql`
    SELECT tipo_entrega AS chave, count(*)::int AS pedidos, sum(total_centavos)::int AS receita FROM pedidos
    WHERE status <> 'cancelado' AND (criado_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN ${de}::date AND ${ate}::date GROUP BY 1 ORDER BY 3 DESC
  `) as Linha[];
  const porZona = (await sql`
    SELECT coalesce(z.nome, 'Sem zona / retirada') AS chave, count(*)::int AS pedidos, sum(p.total_centavos)::int AS receita FROM pedidos p LEFT JOIN zonas z ON z.id = p.zona_id
    WHERE p.status <> 'cancelado' AND (p.criado_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN ${de}::date AND ${ate}::date GROUP BY 1 ORDER BY 3 DESC
  `) as Linha[];
  const cupons = (await sql`
    SELECT cupom_codigo AS chave, count(*)::int AS pedidos, sum(desconto_centavos)::int AS receita FROM pedidos
    WHERE cupom_codigo IS NOT NULL AND status <> 'cancelado' AND (criado_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN ${de}::date AND ${ate}::date GROUP BY 1 ORDER BY 2 DESC
  `) as Linha[];
  const recorrentes = (await sql`
    SELECT count(*)::int AS n FROM (SELECT cliente_id FROM pedidos WHERE status <> 'cancelado' AND (criado_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN ${de}::date AND ${ate}::date GROUP BY cliente_id HAVING count(*) > 1) t
  `) as { n: number }[];

  const margem = r.custo > 0 ? r.receita - r.frete - r.custo : null;
  const maxDia = Math.max(1, ...porDia.map((d) => d.receita));

  const Card = ({ t, v, s }: { t: string; v: string; s?: string }) => (
    <div className="card"><div className="text-xs text-ink-3">{t}</div><div className="text-xl font-bold">{v}</div>{s && <div className="text-xs text-ink-3">{s}</div>}</div>
  );
  const Tabela = ({ titulo, linhas, label, col = "Receita" }: { titulo: string; linhas: Linha[]; label?: (k: string) => string; col?: string }) => (
    <div className="card">
      <h3 className="h2 mb-3">{titulo}</h3>
      {linhas.length === 0 ? <p className="muted">Sem dados.</p> : (
        <table className="table"><thead><tr><th></th><th className="text-right">Pedidos</th><th className="text-right">{col}</th></tr></thead>
          <tbody>{linhas.map((l) => <tr key={l.chave}><td>{label ? label(l.chave) : l.chave}</td><td className="text-right">{l.pedidos}</td><td className="text-right">{brl(l.receita)}</td></tr>)}</tbody></table>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="h1">Relatórios</h1>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          {periodos.map(([v, l]) => <a key={v} href={`/admin/relatorios?p=${v}`} className={`chip ${p === v && !sp.de ? "chip-on" : "chip"}`}>{l}</a>)}
          <form className="grid w-full grid-cols-[1fr_1fr_auto] items-center gap-1 sm:flex sm:w-auto"><input type="date" name="de" aria-label="De" defaultValue={de} className="input min-w-0 py-1 sm:w-36" /><input type="date" name="ate" aria-label="Até" defaultValue={ate} className="input min-w-0 py-1 sm:w-36" /><button className="btn-outline px-3 py-1">Filtrar</button></form>
        </div>
      </div>
      <p className="muted">{dataBR(de)} a {dataBR(ate)} · pedidos cancelados excluídos</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card t="Receita" v={brl(r.receita)} s={`${r.pedidos} pedidos`} />
        <Card t="Ticket médio" v={brl(r.ticket)} />
        <Card t="Frete cobrado" v={brl(r.frete)} s={`Descontos: ${brl(r.descontos)}`} />
        <Card t="Margem bruta" v={margem === null ? "—" : brl(margem)} s={margem === null ? "Cadastre o custo dos produtos" : `${((margem / Math.max(1, r.receita - r.frete)) * 100).toFixed(0)}% sobre produtos`} />
        <Card t="Clientes que compraram" v={String(r.clientes)} s={`${recorrentes[0].n} compraram 2+ vezes`} />
        <Card t="Novos cadastros" v={String(r.novos_clientes)} />
        <Card t="Cancelados" v={String(r.cancelados)} />
        <Card t="Média por dia" v={brl(porDia.length ? Math.round(r.receita / porDia.length) : 0)} s={`${porDia.length} dias com venda`} />
      </div>

      <div className="card">
        <h3 className="h2 mb-3">Receita por dia</h3>
        {porDia.length === 0 ? <p className="muted">Sem vendas no período.</p> : (
          <div className="flex h-40 items-end gap-1 overflow-x-auto">
            {porDia.map((d) => (
              <div key={d.chave} className="group flex min-w-[14px] flex-1 flex-col items-center justify-end" title={`${dataBR(d.chave)}: ${brl(d.receita)} (${d.pedidos})`}>
                <div className="w-full rounded-t bg-pine-500 transition group-hover:bg-pine-700" style={{ height: `${Math.max(2, (d.receita / maxDia) * 100)}%` }} />
                <div className="mt-1 text-[9px] text-ink-3">{d.chave.slice(8)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="h2 mb-3">Produtos mais vendidos</h3>
        <table className="table"><thead><tr><th>Produto</th><th className="text-right">Qtd</th><th className="text-right">Receita</th><th className="text-right">Margem</th></tr></thead>
          <tbody>{top.map((t) => <tr key={t.nome}><td>{t.nome}</td><td className="text-right">{t.qtd}</td><td className="text-right">{brl(t.receita)}</td><td className="text-right">{t.custo != null ? brl(t.receita - t.custo) : "—"}</td></tr>)}</tbody></table>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Tabela titulo="Por forma de pagamento" linhas={porPag} label={(k) => FORMA_PAGAMENTO[k] ?? k} />
        <Tabela titulo="Por tipo de entrega" linhas={porEntrega} label={(k) => TIPO_ENTREGA[k] ?? k} />
        <Tabela titulo="Por zona" linhas={porZona} />
        <Tabela titulo="Cupons usados" linhas={cupons} col="Desconto dado" />
      </div>
    </div>
  );
}

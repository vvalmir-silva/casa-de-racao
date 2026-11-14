import { sql } from "@/lib/db";
import { brl, dataBR } from "@/lib/utils";
import { FormAction, BotaoAction } from "@/components/FormAction";
import { salvarCupom, alternarCupom } from "../actions";
import type { Cupom } from "@/lib/cupons";

export const dynamic = "force-dynamic";

export default async function CuponsAdmin({ searchParams }: { searchParams: Promise<{ editar?: string }> }) {
  const { editar } = await searchParams;
  const cupons = (await sql`SELECT *, valido_ate::text FROM cupons WHERE usuario_id IS NULL ORDER BY ativo DESC, criado_em DESC`) as Cupom[];
  const indic = (await sql`
    SELECT split_part(a.nome, ' ', 1) || ' ' || coalesce(nullif(split_part(a.nome, ' ', 2), ''), '') AS indicado,
      split_part(b.nome, ' ', 1) || ' ' || coalesce(nullif(split_part(b.nome, ' ', 2), ''), '') AS indicador,
      i.status, i.motivo, i.cupom_premio, i.criado_em::text, p.numero
    FROM indicacoes i JOIN usuarios a ON a.id = i.indicado_id JOIN usuarios b ON b.id = i.indicador_id LEFT JOIN pedidos p ON p.id = i.pedido_id
    ORDER BY i.criado_em DESC LIMIT 30
  `) as { indicado: string; indicador: string; status: string; motivo: string | null; cupom_premio: string | null; criado_em: string; numero: number | null }[];
  const [resumo] = (await sql`
    SELECT count(*) FILTER (WHERE origem = 'indicacao_amigo' AND usos > 0)::int AS amigos_usaram,
           count(*) FILTER (WHERE origem = 'indicacao_premio')::int AS premios,
           coalesce(sum(valor) FILTER (WHERE usos > 0), 0)::int AS desconto_dado
    FROM cupons WHERE origem LIKE 'indicacao%'
  `) as { amigos_usaram: number; premios: number; desconto_dado: number }[];
  const c = cupons.find((x) => String(x.id) === editar) ?? null;
  const tipoLabel = { percentual: "%", fixo: "R$", frete_gratis: "Frete grátis" };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="h1">Cupons</h1>
        <a href="/admin/cupons?editar=novo" className="btn-primary">+ Cupom</a>
      </div>
      {(editar === "novo" || c) && (
        <FormAction action={salvarCupom} className="card grid grid-cols-2 gap-2 sm:grid-cols-4">
          <h2 className="col-span-full font-semibold">{c ? `Editar ${c.codigo}` : "Novo cupom"}</h2>
          <input type="hidden" name="id" value={c?.id ?? ""} />
          <div><label className="label">Código</label><input name="codigo" className="input uppercase" defaultValue={c?.codigo} required /></div>
          <div className="col-span-2 sm:col-span-3"><label className="label">Descrição (aparece pro cliente)</label><input name="descricao" className="input" defaultValue={c?.descricao ?? ""} /></div>
          <div><label className="label">Tipo</label><select name="tipo" className="input" defaultValue={c?.tipo ?? "percentual"}><option value="percentual">Percentual</option><option value="fixo">Valor fixo</option><option value="frete_gratis">Frete grátis</option></select></div>
          <div><label className="label">Valor (% ou R$)</label><input name="valor" className="input" inputMode="decimal" defaultValue={c ? (c.tipo === "fixo" ? (c.valor / 100).toFixed(2).replace(".", ",") : c.valor) : ""} /></div>
          <div><label className="label">Pedido mínimo (R$)</label><input name="minimo" className="input" inputMode="decimal" defaultValue={c ? (c.minimo_centavos / 100).toFixed(2).replace(".", ",") : "0"} /></div>
          <div><label className="label">Limite de usos</label><input name="limite_usos" className="input" inputMode="numeric" defaultValue={c?.limite_usos ?? ""} placeholder="ilimitado" /></div>
          <div><label className="label">Válido até</label><input name="valido_ate" type="date" className="input" defaultValue={c?.valido_ate ?? ""} /></div>
          <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="primeira_compra" defaultChecked={c?.primeira_compra ?? false} /> Só primeira compra</label>
          <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="ativo" defaultChecked={c?.ativo ?? true} /> Ativo</label>
          <div className="col-span-full flex gap-2"><button className="btn-primary">Salvar</button><a href="/admin/cupons" className="btn-ghost">Cancelar</a></div>
        </FormAction>
      )}
      <div className="overflow-x-auto">
        <table className="table table-cards">
          <thead><tr><th>Código</th><th>Desconto</th><th>Mínimo</th><th>Usos</th><th>Validade</th><th>Regras</th><th></th></tr></thead>
          <tbody>
            {cupons.map((x) => (
              <tr key={x.id} className={x.ativo ? "" : "opacity-50"}>
                <td data-label="Código"><b>{x.codigo}</b><div className="text-xs text-ink-3">{x.descricao}</div></td>
                <td data-label="Desconto">{x.tipo === "percentual" ? `${x.valor}%` : x.tipo === "fixo" ? brl(x.valor) : tipoLabel.frete_gratis}</td>
                <td data-label="Mínimo">{x.minimo_centavos ? brl(x.minimo_centavos) : "—"}</td>
                <td data-label="Usos">{x.usos}{x.limite_usos ? ` / ${x.limite_usos}` : ""}</td>
                <td data-label="Validade">{x.valido_ate ? dataBR(x.valido_ate) : "—"}</td>
                <td className="text-xs">{x.primeira_compra ? "1ª compra" : ""}</td>
                <td className="whitespace-nowrap">
                  <a href={`/admin/cupons?editar=${x.id}`} className="mr-2 font-semibold text-pine-700 underline">editar</a>
                  <BotaoAction className="text-xs underline" action={alternarCupom} args={[x.id, !x.ativo]}>{x.ativo ? "desativar" : "ativar"}</BotaoAction>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="card space-y-3" data-testid="indicacoes">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="h2">Indique e ganhe</h2>
          <a href="/admin/config#cf-indicacao" className="ml-auto text-sm font-semibold text-pine-700 underline">Valores e regras</a>
        </div>
        <p className="text-sm text-ink-2">{resumo.amigos_usaram} amigo(s) usaram o desconto · {resumo.premios} prêmio(s) para quem indicou · {brl(resumo.desconto_dado)} em descontos usados. Os cupons pessoais não aparecem na lista acima.</p>
        {indic.length === 0 ? <p className="muted">Nenhuma indicação ainda.</p> : (
          <table className="table table-cards"><thead><tr><th>Quem indicou</th><th>Amigo</th><th>Situação</th><th>Desde</th></tr></thead>
            <tbody>{indic.map((x, i) => (
              <tr key={i}>
                <td className="font-semibold">{x.indicador}</td>
                <td data-label="Amigo">{x.indicado}</td>
                <td data-label="Situação">{x.status === "premiado" ? <span className="badge bg-pine-100 text-pine-800">premiado{x.numero ? ` · #${x.numero}` : ""}{x.cupom_premio ? ` · ${x.cupom_premio}` : ""}</span>
                  : x.status === "recusado" ? <span className="badge bg-oferta-50 text-oferta" title={x.motivo ?? ""}>recusado: {x.motivo}</span>
                  : <span className="badge bg-page text-ink-2">aguardando 1ª entrega</span>}</td>
                <td data-label="Desde">{dataBR(x.criado_em.slice(0, 10))}</td>
              </tr>
            ))}</tbody></table>
        )}
      </section>
    </div>
  );
}

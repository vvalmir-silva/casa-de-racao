import { sql } from "@/lib/db";
import { brl, dataBR } from "@/lib/utils";
import { FormAction, BotaoAction } from "@/components/FormAction";
import { salvarCupom, alternarCupom } from "../actions";
import type { Cupom } from "@/lib/cupons";

export const dynamic = "force-dynamic";

export default async function CuponsAdmin({ searchParams }: { searchParams: Promise<{ editar?: string }> }) {
  const { editar } = await searchParams;
  const cupons = (await sql`SELECT *, valido_ate::text FROM cupons ORDER BY ativo DESC, criado_em DESC`) as Cupom[];
  const c = cupons.find((x) => String(x.id) === editar) ?? null;
  const tipoLabel = { percentual: "%", fixo: "R$", frete_gratis: "Frete grátis" };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Cupons</h1>
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
        <table className="table">
          <thead><tr><th>Código</th><th>Desconto</th><th>Mínimo</th><th>Usos</th><th>Validade</th><th>Regras</th><th></th></tr></thead>
          <tbody>
            {cupons.map((x) => (
              <tr key={x.id} className={x.ativo ? "" : "opacity-50"}>
                <td><b>{x.codigo}</b><div className="text-xs text-stone-500">{x.descricao}</div></td>
                <td>{x.tipo === "percentual" ? `${x.valor}%` : x.tipo === "fixo" ? brl(x.valor) : tipoLabel.frete_gratis}</td>
                <td>{x.minimo_centavos ? brl(x.minimo_centavos) : "—"}</td>
                <td>{x.usos}{x.limite_usos ? ` / ${x.limite_usos}` : ""}</td>
                <td>{x.valido_ate ? dataBR(x.valido_ate) : "—"}</td>
                <td className="text-xs">{x.primeira_compra ? "1ª compra" : ""}</td>
                <td className="whitespace-nowrap">
                  <a href={`/admin/cupons?editar=${x.id}`} className="mr-2 text-brand-700 underline">editar</a>
                  <BotaoAction className="text-xs underline" action={() => alternarCupom(x.id, !x.ativo)}>{x.ativo ? "desativar" : "ativar"}</BotaoAction>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

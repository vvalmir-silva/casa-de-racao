import { sql } from "@/lib/db";
import { DIAS_SEMANA } from "@/lib/utils";
import { FormAction, BotaoAction } from "@/components/FormAction";
import { salvarZona, excluirZona, salvarJanela, excluirJanela } from "../actions";

export const dynamic = "force-dynamic";

type Zona = { id: number; nome: string; taxa_centavos: number; dias_entrega: number[]; ativa: boolean; prefixos: string | null };
type Janela = { id: number; zona_id: number; corte: string; inicio: string; fim: string; ativa: boolean };

export default async function EntregasAdmin() {
  const zonas = (await sql`
    SELECT z.*, (SELECT string_agg(prefixo, ', ' ORDER BY prefixo) FROM zona_ceps WHERE zona_id = z.id) AS prefixos
    FROM zonas z ORDER BY z.ativa DESC, z.ordem
  `) as Zona[];
  const janelas = (await sql`SELECT id, zona_id, corte::text, inicio::text, fim::text, ativa FROM janelas WHERE ativa ORDER BY zona_id, corte`) as Janela[];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Zonas e janelas de entrega</h1>
        <p className="text-sm text-stone-600">Cada zona é um conjunto de prefixos de CEP (5 primeiros dígitos), com taxa e dias de entrega. Janelas definem o horário de corte e o período de entrega.</p>
      </div>

      {zonas.map((z) => (
        <section key={z.id} className={`card space-y-3 ${z.ativa ? "" : "opacity-60"}`}>
          <FormAction action={salvarZona} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <input type="hidden" name="id" value={z.id} />
            <div className="col-span-2"><label className="label">Nome</label><input name="nome" className="input" defaultValue={z.nome} /></div>
            <div><label className="label">Taxa (R$)</label><input name="taxa" className="input" inputMode="decimal" defaultValue={(z.taxa_centavos / 100).toFixed(2).replace(".", ",")} /></div>
            <div className="flex items-end"><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="ativa" defaultChecked={z.ativa} /> Ativa</label></div>
            <div className="col-span-full">
              <label className="label">Dias de entrega</label>
              <div className="flex flex-wrap gap-2">
                {DIAS_SEMANA.map((d, i) => (
                  <label key={i} className="flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-sm"><input type="checkbox" name="dias" value={i} defaultChecked={z.dias_entrega.includes(i)} />{d}</label>
                ))}
              </div>
            </div>
            <div className="col-span-full"><label className="label">Prefixos de CEP (separe por vírgula ou espaço)</label><textarea name="prefixos" className="input font-mono text-xs" rows={2} defaultValue={z.prefixos ?? ""} /></div>
            <div className="col-span-full flex gap-2">
              <button className="btn-primary">Salvar zona</button>
              {z.ativa && <BotaoAction className="btn-outline text-red-700" action={excluirZona} args={[z.id]} confirmar="Desativar zona?">Desativar</BotaoAction>}
            </div>
          </FormAction>

          <div className="rounded-lg bg-stone-50 p-3">
            <div className="mb-2 text-sm font-semibold">Janelas</div>
            <div className="space-y-2">
              {janelas.filter((j) => j.zona_id === z.id).map((j) => (
                <FormAction key={j.id} action={salvarJanela} className="flex flex-wrap items-end gap-2 text-sm">
                  <input type="hidden" name="id" value={j.id} /><input type="hidden" name="zona_id" value={z.id} />
                  <div><label className="label">Corte</label><input type="time" name="corte" className="input py-1" defaultValue={j.corte.slice(0, 5)} /></div>
                  <div><label className="label">Início</label><input type="time" name="inicio" className="input py-1" defaultValue={j.inicio.slice(0, 5)} /></div>
                  <div><label className="label">Fim</label><input type="time" name="fim" className="input py-1" defaultValue={j.fim.slice(0, 5)} /></div>
                  <button className="btn-outline py-1.5">Salvar</button>
                  <BotaoAction className="text-xs text-red-600" action={excluirJanela} args={[j.id]}>remover</BotaoAction>
                </FormAction>
              ))}
              <FormAction action={salvarJanela} className="flex flex-wrap items-end gap-2 text-sm">
                <input type="hidden" name="zona_id" value={z.id} />
                <div><label className="label">Corte</label><input type="time" name="corte" className="input py-1" defaultValue="11:00" /></div>
                <div><label className="label">Início</label><input type="time" name="inicio" className="input py-1" defaultValue="13:00" /></div>
                <div><label className="label">Fim</label><input type="time" name="fim" className="input py-1" defaultValue="16:00" /></div>
                <button className="btn-ghost py-1.5">+ Janela</button>
              </FormAction>
            </div>
          </div>
        </section>
      ))}

      <section className="card">
        <h2 className="mb-2 font-semibold">Nova zona</h2>
        <FormAction action={salvarZona} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="col-span-2"><label className="label">Nome</label><input name="nome" className="input" placeholder="Zona 4 — Bairro X" required /></div>
          <div><label className="label">Taxa (R$)</label><input name="taxa" className="input" inputMode="decimal" defaultValue="10,00" /></div>
          <div className="flex items-end"><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="ativa" defaultChecked /> Ativa</label></div>
          <div className="col-span-full flex flex-wrap gap-2">
            {DIAS_SEMANA.map((d, i) => (
              <label key={i} className="flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-sm"><input type="checkbox" name="dias" value={i} defaultChecked={i >= 1 && i <= 5} />{d}</label>
            ))}
          </div>
          <div className="col-span-full"><label className="label">Prefixos de CEP</label><textarea name="prefixos" className="input font-mono text-xs" rows={2} placeholder="03101, 03102, 03103" /></div>
          <div className="col-span-full"><button className="btn-primary">Criar zona</button></div>
        </FormAction>
      </section>
      <p className="text-xs text-stone-500">Valor mínimo para frete grátis e adicional por peso ficam em Configurações.</p>
    </div>
  );
}

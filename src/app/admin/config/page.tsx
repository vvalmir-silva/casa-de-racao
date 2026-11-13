import { getConfig } from "@/lib/db";
import { FormAction } from "@/components/FormAction";
import { salvarConfig } from "../actions";

export const dynamic = "force-dynamic";

const reais = (c: Record<string, string>, k: string) => (Number(c[k] ?? 0) / 100).toFixed(2).replace(".", ",");

export default async function ConfigAdmin() {
  const c = await getConfig();
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">Configurações</h1>
      <FormAction action={salvarConfig} className="card grid grid-cols-2 gap-3">
        <h2 className="col-span-full font-semibold">Loja</h2>
        <div><label className="label">Nome</label><input name="loja_nome" className="input" defaultValue={c.loja_nome} /></div>
        <div><label className="label">WhatsApp (55DDDnúmero)</label><input name="loja_whatsapp" className="input" defaultValue={c.loja_whatsapp} /></div>
        <div className="col-span-full"><label className="label">Endereço (retirada)</label><input name="loja_endereco" className="input" defaultValue={c.loja_endereco} /></div>
        <div><label className="label">CEP da loja</label><input name="loja_cep" className="input" defaultValue={c.loja_cep} /></div>
        <div><label className="label">Chave PIX</label><input name="pix_chave" className="input" defaultValue={c.pix_chave} /></div>
        <div><label className="label">Retirada pronta em (horas)</label><input name="retirada_prazo_horas" className="input" defaultValue={c.retirada_prazo_horas} /></div>

        <h2 className="col-span-full mt-2 font-semibold">Frete em rota</h2>
        <div><label className="label">Frete grátis a partir de (R$)</label><input name="frete_gratis_minimo_centavos" className="input" defaultValue={reais(c, "frete_gratis_minimo_centavos")} /></div>
        <div><label className="label">Peso sem adicional (kg)</label><input name="peso_extra_limite_kg" className="input" defaultValue={c.peso_extra_limite_kg} /></div>
        <div><label className="label">Adicional por bloco (R$)</label><input name="peso_extra_taxa_centavos" className="input" defaultValue={reais(c, "peso_extra_taxa_centavos")} /></div>
        <div><label className="label">Tamanho do bloco (kg)</label><input name="peso_extra_bloco_kg" className="input" defaultValue={c.peso_extra_bloco_kg} /></div>

        <h2 className="col-span-full mt-2 font-semibold">Expresso (motoboy)</h2>
        <label className="col-span-full flex items-center gap-2 text-sm"><input type="checkbox" name="expresso_ativo" defaultChecked={c.expresso_ativo === "true"} /> Oferecer entrega expressa</label>
        <div><label className="label">Taxa (R$)</label><input name="expresso_taxa_centavos" className="input" defaultValue={reais(c, "expresso_taxa_centavos")} /></div>
        <div><label className="label">Peso máximo (kg)</label><input name="expresso_peso_max_kg" className="input" defaultValue={c.expresso_peso_max_kg} /></div>
        <div><label className="label">Prazo (horas)</label><input name="expresso_prazo_horas" className="input" defaultValue={c.expresso_prazo_horas} /></div>
        <div className="col-span-full"><button className="btn-primary">Salvar</button></div>
      </FormAction>
    </div>
  );
}

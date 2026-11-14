import { getConfig } from "@/lib/db";
import { FormAction } from "@/components/FormAction";
import { salvarConfig } from "../actions";

export const dynamic = "force-dynamic";

const reais = (c: Record<string, string>, k: string) => (Number(c[k] ?? 0) / 100).toFixed(2).replace(".", ",");

export default async function ConfigAdmin() {
  const c = await getConfig();
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="h1">Configurações</h1>
      <FormAction action={salvarConfig} className="card grid grid-cols-2 gap-3">
        <h2 className="h2 col-span-full">Loja</h2>
        <div><label className="label">Nome</label><input name="loja_nome" className="input" defaultValue={c.loja_nome} /></div>
        <div><label className="label">WhatsApp (55DDDnúmero)</label><input name="loja_whatsapp" className="input" defaultValue={c.loja_whatsapp} /></div>
        <div className="col-span-full"><label className="label">Endereço (retirada)</label><input name="loja_endereco" className="input" defaultValue={c.loja_endereco} /></div>
        <div><label className="label">CEP da loja</label><input name="loja_cep" className="input" defaultValue={c.loja_cep} /></div>
        <div><label className="label">Chave PIX</label><input name="pix_chave" className="input" defaultValue={c.pix_chave} /></div>
        <div><label className="label">Retirada pronta em (horas)</label><input name="retirada_prazo_horas" className="input" defaultValue={c.retirada_prazo_horas} /></div>

        <div><label className="label">Latitude da loja (opcional)</label><input name="loja_lat" className="input" defaultValue={c.loja_lat} placeholder="calculada pelo endereço" /></div>
        <div><label className="label">Longitude da loja (opcional)</label><input name="loja_lng" className="input" defaultValue={c.loja_lng} placeholder="calculada pelo endereço" /></div>
        <p className="col-span-full -mt-1 text-xs text-ink-3">Ponto de partida das rotas. Deixe em branco para calcular pelo endereço; preencha se o cálculo errar (copie do Google Maps: clique no local → números do topo).</p>
        <label className="col-span-full flex items-center gap-2 text-sm"><input type="checkbox" name="comprovante_obrigatorio" defaultChecked={c.comprovante_obrigatorio === "true"} /> Exigir foto do motorista para concluir cada entrega</label>

        <h2 className="h2 col-span-full mt-3">Frete em rota</h2>
        <div><label className="label">Frete grátis a partir de (R$)</label><input name="frete_gratis_minimo_centavos" className="input" defaultValue={reais(c, "frete_gratis_minimo_centavos")} /></div>
        <div><label className="label">Peso sem adicional (kg)</label><input name="peso_extra_limite_kg" className="input" defaultValue={c.peso_extra_limite_kg} /></div>
        <div><label className="label">Adicional por bloco (R$)</label><input name="peso_extra_taxa_centavos" className="input" defaultValue={reais(c, "peso_extra_taxa_centavos")} /></div>
        <div><label className="label">Tamanho do bloco (kg)</label><input name="peso_extra_bloco_kg" className="input" defaultValue={c.peso_extra_bloco_kg} /></div>

        <h2 className="h2 col-span-full mt-3">Expresso (motoboy)</h2>
        <label className="col-span-full flex items-center gap-2 text-sm"><input type="checkbox" name="expresso_ativo" defaultChecked={c.expresso_ativo === "true"} /> Oferecer entrega expressa</label>
        <div><label className="label">Taxa (R$)</label><input name="expresso_taxa_centavos" className="input" defaultValue={reais(c, "expresso_taxa_centavos")} /></div>
        <div><label className="label">Peso máximo (kg)</label><input name="expresso_peso_max_kg" className="input" defaultValue={c.expresso_peso_max_kg} /></div>
        <div><label className="label">Prazo (horas)</label><input name="expresso_prazo_horas" className="input" defaultValue={c.expresso_prazo_horas} /></div>
        <h2 className="h2 col-span-full mt-3">WhatsApp e PIX</h2>
        <label className="col-span-full flex items-center gap-2 text-sm"><input type="checkbox" name="avaliacao_auto_publicar" defaultChecked={(c.avaliacao_auto_publicar ?? "true") === "true"} /> Publicar na página inicial as avaliações 4 e 5 estrelas com comentário, sem aprovação</label>
        <label className="col-span-full flex items-center gap-2 text-sm"><input type="checkbox" name="whatsapp_notificacoes" defaultChecked={(c.whatsapp_notificacoes ?? "true") === "true"} /> Enviar notificações automáticas por WhatsApp</label>
        <div><label className="label">Lembrete de recompra (dias antes de acabar)</label><input name="recompra_dias_antes" className="input" defaultValue={c.recompra_dias_antes ?? "3"} /></div>
        <div><label className="label">Validade do PIX (minutos)</label><input name="pix_expiracao_minutos" className="input" defaultValue={c.pix_expiracao_minutos ?? "60"} /></div>
        <h2 className="h2 col-span-full mt-3">Vitrine e rodapé</h2>
        <div><label className="label">Parcelamento no cartão (máx. de parcelas)</label><input name="parcelas_max" className="input" inputMode="numeric" defaultValue={c.parcelas_max ?? "1"} /></div>
        <div><label className="label">Parcela mínima (R$)</label><input name="parcela_minima_centavos" className="input" inputMode="decimal" defaultValue={reais(c, "parcela_minima_centavos")} /></div>
        <p className="col-span-full -mt-1 text-xs text-ink-3">Com 1 parcela o card não mostra parcelamento. Só ative se a maquininha da entrega parcela sem juros.</p>
        <div><label className="label">Instagram (@usuario)</label><input name="loja_instagram" className="input" defaultValue={c.loja_instagram} placeholder="@casaderacao" /></div>
        <div><label className="label">Horário de atendimento</label><input name="loja_horario" className="input" defaultValue={c.loja_horario} placeholder="Seg a sáb, 8h às 19h" /></div>
        <div><label className="label">CNPJ (aparece no rodapé)</label><input name="loja_cnpj" className="input" defaultValue={c.loja_cnpj} /></div>
        <p className="col-span-full text-xs text-ink-3">Provedor de WhatsApp e token do Mercado Pago ficam nas variáveis de ambiente (ver README). Status em Admin → Notificações.</p>
        <div className="col-span-full"><button className="btn-primary">Salvar</button></div>
      </FormAction>
    </div>
  );
}

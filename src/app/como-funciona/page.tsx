import Link from "next/link";
import { sql, getConfig } from "@/lib/db";
import { brl, DIAS_SEMANA } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Como funciona a entrega",
  description: "Zonas, dias e horários de entrega, frete grátis, entrega expressa, retirada na loja e formas de pagamento.",
  alternates: { canonical: "/como-funciona" },
};

const hora = (t: string) => { const [h, m] = t.split(":"); return m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`; };

export default async function ComoFunciona() {
  const cfg = await getConfig();
  const zonas = (await sql`
    SELECT z.nome, z.taxa_centavos, z.dias_entrega,
      (SELECT json_agg(json_build_object('corte', j.corte::text, 'inicio', j.inicio::text, 'fim', j.fim::text) ORDER BY j.inicio) FROM janelas j WHERE j.zona_id = z.id AND j.ativa) AS janelas
    FROM zonas z WHERE z.ativa ORDER BY z.ordem, z.nome
  `) as { nome: string; taxa_centavos: number; dias_entrega: number[]; janelas: { corte: string; inicio: string; fim: string }[] | null }[];
  const gratis = Number(cfg.frete_gratis_minimo_centavos ?? 0);
  const expresso = cfg.expresso_ativo === "true";

  const Bloco = ({ icone, titulo, children }: { icone: string; titulo: string; children: React.ReactNode }) => (
    <section data-reveal className="card flex gap-4">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-pine-50 text-2xl" aria-hidden>{icone}</span>
      <div className="min-w-0 flex-1 space-y-1.5 text-[15px] text-ink-2"><h2 className="h2 text-ink">{titulo}</h2>{children}</div>
    </section>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="h1">Como funciona a entrega</h1>
        <p className="muted mt-1">Tudo o que você precisa saber antes de pedir. Informe seu CEP no topo para ver o dia exato da sua entrega.</p>
      </div>

      <Bloco icone="🗺️" titulo="Entrega em rota pelo bairro">
        <p>Montamos rotas por região. Cada região tem seus dias e horários:</p>
        {zonas.length === 0 ? <p className="text-ink-3">As regiões ainda estão sendo cadastradas.</p> : (
          <ul className="mt-2 divide-y divide-line rounded-2xl border border-line">
            {zonas.map((z) => (
              <li key={z.nome} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                <span className="font-bold text-ink">{z.nome}</span>
                <span className="text-ink-2">
                  {z.dias_entrega.slice().sort().map((d) => DIAS_SEMANA[d]).join(", ")}
                  {z.janelas?.map((j) => ` · pedidos até ${hora(j.corte)} chegam ${hora(j.inicio)}–${hora(j.fim)}`).join("")}
                </span>
                <span className="font-semibold text-ink">{z.taxa_centavos ? brl(z.taxa_centavos) : "Frete grátis"}</span>
              </li>
            ))}
          </ul>
        )}
      </Bloco>

      {gratis > 0 && (
        <Bloco icone="🚚" titulo={`Frete grátis acima de ${brl(gratis)}`}>
          <p>Na rota do bairro, pedidos a partir de {brl(gratis)} não pagam entrega.</p>
          {Number(cfg.peso_extra_limite_kg) > 0 && Number(cfg.peso_extra_taxa_centavos) > 0 && (
            <p className="text-sm text-ink-3">Pedidos acima de {cfg.peso_extra_limite_kg} kg têm adicional de {brl(Number(cfg.peso_extra_taxa_centavos))} a cada {cfg.peso_extra_bloco_kg} kg.</p>
          )}
        </Bloco>
      )}

      {expresso && (
        <Bloco icone="⚡" titulo="Entrega expressa">
          <p>Para pedidos de até {cfg.expresso_peso_max_kg} kg, entregamos em até {cfg.expresso_prazo_horas}h por {brl(Number(cfg.expresso_taxa_centavos ?? 0))}.</p>
        </Bloco>
      )}

      <Bloco icone="🛍️" titulo="Retirada na loja: grátis">
        <p>Fica pronto em cerca de {cfg.retirada_prazo_horas || 1}h{cfg.loja_endereco ? <> em <b className="text-ink">{cfg.loja_endereco}</b></> : ""}.</p>
      </Bloco>

      <Bloco icone="💳" titulo="Pagamento">
        <p><b className="text-ink">PIX</b> na hora do pedido, ou <b className="text-ink">dinheiro</b> e <b className="text-ink">cartão</b> na entrega. Se precisar de troco, avise no pedido.</p>
      </Bloco>

      <Bloco icone="🔁" titulo="Assinatura">
        <p>Escolha a ração e o intervalo: o pedido é gerado sozinho antes de acabar. <Link href="/conta/assinaturas" className="font-bold text-pine-700 underline">Assinar</Link></p>
      </Bloco>
    </div>
  );
}

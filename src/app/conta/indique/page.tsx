import type { Metadata } from "next";
import Link from "next/link";
import { exigirSessao } from "@/lib/auth";
import { sql, getConfig } from "@/lib/db";
import { brl, dataBR } from "@/lib/utils";
import { codigoDoUsuario, configIndicacao, cuponsDisponiveis, linkIndicacao } from "@/lib/indicacao";
import { Compartilhar } from "./Compartilhar";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Indique e ganhe", robots: { index: false } };

type Amigo = { nome: string; status: string; motivo: string | null; criado_em: string; comprou: boolean };

export default async function IndiquePage() {
  const s = await exigirSessao();
  const cfg = await configIndicacao();
  const loja = (await getConfig()).loja_nome ?? "Casa de Ração";
  if (!cfg.ativa) {
    return (
      <div className="card-flat mx-auto max-w-md py-10 text-center">
        <div className="text-3xl">🎁</div><p className="mt-2 font-bold">Programa de indicação pausado</p>
        <p className="muted">Volte em breve.</p><Link href="/conta" className="btn-outline mt-4">Minha conta</Link>
      </div>
    );
  }
  const codigo = await codigoDoUsuario(s.id);
  const link = linkIndicacao(codigo);
  const amigos = (await sql`
    SELECT split_part(u.nome, ' ', 1) AS nome, i.status, i.motivo, i.criado_em::text,
      EXISTS (SELECT 1 FROM pedidos p WHERE p.cliente_id = u.id AND p.status <> 'cancelado') AS comprou
    FROM indicacoes i JOIN usuarios u ON u.id = i.indicado_id WHERE i.indicador_id = ${s.id} ORDER BY i.criado_em DESC
  `) as Amigo[];
  const cupons = (await cuponsDisponiveis(s.id)).filter((c) => !c.primeira_compra);
  const ganho = amigos.filter((a) => a.status === "premiado").length * cfg.premio;
  const texto = `Compro ração na ${loja} e entregam em casa 🐾 Use meu link e ganhe ${brl(cfg.desconto)} na primeira compra:`;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="h1">Indique e ganhe</h1>
        <Link href="/conta" className="btn-ghost ml-auto">‹ Minha conta</Link>
      </div>

      <section className="card space-y-4 bg-pine-700 text-white">
        <p className="text-lg font-extrabold leading-snug">Seu amigo ganha {brl(cfg.desconto)} na primeira compra. Você ganha {brl(cfg.premio)} quando ele receber o pedido.</p>
        <ol className="grid gap-2 text-sm text-pine-100 sm:grid-cols-3">
          <li><b className="text-white">1.</b> Mande seu link</li>
          <li><b className="text-white">2.</b> O amigo cria a conta e compra{cfg.minimo > 0 ? ` (a partir de ${brl(cfg.minimo)})` : ""}</li>
          <li><b className="text-white">3.</b> Pedido entregue: seu cupom chega no WhatsApp</li>
        </ol>
      </section>

      <section className="card"><Compartilhar link={link} texto={texto} /></section>

      {cupons.length > 0 && (
        <section className="card space-y-2" data-testid="meus-cupons">
          <h2 className="h2">Seus cupons</h2>
          {cupons.map((c) => (
            <div key={c.codigo} className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-kibble-500 p-3 text-sm">
              <div><b className="text-base">{brl(c.valor)}</b> · {c.descricao}<div className="text-xs text-ink-3">Cupom {c.codigo}{c.valido_ate ? ` · até ${dataBR(c.valido_ate)}` : ""}{c.minimo_centavos ? ` · pedidos a partir de ${brl(c.minimo_centavos)}` : ""}</div></div>
              <Link href="/carrinho" className="btn-outline shrink-0 min-h-[40px]">Usar</Link>
            </div>
          ))}
          <p className="text-xs text-ink-3">O cupom entra sozinho no checkout.</p>
        </section>
      )}

      <section className="card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="h2">Amigos indicados ({amigos.length})</h2>
          {ganho > 0 && <span className="badge bg-pine-100 text-pine-800">Você já ganhou {brl(ganho)}</span>}
        </div>
        {amigos.length === 0 ? <p className="muted">Ninguém ainda. Que tal mandar para quem também tem pet?</p> : (
          <ul className="divide-y divide-line text-sm">
            {amigos.map((a, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                <span><b>{a.nome}</b> <span className="text-ink-3">· desde {dataBR(a.criado_em.slice(0, 10))}</span></span>
                {a.status === "premiado" ? <span className="badge bg-pine-100 text-pine-800">✓ você ganhou {brl(cfg.premio)}</span>
                  : a.status === "recusado" ? <span className="badge bg-page text-ink-3" title={a.motivo ?? ""}>não vale ({a.motivo?.toLowerCase() ?? "regra"})</span>
                  : a.comprou ? <span className="badge bg-kibble-50 text-ink">comprou · aguardando entrega</span>
                  : <span className="badge bg-page text-ink-2">criou a conta</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="text-xs text-ink-3">Vale um prêmio por amigo, no primeiro pedido entregue. Pedidos entregues no seu próprio endereço não contam. Cupons valem uma vez.</p>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { sql, getConfig } from "@/lib/db";
import { tokenValido } from "@/lib/confirmacao";
import { BotoesConfirmacao } from "./BotoesConfirmacao";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Confirmar entrega", robots: { index: false, follow: false } };

const hm = (t?: string | null) => (t ? t.slice(0, 5) : "");

export default async function ConfirmarPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const { id } = await params;
  const { t } = await searchParams;
  const valido = /^[0-9a-f-]{36}$/i.test(id) && tokenValido(id, t);
  const [p] = valido
    ? ((await sql`
        SELECT p.numero, p.status, p.confirmacao, p.data_entrega::text, p.endereco, p.forma_pagamento, p.total_centavos, j.inicio::text, j.fim::text, u.nome
        FROM pedidos p JOIN usuarios u ON u.id = p.cliente_id LEFT JOIN janelas j ON j.id = p.janela_id WHERE p.id = ${id}
      `) as { numero: number; status: string; confirmacao: string | null; data_entrega: string | null; endereco: { logradouro?: string; numero?: string; complemento?: string; bairro?: string } | null; forma_pagamento: string; total_centavos: number; inicio: string | null; fim: string | null; nome: string }[])
    : [];
  const cfg = await getConfig();
  const zap = (cfg.loja_whatsapp ?? "").replace(/\D/g, "");

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <div className="card space-y-4 p-5" data-reveal>
        {!p ? (
          <>
            <h1 className="h2">Link inválido</h1>
            <p className="muted">Não encontramos este pedido. Confira o link que chegou no WhatsApp.</p>
          </>
        ) : !["pago", "separado", "em_rota"].includes(p.status) ? (
          <>
            <h1 className="h2">Pedido #{p.numero}</h1>
            <p className="muted">Este pedido não está mais aguardando entrega.</p>
          </>
        ) : (
          <>
            <div>
              <p className="text-sm text-ink-3">Pedido #{p.numero}</p>
              <h1 className="h2">Vai ter alguém para receber, {p.nome.split(" ")[0]}?</h1>
            </div>
            <dl className="space-y-1 text-sm">
              <div><dt className="inline font-semibold">Quando: </dt><dd className="inline">{p.data_entrega ? `${p.data_entrega.slice(8, 10)}/${p.data_entrega.slice(5, 7)}` : "em breve"}{p.inicio ? `, entre ${hm(p.inicio)} e ${hm(p.fim)}` : ""}</dd></div>
              {p.endereco && <div><dt className="inline font-semibold">Onde: </dt><dd className="inline">{[p.endereco.logradouro, p.endereco.numero].filter(Boolean).join(", ")}{p.endereco.complemento ? ` — ${p.endereco.complemento}` : ""}{p.endereco.bairro ? ` (${p.endereco.bairro})` : ""}</dd></div>}
            </dl>
            <BotoesConfirmacao id={id} t={t ?? ""} atual={p.confirmacao as "sim" | "nao" | null} emRota={p.status === "em_rota"} />
            {zap && <p className="text-xs text-ink-3">Precisa mudar algo? <a className="font-semibold text-pine-700 underline" href={`https://wa.me/${zap.startsWith("55") ? zap : `55${zap}`}?text=${encodeURIComponent(`Oi! Sobre o pedido #${p.numero}...`)}`}>Fale com a loja no WhatsApp</a>.</p>}
          </>
        )}
        <Link href="/" className="text-sm font-semibold text-pine-700 underline">Ir para a loja</Link>
      </div>
    </main>
  );
}

import type React from "react";
import Link from "next/link";
import { exigirSessao } from "@/lib/auth";
import { sql } from "@/lib/db";
import { brl, dataBR, STATUS_PEDIDO, TIPO_ENTREGA, mascaraCep } from "@/lib/utils";
import { logoutAction } from "../login/actions";
import { EnderecoForm, ExcluirEnderecoBotao, LembretesToggle } from "./ContaClient";
import { ComprarDeNovo } from "@/components/ComprarDeNovo";
import { itensParaRepetir } from "@/lib/repetir";

export const dynamic = "force-dynamic";

export default async function ContaPage({ searchParams }: { searchParams: Promise<{ senha?: string }> }) {
  const { senha } = await searchParams;
  const s = await exigirSessao();
  const pedidos = (await sql`
    SELECT id, numero, status, tipo_entrega, data_entrega, total_centavos, criado_em
    FROM pedidos WHERE cliente_id = ${s.id} ORDER BY criado_em DESC LIMIT 50
  `) as { id: string; numero: number; status: string; tipo_entrega: string; data_entrega: string | null; total_centavos: number; criado_em: string }[];
  const enderecos = (await sql`
    SELECT id, apelido, cep, logradouro, numero, complemento, bairro FROM enderecos WHERE usuario_id = ${s.id} ORDER BY padrao DESC, criado_em
  `) as { id: string; apelido: string; cep: string; logradouro: string; numero: string; complemento: string | null; bairro: string }[];
  const ultimo = pedidos.find((p) => p.status === "entregue");
  const repetir = ultimo ? await itensParaRepetir(ultimo.id) : null;
  const [{ n: nFav }] = (await sql`SELECT count(*)::int AS n FROM favoritos WHERE usuario_id = ${s.id}`) as { n: number }[];
  const [me] = (await sql`SELECT aceita_lembretes FROM usuarios WHERE id = ${s.id}`) as { aceita_lembretes: boolean }[];

  return (
    <div className="space-y-6">
      {senha && <div className="rounded-xl bg-pine-50 px-4 py-3 text-sm font-semibold text-pine-800">Senha trocada. Você já está conectado.</div>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="h1">Olá, {s.nome.split(" ")[0]}</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/conta/favoritos" className="btn-outline">Favoritos{nFav ? ` (${nFav})` : ""}</Link>
          <Link href="/conta/assinaturas" className="btn-outline">Assinaturas</Link>
          <form action={logoutAction}><button className="btn-ghost">Sair</button></form>
        </div>
      </div>

      {repetir && ultimo && <ComprarDeNovo compacto titulo={`Repetir o pedido #${ultimo.numero}`} itens={repetir.disponiveis} faltando={repetir.faltando} />}

      <section>
        <h2 className="h2 mb-3">Meus pedidos</h2>
        {pedidos.length === 0 ? (
          <div className="card-flat text-center"><p className="font-bold">Nenhum pedido ainda</p><p className="muted">Seu primeiro pedido aparece aqui.</p><Link href="/" className="btn-primary mt-3">Ver produtos</Link></div>
        ) : (
          <div className="space-y-2">
            {pedidos.map((p, i) => (
              <Link key={p.id} data-reveal style={{ "--i": i } as React.CSSProperties} href={`/conta/pedido/${p.id}`} className="card flex transition-transform duration-200 ease-out hover:-translate-y-0.5 active:scale-[.99] items-center justify-between gap-3 hover:border-pine-200">
                <div>
                  <div className="font-bold">Pedido #{p.numero}</div>
                  <div className="muted">{TIPO_ENTREGA[p.tipo_entrega]} · {dataBR(p.data_entrega)}</div>
                </div>
                <div className="text-right">
                  <div className="font-extrabold">{brl(p.total_centavos)}</div>
                  <span className={`badge ${STATUS_PEDIDO[p.status].cor}`}>{STATUS_PEDIDO[p.status].label}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="h2 mb-3">Endereços</h2>
        <div className="space-y-2">
          {enderecos.map((e) => (
            <div key={e.id} className="card flex items-center justify-between text-sm">
              <div><b>{e.apelido}</b> · {e.logradouro}, {e.numero}{e.complemento ? ` - ${e.complemento}` : ""} · {e.bairro} · {mascaraCep(e.cep)}</div>
              <ExcluirEnderecoBotao id={e.id} />
            </div>
          ))}
        </div>
        <EnderecoForm />
      </section>

      <section className="card flex items-center justify-between text-sm">
        <div><b>Lembretes no WhatsApp</b><div className="muted">Quando a ração estiver acabando ou se você esquecer itens no carrinho.</div></div>
        <LembretesToggle ativo={me?.aceita_lembretes ?? true} />
      </section>
    </div>
  );
}

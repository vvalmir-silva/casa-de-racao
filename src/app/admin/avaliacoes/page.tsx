import Link from "next/link";
import { sql } from "@/lib/db";
import { dataBR } from "@/lib/utils";
import { FormAction, BotaoAction } from "@/components/FormAction";
import { publicarAvaliacao, responderAvaliacao } from "../actions";

export const dynamic = "force-dynamic";

type Av = {
  id: number; pedido_id: string; numero: number; cliente: string; nota: number; comentario: string | null;
  publicada: boolean; resposta: string | null; criado_em: string;
};

const estrelas = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);

export default async function AvaliacoesAdmin({ searchParams }: { searchParams: Promise<{ nota?: string }> }) {
  const { nota } = await searchParams;
  const filtro = nota === "baixa" ? 3 : null;
  const [r] = (await sql`
    SELECT count(*)::int AS total, coalesce(round(avg(nota)::numeric, 1), 0)::float AS media,
           count(*) FILTER (WHERE nota <= 3)::int AS baixas,
           count(*) FILTER (WHERE publicada)::int AS publicadas,
           (SELECT count(*)::int FROM pedidos WHERE status = 'entregue' AND entregue_em > now() - interval '90 days') AS entregues
    FROM avaliacoes
  `) as { total: number; media: number; baixas: number; publicadas: number; entregues: number }[];
  const lista = (await sql`
    SELECT a.id, a.pedido_id, p.numero, u.nome AS cliente, a.nota, a.comentario, a.publicada, a.resposta, a.criado_em::text
    FROM avaliacoes a JOIN pedidos p ON p.id = a.pedido_id JOIN usuarios u ON u.id = a.cliente_id
    WHERE (${filtro}::int IS NULL OR a.nota <= ${filtro})
    ORDER BY a.criado_em DESC LIMIT 200
  `) as Av[];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="h1">Avaliações</h1>
        <p className="muted">O cliente recebe o link pelo WhatsApp quando o pedido é entregue. Notas 4 e 5 com comentário vão para a página inicial automaticamente (ajuste em Configurações).</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="stat"><div className="stat-t">Nota média</div><div className="stat-v">{r.total ? `${String(r.media).replace(".", ",")} ★` : "—"}</div></div>
        <div className="stat"><div className="stat-t">Avaliações</div><div className="stat-v">{r.total}</div></div>
        <Link href="/admin/avaliacoes?nota=baixa" className="stat hover:border-pine-200"><div className="stat-t">Notas 1 a 3</div><div className="stat-v">{r.baixas}</div></Link>
        <div className="stat"><div className="stat-t">Na vitrine</div><div className="stat-v">{r.publicadas}</div></div>
      </div>
      {filtro && <Link href="/admin/avaliacoes" className="btn-ghost">Mostrar todas</Link>}

      {lista.length === 0 ? (
        <div className="card text-center">
          <div className="text-3xl">⭐</div>
          <p className="mt-2 font-extrabold">Nenhuma avaliação ainda</p>
          <p className="muted">Elas aparecem aqui depois que os primeiros pedidos forem entregues.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lista.map((a) => (
            <div key={a.id} className={`card space-y-2 ${a.nota <= 3 ? "border-red-200" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className={`text-lg leading-none ${a.nota <= 3 ? "text-red-500" : "text-kibble-500"}`} aria-label={`${a.nota} de 5`}>{estrelas(a.nota)}</div>
                  <div className="mt-1 text-sm text-ink-3"><b className="text-ink-2">{a.cliente}</b> · <Link href={`/conta/pedido/${a.pedido_id}`} className="underline">pedido #{a.numero}</Link> · {dataBR(a.criado_em)}</div>
                </div>
                <BotaoAction action={publicarAvaliacao} args={[a.id, !a.publicada]} className={a.publicada ? "btn-outline" : "btn-ghost"}>
                  {a.publicada ? "Tirar da vitrine" : "Mostrar na vitrine"}
                </BotaoAction>
              </div>
              {a.comentario ? <p className="text-ink">“{a.comentario}”</p> : <p className="text-sm italic text-ink-4">Sem comentário</p>}
              <FormAction action={responderAvaliacao} className="flex gap-2">
                <input type="hidden" name="id" value={a.id} />
                <input name="resposta" className="input flex-1" defaultValue={a.resposta ?? ""} placeholder="Responder ao cliente (aparece no pedido dele)" maxLength={500} />
                <button className="btn-outline">Salvar</button>
              </FormAction>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { exigirSessao } from "@/lib/auth";
import { sql } from "@/lib/db";
import { brl, dataBR } from "@/lib/utils";
import { AssinaturaForm, AlternarAssinatura } from "./AssinaturasClient";

export const dynamic = "force-dynamic";

export default async function AssinaturasPage() {
  const s = await exigirSessao();
  const assinaturas = (await sql`
    SELECT a.id, a.qtd, a.intervalo_dias, a.proxima_data, a.ativa, p.nome AS produto, p.preco_centavos, e.apelido
    FROM assinaturas a JOIN produtos p ON p.id = a.produto_id JOIN enderecos e ON e.id = a.endereco_id
    WHERE a.cliente_id = ${s.id} ORDER BY a.ativa DESC, a.proxima_data
  `) as { id: string; qtd: number; intervalo_dias: number; proxima_data: string; ativa: boolean; produto: string; preco_centavos: number; apelido: string }[];
  const produtos = (await sql`SELECT id, nome, preco_centavos FROM produtos WHERE ativo AND estoque > 0 ORDER BY nome`) as { id: string; nome: string; preco_centavos: number }[];
  const enderecos = (await sql`SELECT id, apelido, logradouro, numero FROM enderecos WHERE usuario_id = ${s.id} ORDER BY padrao DESC`) as { id: string; apelido: string; logradouro: string; numero: string }[];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="h1">Assinaturas</h1>
        <p className="text-sm text-ink-2">A ração chega sozinha, no intervalo que você escolher. O pedido é gerado 2 dias antes e entregue na janela da sua zona.</p>
      </div>
      {assinaturas.map((a) => (
        <div key={a.id} className={`card flex items-center justify-between text-sm ${a.ativa ? "" : "opacity-60"}`}>
          <div>
            <div className="font-medium">{a.qtd}× {a.produto}</div>
            <div className="text-xs text-ink-3">a cada {a.intervalo_dias} dias · próxima {dataBR(a.proxima_data)} · {a.apelido} · {brl(a.preco_centavos * a.qtd)}</div>
          </div>
          <AlternarAssinatura id={a.id} ativa={a.ativa} />
        </div>
      ))}
      {enderecos.length === 0 ? (
        <p className="muted">Cadastre um endereço em <a href="/conta" className="underline">Minha conta</a> para assinar.</p>
      ) : (
        <AssinaturaForm produtos={produtos} enderecos={enderecos} />
      )}
    </div>
  );
}

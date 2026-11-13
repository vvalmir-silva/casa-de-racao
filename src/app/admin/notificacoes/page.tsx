import { sql } from "@/lib/db";
import { dataHoraBR, mascaraTelefone } from "@/lib/utils";
import { FormAction } from "@/components/FormAction";
import { testarWhatsApp } from "../actions";
import { pixAutomaticoAtivo } from "@/lib/pix";

export const dynamic = "force-dynamic";

type N = { id: number; telefone: string; tipo: string; mensagem: string; status: string; erro: string | null; criado_em: string; numero: number | null };

export default async function NotificacoesAdmin() {
  const provider = (process.env.WHATSAPP_PROVIDER ?? "none").toLowerCase();
  const lista = (await sql`
    SELECT n.id, n.telefone, n.tipo, n.mensagem, n.status, n.erro, n.criado_em, p.numero
    FROM notificacoes n LEFT JOIN pedidos p ON p.id = n.pedido_id ORDER BY n.criado_em DESC LIMIT 100
  `) as N[];
  const cor: Record<string, string> = { enviada: "bg-green-100 text-green-800", erro: "bg-red-100 text-red-700", desativado: "bg-stone-100 text-stone-600", pendente: "bg-yellow-100 text-yellow-800" };
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Notificações</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="card text-sm">
          <div className="font-semibold">WhatsApp</div>
          <div className={provider === "none" ? "text-red-700" : "text-green-700"}>{provider === "none" ? "Não configurado (WHATSAPP_PROVIDER=none)" : `Provedor: ${provider}`}</div>
          <FormAction action={testarWhatsApp} className="mt-2 flex gap-2">
            <input name="telefone" className="input" placeholder="Seu número para teste" />
            <button className="btn-outline">Enviar teste</button>
          </FormAction>
        </div>
        <div className="card text-sm">
          <div className="font-semibold">PIX automático (Mercado Pago)</div>
          <div className={pixAutomaticoAtivo() ? "text-green-700" : "text-red-700"}>{pixAutomaticoAtivo() ? "Ativo — QR Code gerado no pedido e confirmação via webhook" : "Inativo (defina MP_ACCESS_TOKEN) — cliente vê a chave PIX manual"}</div>
          <div className="mt-1 text-xs text-stone-500">Webhook: <code>/api/webhooks/mercadopago</code></div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="table">
          <thead><tr><th>Quando</th><th>Pedido</th><th>Para</th><th>Tipo</th><th>Status</th><th>Mensagem</th></tr></thead>
          <tbody>
            {lista.map((n) => (
              <tr key={n.id}>
                <td className="whitespace-nowrap">{dataHoraBR(n.criado_em)}</td>
                <td>{n.numero ? `#${n.numero}` : "—"}</td>
                <td className="whitespace-nowrap">{mascaraTelefone(n.telefone.replace(/^55/, ""))}</td>
                <td>{n.tipo}</td>
                <td><span className={`badge ${cor[n.status] ?? ""}`}>{n.status}</span>{n.erro && <div className="max-w-[200px] truncate text-xs text-red-600" title={n.erro}>{n.erro}</div>}</td>
                <td className="max-w-[320px] whitespace-pre-line text-xs text-stone-600">{n.mensagem}</td>
              </tr>
            ))}
            {lista.length === 0 && <tr><td colSpan={6} className="text-stone-500">Nenhuma notificação ainda.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

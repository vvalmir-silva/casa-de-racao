import { NextRequest, NextResponse } from "next/server";
import { getSessao } from "@/lib/auth";
import { sql } from "@/lib/db";
import { obterOuCriarPix, sincronizarPagamento, pixAutomaticoAtivo } from "@/lib/pix";

export const dynamic = "force-dynamic";

/** Status do pedido + cobrança PIX. Usado pelo polling da página do pedido. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSessao();
  if (!s) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
  const { id } = await params;
  const rows = (await sql`SELECT status, cliente_id, forma_pagamento FROM pedidos WHERE id = ${id}`) as { status: string; cliente_id: string; forma_pagamento: string }[];
  const p = rows[0];
  if (!p || (p.cliente_id !== s.id && s.papel !== "admin")) return NextResponse.json({ erro: "não encontrado" }, { status: 404 });

  let pix = null;
  if (p.forma_pagamento === "pix" && pixAutomaticoAtivo()) {
    pix = await obterOuCriarPix(id);
    // fallback caso o webhook atrase
    if (pix && pix.status === "pending" && p.status === "aguardando_pagamento" && req.nextUrl.searchParams.get("sync") === "1") {
      try { const r = await sincronizarPagamento(pix.externo_id); pix = { ...pix, status: r.status }; } catch {}
      const again = (await sql`SELECT status FROM pedidos WHERE id = ${id}`) as { status: string }[];
      p.status = again[0].status;
    }
  }
  return NextResponse.json({ status: p.status, pix: pix ? { qr_code: pix.qr_code, qr_code_base64: pix.qr_code_base64, expira_em: pix.expira_em, status: pix.status } : null });
}

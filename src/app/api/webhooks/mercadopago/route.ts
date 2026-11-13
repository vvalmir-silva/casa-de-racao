import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { sincronizarPagamento, pixAutomaticoAtivo } from "@/lib/pix";

export const dynamic = "force-dynamic";

/** Valida x-signature do Mercado Pago quando MP_WEBHOOK_SECRET está definido. */
function assinaturaValida(req: NextRequest, dataId: string) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true;
  const sig = req.headers.get("x-signature") ?? "";
  const reqId = req.headers.get("x-request-id") ?? "";
  const parts = Object.fromEntries(sig.split(",").map((p) => p.trim().split("=") as [string, string]));
  if (!parts.ts || !parts.v1) return false;
  const manifest = `id:${dataId};request-id:${reqId};ts:${parts.ts};`;
  const hmac = createHmac("sha256", secret).update(manifest).digest("hex");
  return hmac === parts.v1;
}

export async function POST(req: NextRequest) {
  if (!pixAutomaticoAtivo()) return NextResponse.json({ ok: false }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const dataId = String(body?.data?.id ?? req.nextUrl.searchParams.get("data.id") ?? req.nextUrl.searchParams.get("id") ?? "");
  const type = String(body?.type ?? body?.action ?? req.nextUrl.searchParams.get("type") ?? "");
  if (!dataId) return NextResponse.json({ ok: true, ignorado: true });
  if (!assinaturaValida(req, dataId)) return NextResponse.json({ erro: "assinatura inválida" }, { status: 401 });
  if (type && !type.includes("payment")) return NextResponse.json({ ok: true, ignorado: true });
  try {
    const r = await sincronizarPagamento(dataId);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error("webhook MP", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { getSessao } from "@/lib/auth";
import { validarCupom } from "@/lib/cupons";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const s = await getSessao();
  const r = await validarCupom(sp.get("codigo") ?? "", s?.id ?? null, Number(sp.get("subtotal") ?? 0), Number(sp.get("frete") ?? 0));
  if (!r.ok) return NextResponse.json(r, { status: 400 });
  return NextResponse.json({ ok: true, codigo: r.cupom.codigo, descricao: r.cupom.descricao, tipo: r.cupom.tipo, desconto_centavos: r.desconto_centavos, frete_gratis: r.frete_gratis });
}

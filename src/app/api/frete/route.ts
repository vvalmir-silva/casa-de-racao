import { NextRequest, NextResponse } from "next/server";
import { calcularFrete } from "@/lib/frete";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const cep = sp.get("cep") ?? "";
  const subtotal = Number(sp.get("subtotal") ?? 0);
  const peso = Number(sp.get("peso") ?? 0);
  const r = await calcularFrete({ cep, subtotal_centavos: subtotal, peso_kg: peso });
  return NextResponse.json(r, { headers: { "Cache-Control": "no-store" } });
}

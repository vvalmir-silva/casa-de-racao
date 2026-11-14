import { NextRequest, NextResponse } from "next/server";
import { indicadorPorCodigo, normalizarIndicacao } from "@/lib/indicacao";

export const dynamic = "force-dynamic";

/** Link de indicação: guarda o código por 60 dias (o amigo pode navegar antes de criar a conta) e abre o cadastro. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  const codigo = normalizarIndicacao((await params).codigo);
  const ind = await indicadorPorCodigo(codigo);
  if (!ind) return NextResponse.redirect(new URL("/", req.url));
  const res = NextResponse.redirect(new URL(`/cadastro?ind=${codigo}`, req.url));
  res.cookies.set("cr_ind", codigo, { maxAge: 60 * 60 * 24 * 60, httpOnly: true, sameSite: "lax", secure: req.nextUrl.protocol === "https:", path: "/" });
  return res;
}

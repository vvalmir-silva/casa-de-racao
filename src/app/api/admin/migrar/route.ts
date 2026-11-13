import { NextRequest, NextResponse } from "next/server";
import { getSessao } from "@/lib/auth";
import { aplicarMigracoes } from "@/lib/migrar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Aplica migrações pendentes. Acesso: admin logado OU ?token=CRON_SECRET. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? req.headers.get("authorization")?.replace("Bearer ", "");
  const s = await getSessao();
  const ok = (process.env.CRON_SECRET && token === process.env.CRON_SECRET) || s?.papel === "admin";
  if (!ok) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  try {
    return NextResponse.json(await aplicarMigracoes());
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

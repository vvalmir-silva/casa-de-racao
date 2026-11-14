import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

/** Produtos para completar o frete grátis: os de preço mais perto do que falta (primeiro os que já bastam). */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const falta = Math.max(0, Math.min(1_000_000, Number(u.searchParams.get("falta")) || 0));
  const excluir = (u.searchParams.get("excluir") ?? "").split(",").filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 50);
  if (!falta) return NextResponse.json({ itens: [] });
  try {
    const itens = await sql`
      SELECT id, slug, nome, marca, peso_kg, preco_centavos, preco_de_centavos, estoque, imagem_url
      FROM produtos
      WHERE ativo AND estoque > 0 AND NOT (id = ANY(${excluir}::uuid[]))
      ORDER BY (preco_centavos >= ${falta}) DESC, abs(preco_centavos - ${falta}), destaque DESC
      LIMIT 8
    `;
    return NextResponse.json({ itens });
  } catch {
    return NextResponse.json({ itens: [] });
  }
}

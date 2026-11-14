import { NextResponse } from "next/server";
import { buscarProdutos } from "@/lib/busca";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.slice(0, 80) ?? "";
  if (q.trim().length < 2) return NextResponse.json({ itens: [] });
  try {
    const r = await buscarProdutos(q, 6);
    return NextResponse.json(
      { itens: r.map((p) => ({ slug: p.slug, nome: p.nome, marca: p.marca, preco_centavos: p.preco_centavos, imagem_url: p.imagem_url, estoque: p.estoque })) },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  } catch {
    return NextResponse.json({ itens: [] }, { status: 200 });
  }
}

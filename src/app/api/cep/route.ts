import { NextRequest, NextResponse } from "next/server";

// Consulta ViaCEP para preencher o endereço
export async function GET(req: NextRequest) {
  const cep = (req.nextUrl.searchParams.get("cep") ?? "").replace(/\D/g, "");
  if (cep.length !== 8) return NextResponse.json({ erro: "CEP inválido" }, { status: 400 });
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { next: { revalidate: 86400 } });
    const j = await r.json();
    if (j.erro) return NextResponse.json({ erro: "CEP não encontrado" }, { status: 404 });
    return NextResponse.json({ logradouro: j.logradouro, bairro: j.bairro, cidade: j.localidade, uf: j.uf });
  } catch {
    return NextResponse.json({ erro: "Falha ao consultar CEP" }, { status: 502 });
  }
}

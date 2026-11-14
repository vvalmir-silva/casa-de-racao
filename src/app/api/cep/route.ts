import { NextRequest, NextResponse } from "next/server";

export type EnderecoCep = { cep: string; logradouro: string; bairro: string; cidade: string; uf: string; fonte: string };

type Provedor = { nome: string; buscar: (cep: string) => Promise<EnderecoCep | "nao_encontrado" | null> };

const TIMEOUT = 4000;

async function getJson(url: string): Promise<{ status: number; json: Record<string, unknown> | null }> {
  const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT), headers: { Accept: "application/json" }, next: { revalidate: 60 * 60 * 24 * 7 } });
  const json = await r.json().catch(() => null);
  return { status: r.status, json };
}

const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Ordem: ViaCEP → BrasilAPI → OpenCEP. Se um cair ou demorar, tenta o próximo. */
const provedores: Provedor[] = [
  {
    nome: "viacep",
    buscar: async (cep) => {
      const { status, json } = await getJson(`https://viacep.com.br/ws/${cep}/json/`);
      if (status >= 500 || !json) return null;
      if (json.erro === true || json.erro === "true" || status === 400) return "nao_encontrado";
      return { cep, logradouro: s(json.logradouro), bairro: s(json.bairro), cidade: s(json.localidade), uf: s(json.uf), fonte: "viacep" };
    },
  },
  {
    nome: "brasilapi",
    buscar: async (cep) => {
      const { status, json } = await getJson(`https://brasilapi.com.br/api/cep/v2/${cep}`);
      if (status === 404) return "nao_encontrado";
      if (status !== 200 || !json) return null;
      return { cep, logradouro: s(json.street), bairro: s(json.neighborhood), cidade: s(json.city), uf: s(json.state), fonte: "brasilapi" };
    },
  },
  {
    nome: "opencep",
    buscar: async (cep) => {
      const { status, json } = await getJson(`https://opencep.com/v1/${cep}`);
      if (status === 404) return "nao_encontrado";
      if (status !== 200 || !json) return null;
      return { cep, logradouro: s(json.logradouro), bairro: s(json.bairro), cidade: s(json.localidade), uf: s(json.uf), fonte: "opencep" };
    },
  },
];

export async function GET(req: NextRequest) {
  const cep = (req.nextUrl.searchParams.get("cep") ?? "").replace(/\D/g, "");
  if (cep.length !== 8) return NextResponse.json({ erro: "CEP precisa ter 8 números." }, { status: 400 });

  let naoEncontrado = 0;
  for (const p of provedores) {
    try {
      const r = await p.buscar(cep);
      if (r === "nao_encontrado") { naoEncontrado++; continue; }
      if (r && r.cidade && r.uf) {
        return NextResponse.json(r, { headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=86400" } });
      }
    } catch (e) {
      console.warn(`CEP ${p.nome} falhou`, e instanceof Error ? e.message : e);
    }
  }
  if (naoEncontrado > 0) return NextResponse.json({ erro: "CEP não encontrado." }, { status: 404 });
  return NextResponse.json({ erro: "Não foi possível buscar o CEP agora." }, { status: 502 });
}

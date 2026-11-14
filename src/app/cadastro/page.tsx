import { Suspense } from "react";
import { cookies } from "next/headers";
import { CadastroForm } from "./CadastroForm";
import { configIndicacao, indicadorPorCodigo, normalizarIndicacao } from "@/lib/indicacao";

export default async function CadastroPage({ searchParams }: { searchParams: Promise<{ ind?: string }> }) {
  const codigo = normalizarIndicacao((await searchParams).ind || (await cookies()).get("cr_ind")?.value);
  const cfg = await configIndicacao();
  const ind = codigo && cfg.ativa ? await indicadorPorCodigo(codigo) : null;
  const convite = ind ? { codigo, nome: ind.nome.split(" ")[0], desconto: cfg.desconto, minimo: cfg.minimo } : null;
  return <Suspense><CadastroForm convite={convite} /></Suspense>;
}

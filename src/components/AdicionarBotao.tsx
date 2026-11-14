"use client";

import Link from "next/link";
import { useCarrinho } from "@/lib/carrinho";
import { brl } from "@/lib/utils";
import { Contador, type ProdutoResumo } from "./ProdutoCard";
import { IconCart } from "./Icons";

/** Na página do produto: contador + ir ao carrinho. No celular fica fixo no rodapé. */
export function AdicionarBotao({ p }: { p: ProdutoResumo }) {
  const { itens, adicionar } = useCarrinho();
  const item = itens.find((i) => i.id === p.id);
  const sem = p.estoque <= 0;

  const conteudo = sem ? (
    <button className="btn-outline w-full rounded-full" disabled>Esgotado</button>
  ) : item ? (
    <div className="flex items-center gap-3">
      <Contador p={p} grande />
      <Link href="/carrinho" className="btn-primary flex-1 rounded-full">Ver carrinho · {brl(item.qtd * p.preco_centavos)}</Link>
    </div>
  ) : (
    <button className="btn-primary w-full rounded-full text-[16px]" onClick={() => adicionar({ ...p, peso_kg: Number(p.peso_kg) })}>
      <IconCart width={20} height={20} /> Adicionar · {brl(p.preco_centavos)}
    </button>
  );

  return (
    <>
      <div className="hidden md:block">{conteudo}</div>
      <div className="fixed inset-x-0 bottom-[64px] z-20 border-t border-line/70 bg-white/95 p-3 backdrop-blur-xl md:hidden">{conteudo}</div>
    </>
  );
}

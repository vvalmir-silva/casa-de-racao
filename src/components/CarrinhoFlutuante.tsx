"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCarrinho } from "@/lib/carrinho";
import { brl } from "@/lib/utils";
import { IconChevron } from "./Icons";

/** Barra "Ver carrinho" que aparece no celular quando há itens. */
export function CarrinhoFlutuante() {
  const { quantidade, subtotal, pronto } = useCarrinho();
  const path = usePathname();
  const esconder = !pronto || quantidade === 0 || path.startsWith("/carrinho") || path.startsWith("/checkout") || path.startsWith("/admin") || path.startsWith("/motorista") || path.startsWith("/produto");
  if (esconder) return null;
  const falta = 15000 - subtotal;
  return (
    <Link href="/carrinho" className="barra-flutuante fixed inset-x-3 bottom-[76px] z-30 flex animate-[subir_300ms_cubic-bezier(.16,1,.3,1)] items-center gap-3 rounded-2xl bg-pine-700 px-4 py-3 text-white shadow-pop md:hidden">
      <span className="grid h-8 min-w-8 place-items-center rounded-full bg-white/15 px-2 text-sm font-extrabold">{quantidade}</span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-[15px] font-extrabold">Ver carrinho</span>
        <span className="block truncate text-[12px] text-pine-100">{falta > 0 ? `Faltam ${brl(falta)} para frete grátis` : "Frete grátis na rota do bairro ✓"}</span>
      </span>
      <span className="text-[15px] font-extrabold">{brl(subtotal)}</span>
      <IconChevron width={18} height={18} />
    </Link>
  );
}

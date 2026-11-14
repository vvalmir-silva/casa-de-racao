"use client";

import { useFavoritos } from "@/lib/favoritos";

export function FavoritoBotao({ id, nome, grande }: { id: string; nome: string; grande?: boolean }) {
  const { tem, alternar } = useFavoritos();
  const on = tem(id);
  const tam = grande ? "h-12 w-12" : "h-9 w-9";
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Tirar ${nome} dos favoritos` : `Favoritar ${nome}`}
      title={on ? "Tirar dos favoritos" : "Favoritar"}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); alternar(id); }}
      className={`grid ${tam} shrink-0 place-items-center rounded-full transition active:scale-90 ${grande ? "bg-white" : "bg-white/90 backdrop-blur"} ${on ? "text-red-500" : "text-ink-3 hover:text-red-500"}`}
    >
      <svg width={grande ? 24 : 18} height={grande ? 24 : 18} viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinejoin="round" aria-hidden>
        <path d="M12 20.5s-7.5-4.6-7.5-10.3A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.6c0 5.7-7.5 10.3-7.5 10.3z" />
      </svg>
    </button>
  );
}

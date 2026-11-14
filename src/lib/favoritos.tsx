"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { alternarFavorito } from "@/app/favoritos-actions";

type Ctx = { tem: (id: string) => boolean; alternar: (id: string) => void; total: number };
const FavCtx = createContext<Ctx>({ tem: () => false, alternar: () => {}, total: 0 });

export function FavoritosProvider({ ids, logado, children }: { ids: string[]; logado: boolean; children: ReactNode }) {
  const [set, setSet] = useState(() => new Set(ids));
  const [, start] = useTransition();
  const router = useRouter();
  const path = usePathname();
  const chave = ids.join(",");
  // login/logout re-renderiza o layout com outra lista
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setSet(new Set(ids)); }, [chave]);

  const alternar = useCallback((id: string) => {
    if (!logado) { router.push(`/login?next=${encodeURIComponent(path)}`); return; }
    const antes = set.has(id);
    setSet((s) => { const n = new Set(s); if (antes) n.delete(id); else n.add(id); return n; });
    start(async () => {
      const r = await alternarFavorito(id);
      if (r.login) router.push(`/login?next=${encodeURIComponent(path)}`);
      if (r.erro || r.login || r.favorito === antes) {
        setSet((s) => { const n = new Set(s); if (antes) n.add(id); else n.delete(id); return n; });
      }
    });
  }, [logado, path, router, set]);

  const api = useMemo<Ctx>(() => ({ tem: (id) => set.has(id), alternar, total: set.size }), [set, alternar]);
  return <FavCtx.Provider value={api}>{children}</FavCtx.Provider>;
}

export const useFavoritos = () => useContext(FavCtx);

"use client";

import { useEffect, useState } from "react";

type BeforeInstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Registra o service worker e oferece "Instalar app" quando o navegador permite. */
export function Pwa() {
  const [evento, setEvento] = useState<BeforeInstallPrompt | null>(null);
  const [fechado, setFechado] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    try { setFechado(localStorage.getItem("cr_pwa_fechado") === "1"); } catch { setFechado(false); }
    const h = (e: Event) => { e.preventDefault(); setEvento(e as BeforeInstallPrompt); };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);

  if (!evento || fechado) return null;
  return (
    <div className="fixed inset-x-3 bottom-[84px] z-40 flex items-center gap-3 rounded-2xl bg-ink p-3 text-white shadow-pop md:bottom-6 md:left-auto md:right-6 md:max-w-sm">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-pine-700 text-kibble-400">🐾</span>
      <div className="min-w-0 flex-1 text-sm"><b>Instale o app</b><div className="text-white/70">Peça ração em 2 toques, direto da tela inicial.</div></div>
      <button className="btn-accent min-h-[40px] px-3" onClick={async () => { await evento.prompt(); setEvento(null); }}>Instalar</button>
      <button className="px-1 text-white/60" aria-label="Fechar" onClick={() => { setFechado(true); try { localStorage.setItem("cr_pwa_fechado", "1"); } catch {} }}>✕</button>
    </div>
  );
}

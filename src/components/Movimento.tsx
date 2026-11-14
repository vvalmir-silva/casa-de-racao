"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Liga as animações da página:
 * - [data-reveal] entra quando aparece na tela (com atraso em cascata por --i);
 * - <html data-rolou> e data-rolando="baixo|cima" para o topo ganhar sombra e a barra de baixo se esconder ao rolar.
 */
export function Movimento() {
  const path = usePathname();

  useEffect(() => {
    const html = document.documentElement;
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduzir || !("IntersectionObserver" in window)) {
      document.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.08 },
    );
    const observar = (raiz: ParentNode) => raiz.querySelectorAll?.("[data-reveal]:not(.is-in)").forEach((el) => io.observe(el));
    observar(document);
    // conteúdo que chega depois (streaming, refresh, listas que mudam)
    const mo = new MutationObserver((ms) => {
      for (const m of ms) m.addedNodes.forEach((n) => {
        if (!(n instanceof HTMLElement)) return;
        if (n.matches("[data-reveal]:not(.is-in)")) io.observe(n);
        observar(n);
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
    // segurança: nada fica invisível se o observer falhar
    const t = setTimeout(() => document.querySelectorAll("[data-reveal]:not(.is-in)").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < innerHeight && r.bottom > 0) el.classList.add("is-in");
    }), 1500);
    return () => { io.disconnect(); mo.disconnect(); clearTimeout(t); };
  }, [path]);

  useEffect(() => {
    const html = document.documentElement;
    let ultimo = scrollY;
    let pendente = false;
    const ler = () => {
      pendente = false;
      const y = scrollY;
      if (y > 8) html.setAttribute("data-rolou", ""); else html.removeAttribute("data-rolou");
      const delta = y - ultimo;
      if (Math.abs(delta) > 6) {
        // perto do fim da página sempre mostra a navegação
        const fim = y + innerHeight >= document.documentElement.scrollHeight - 80;
        html.setAttribute("data-rolando", delta > 0 && y > 120 && !fim ? "baixo" : "cima");
        ultimo = y;
      }
    };
    const onScroll = () => { if (!pendente) { pendente = true; requestAnimationFrame(ler); } };
    addEventListener("scroll", onScroll, { passive: true });
    ler();
    return () => removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { document.documentElement.setAttribute("data-rolando", "cima"); }, [path]);

  return null;
}

"use client";
import { useState } from "react";

export function Compartilhar({ link, texto }: { link: string; texto: string }) {
  const [copiado, setCopiado] = useState(false);
  const mensagem = `${texto}\n${link}`;
  async function copiar() {
    try { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* sem permissão: o link continua visível */ }
  }
  async function compartilhar() {
    if (navigator.share) { try { await navigator.share({ text: texto, url: link }); return; } catch { /* cancelou */ } }
    window.open(`https://wa.me/?text=${encodeURIComponent(mensagem)}`, "_blank");
  }
  return (
    <div className="space-y-2">
      <label className="label" htmlFor="ind-link">Seu link</label>
      <div className="flex gap-2">
        <input id="ind-link" readOnly value={link} className="input min-w-0 font-semibold" onFocus={(e) => e.currentTarget.select()} />
        <button type="button" className="btn-outline shrink-0" onClick={copiar} aria-live="polite">{copiado ? "Copiado ✓" : "Copiar"}</button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <a className="btn-primary" href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`} target="_blank" rel="noopener">Mandar no WhatsApp</a>
        <button type="button" className="btn-outline" onClick={compartilhar}>Compartilhar…</button>
      </div>
    </div>
  );
}

"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmarEntrega } from "./actions";

/** Reduz a foto no celular antes de enviar (até 1280px, JPEG ~75%). */
async function comprimir(arquivo: File): Promise<Blob> {
  const bmp = await createImageBitmap(arquivo).catch(() => null);
  if (!bmp) return arquivo;
  const max = 1280;
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob((b) => res(b ?? arquivo), "image/jpeg", 0.75));
}

export function EntregaForm({ pedidoId, numero, fotoObrigatoria, onFechar }: { pedidoId: string; numero: number; fotoObrigatoria: boolean; onFechar: () => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [erro, setErro] = useState("");
  const [p, start] = useTransition();
  const nome = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function escolher(f: File | undefined) {
    if (!f) return;
    const b = await comprimir(f);
    setBlob(b);
    setPreview(URL.createObjectURL(b));
  }

  function enviar() {
    setErro("");
    if (fotoObrigatoria && !blob) return setErro("Tire a foto da entrega para concluir.");
    const fd = new FormData();
    fd.set("pedido_id", pedidoId);
    fd.set("recebido_por", nome.current?.value ?? "");
    if (blob) fd.set("foto", new File([blob], "entrega.jpg", { type: "image/jpeg" }));
    start(async () => {
      const r = await confirmarEntrega(fd);
      if (r.erro) return setErro(r.erro);
      onFechar();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center" role="dialog" aria-modal="true" aria-label={`Confirmar entrega do pedido ${numero}`}>
      <div className="w-full max-w-md space-y-4 rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <h2 className="h2">Entregar pedido #{numero}</h2>
          <button className="btn-ghost min-h-0 px-2 py-1" onClick={onFechar} aria-label="Fechar">✕</button>
        </div>
        <label className="block cursor-pointer">
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => escolher(e.target.files?.[0])} />
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Foto da entrega" className="h-48 w-full rounded-2xl object-cover" />
          ) : (
            <span className="flex h-36 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-line-2 bg-page text-ink-2">
              <span className="text-3xl">📷</span>
              <span className="text-sm font-bold">Tirar foto da entrega{fotoObrigatoria ? "" : " (opcional)"}</span>
              <span className="text-xs text-ink-3">Pacote na porta ou com quem recebeu</span>
            </span>
          )}
        </label>
        <div>
          <label className="label" htmlFor="rec">Quem recebeu (opcional)</label>
          <input id="rec" ref={nome} className="input" placeholder="Ex.: Maria, porteiro" />
        </div>
        {erro && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{erro}</p>}
        <button className="btn-primary w-full" disabled={p} onClick={enviar}>{p ? "Salvando…" : "Confirmar entrega"}</button>
      </div>
    </div>
  );
}

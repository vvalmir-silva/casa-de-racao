"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { brl } from "@/lib/utils";

type Pix = { qr_code: string | null; qr_code_base64: string | null; expira_em: string | null; status: string } | null;

export function PixBox({ pedidoId, total, chaveManual, whatsappLink }: { pedidoId: string; total: number; chaveManual: string; whatsappLink: string | null }) {
  const [pix, setPix] = useState<Pix | undefined>(undefined);
  const [status, setStatus] = useState("aguardando_pagamento");
  const [copiado, setCopiado] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let n = 0;
    let ativo = true;
    async function tick() {
      try {
        const r = await fetch(`/api/pedidos/${pedidoId}/pix${n % 6 === 5 ? "?sync=1" : ""}`, { cache: "no-store" });
        const j = await r.json();
        if (!ativo) return;
        setPix(j.pix ?? null);
        setStatus(j.status);
        if (j.status !== "aguardando_pagamento") { router.refresh(); return; }
      } catch {}
      n++;
      if (ativo) setTimeout(tick, 5000);
    }
    tick();
    return () => { ativo = false; };
  }, [pedidoId, router]);

  if (status !== "aguardando_pagamento") return null;

  async function copiar(t: string) {
    try { await navigator.clipboard.writeText(t); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch {}
  }

  if (pix === undefined) return <div className="card text-sm text-ink-3">Gerando PIX...</div>;

  if (pix && pix.qr_code) {
    const expirado = pix.expira_em && new Date(pix.expira_em) < new Date();
    return (
      <div className="card space-y-3 border-pine-200 bg-pine-50">
        <div className="h2">Pague com PIX · {brl(total)}</div>
        {pix.qr_code_base64 && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`data:image/png;base64,${pix.qr_code_base64}`} alt="QR Code PIX" className="mx-auto h-56 w-56 rounded-lg bg-white p-2" />
        )}
        <div className="rounded-lg bg-white p-2 text-xs break-all">{pix.qr_code}</div>
        <button className="btn-primary w-full" onClick={() => copiar(pix.qr_code!)}>{copiado ? "Copiado ✓" : "Copiar código PIX"}</button>
        <p className="text-center text-xs text-ink-2">
          {expirado ? "Código expirado — recarregue a página para gerar outro." : "A confirmação é automática em alguns segundos após o pagamento."}
        </p>
      </div>
    );
  }

  return (
    <div className="card space-y-2 border-pine-200 bg-pine-50">
      <div className="h2">Pague via PIX para confirmar</div>
      <div className="text-sm">Chave: <b className="select-all">{chaveManual}</b></div>
      <div className="text-sm">Valor: <b>{brl(total)}</b></div>
      <button className="btn-outline w-full" onClick={() => copiar(chaveManual)}>{copiado ? "Copiado ✓" : "Copiar chave"}</button>
      {whatsappLink && <a href={whatsappLink} target="_blank" className="btn-primary w-full">Enviar comprovante no WhatsApp</a>}
    </div>
  );
}

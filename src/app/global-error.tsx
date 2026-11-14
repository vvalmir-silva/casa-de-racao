"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error); }, [error]);
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#F4F6F8", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0, padding: 24 }}>
        <div style={{ maxWidth: 380, textAlign: "center", background: "white", borderRadius: 24, padding: 32 }}>
          <div style={{ fontSize: 40 }}>🐾</div>
          <h1 style={{ fontSize: 22, margin: "12px 0 6px", color: "#14202A" }}>Algo deu errado por aqui</h1>
          <p style={{ color: "#66727D", margin: "0 0 20px" }}>Já fomos avisados do problema. Tente de novo em instantes.</p>
          <button onClick={reset} style={{ background: "#0D4F68", color: "white", border: 0, borderRadius: 14, padding: "12px 22px", fontWeight: 700, fontSize: 15 }}>Tentar de novo</button>
        </div>
      </body>
    </html>
  );
}

import { ImageResponse } from "next/og";

export const alt = "Casa de Ração — ração para cães, gatos e aves com entrega no seu bairro";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#1B4D3E", padding: 72, color: "white", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 84, height: 84, borderRadius: 24, background: "#E8A33D", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, fontWeight: 800, color: "#1B4D3E" }}>CR</div>
          <div style={{ fontSize: 44, fontWeight: 800 }}>Casa de Ração</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>Ração no seu bairro, com hora marcada.</div>
          <div style={{ fontSize: 34, color: "#D3E6DD" }}>Cães · Gatos · Aves — PIX, cartão ou dinheiro na entrega</div>
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          {["Frete grátis acima de R$ 150", "Retirada grátis na loja"].map((t) => (
            <div key={t} style={{ display: "flex", background: "rgba(255,255,255,.12)", borderRadius: 999, padding: "12px 24px", fontSize: 28, fontWeight: 700 }}>{t}</div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}

import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CarrinhoProvider } from "@/lib/carrinho";
import { Header } from "@/components/Header";
import { getSessao } from "@/lib/auth";
import { Pwa } from "@/components/Pwa";
import { LocalProvider } from "@/lib/local";
import { LocalSheet } from "@/components/LocalSheet";
import { CarrinhoFlutuante } from "@/components/CarrinhoFlutuante";
import { Suspense } from "react";
import { FavoritosProvider } from "@/lib/favoritos";
import { Movimento } from "@/components/Movimento";
import { dadosVitrine } from "@/lib/vitrine";
import { ConfigLojaProvider } from "@/lib/config-loja";
import { Rodape } from "@/components/Rodape";
import { sql } from "@/lib/db";
import { urlSite } from "@/lib/site";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata: Metadata = {
  metadataBase: new URL(urlSite()),
  title: { default: "Casa de Ração — entrega no seu bairro", template: "%s · Casa de Ração" },
  description: "Ração para cães, gatos e aves com entrega no dia certo, no seu bairro.",
  applicationName: "Casa de Ração",
  appleWebApp: { capable: true, title: "Casa de Ração", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website", locale: "pt_BR", siteName: "Casa de Ração",
    title: "Casa de Ração — entrega no seu bairro",
    description: "Ração para cães, gatos e aves com entrega no dia certo, no seu bairro. PIX, cartão ou dinheiro.",
  },
  twitter: { card: "summary_large_image" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0D4F68" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const sessao = await getSessao();
  const { categorias, avisos, cfg } = await dadosVitrine().catch(() => ({ categorias: [], avisos: [] as string[], cfg: {} as Record<string, string> }));
  const configLoja = { parcelasMax: Number(cfg.parcelas_max ?? 1) || 1, parcelaMin: Number(cfg.parcela_minima_centavos ?? 3000) || 3000 };
  const favoritos = sessao
    ? ((await sql`SELECT produto_id FROM favoritos WHERE usuario_id = ${sessao.id}`.catch(() => [])) as { produto_id: string }[]).map((f) => f.produto_id)
    : [];
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* antes da pintura: habilita as entradas animadas (sem JS, nada fica escondido) */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('rv')" }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <CarrinhoProvider>
          <LocalProvider>
          <FavoritosProvider ids={favoritos} logado={!!sessao}>
          <ConfigLojaProvider valor={configLoja}>
          <Suspense><Header sessao={sessao} categorias={categorias} avisos={avisos} /></Suspense>
          <LocalSheet />
          <CarrinhoFlutuante />
          <Pwa />
          <Movimento />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-10 pt-4 sm:pt-6 md:pb-12 lg:px-6">{children}</main>
          <Rodape cfg={cfg} categorias={categorias} />
          </ConfigLojaProvider>
          </FavoritosProvider>
          </LocalProvider>
        </CarrinhoProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

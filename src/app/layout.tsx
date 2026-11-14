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
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1B4D3E" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const sessao = await getSessao();
  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen flex-col">
        <CarrinhoProvider>
          <LocalProvider>
          <Suspense><Header sessao={sessao} /></Suspense>
          <LocalSheet />
          <CarrinhoFlutuante />
          <Pwa />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-40 pt-4 sm:pt-6 md:pb-12 lg:px-6">{children}</main>
          <footer className="hidden border-t border-line py-8 md:block">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6 text-sm text-ink-3">
              <span className="font-bold text-ink">Casa de Ração</span>
              <span>Ração para cães, gatos e aves · entrega em rotas pelo bairro</span>
            </div>
          </footer>
          </LocalProvider>
        </CarrinhoProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CarrinhoProvider } from "@/lib/carrinho";
import { Header } from "@/components/Header";
import { getSessao } from "@/lib/auth";
import { Pwa } from "@/components/Pwa";

export const metadata: Metadata = {
  title: { default: "Casa de Ração — entrega no seu bairro", template: "%s · Casa de Ração" },
  description: "Ração para cães, gatos e aves com entrega no dia certo, no seu bairro.",
  applicationName: "Casa de Ração",
  appleWebApp: { capable: true, title: "Casa de Ração", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1B4D3E" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const sessao = await getSessao();
  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen flex-col">
        <CarrinhoProvider>
          <Header sessao={sessao} />
          <Pwa />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-4 sm:pt-6 md:pb-10">{children}</main>
          <footer className="hidden border-t border-line py-8 md:block">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 text-sm text-ink-3">
              <span className="font-bold text-ink">Casa de Ração</span>
              <span>Ração para cães, gatos e aves · entrega em rotas pelo bairro</span>
            </div>
          </footer>
        </CarrinhoProvider>
      </body>
    </html>
  );
}

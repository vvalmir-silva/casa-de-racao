import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CarrinhoProvider } from "@/lib/carrinho";
import { Header } from "@/components/Header";
import { getSessao } from "@/lib/auth";

export const metadata: Metadata = {
  title: { default: "Casa de Ração", template: "%s · Casa de Ração" },
  description: "Ração para cães, gatos e aves com entrega no seu bairro.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ea580c" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const sessao = await getSessao();
  return (
    <html lang="pt-BR">
      <body className="min-h-screen flex flex-col">
        <CarrinhoProvider>
          <Header sessao={sessao} />
          <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
          <footer className="border-t border-stone-200 py-6 text-center text-xs text-stone-500">
            Casa de Ração · Entregamos no seu bairro
          </footer>
        </CarrinhoProvider>
      </body>
    </html>
  );
}

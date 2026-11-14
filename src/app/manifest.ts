import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Casa de Ração",
    short_name: "Casa de Ração",
    description: "Ração para cães, gatos e aves com entrega no seu bairro.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F4F6F8",
    theme_color: "#0D4F68",
    lang: "pt-BR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Meus pedidos", url: "/conta" },
      { name: "Minha rota (motorista)", url: "/motorista" },
    ],
  };
}

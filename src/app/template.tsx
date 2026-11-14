/** Cada troca de página entra com um fade (200ms, ease-out). Só opacidade: transform aqui deslocaria barras fixas. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-[pagina_200ms_cubic-bezier(.16,1,.3,1)]">{children}</div>;
}

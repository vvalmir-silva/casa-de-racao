import Link from "next/link";
import { IconPaw } from "./Icons";

type Props = { cfg: Record<string, string>; categorias: { nome: string; slug: string }[] };

const Coluna = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <details className="group border-b border-white/10 md:border-0" open>
    <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between text-[15px] font-extrabold md:pointer-events-none md:min-h-0 md:pb-3 [&::-webkit-details-marker]:hidden">
      {titulo}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform duration-200 group-open:rotate-180 md:hidden" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
    </summary>
    <ul className="space-y-2 pb-4 text-[14px] text-white/75 md:pb-0">{children}</ul>
  </details>
);
const L = ({ href, children, ext }: { href: string; children: React.ReactNode; ext?: boolean }) => (
  <li><Link href={href} {...(ext ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="transition-colors hover:text-white hover:underline">{children}</Link></li>
);
const Selo = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex h-8 items-center rounded-md bg-white px-2.5 text-[12px] font-extrabold text-pine-900">{children}</span>
);

/** Rodapé completo. Só mostra contato/redes que existem nas Configurações. */
export function Rodape({ cfg, categorias }: Props) {
  const nome = cfg.loja_nome || "Casa de Ração";
  const wa = cfg.loja_whatsapp?.replace(/\D/g, "");
  const insta = cfg.loja_instagram?.replace(/^@/, "").trim();
  const ano = new Date().getFullYear();
  return (
    <footer className="no-print mt-8 bg-pine-900 pb-24 text-white md:pb-0">
      <div className="mx-auto grid max-w-7xl gap-x-8 px-4 pt-8 md:grid-cols-4 md:pt-12 lg:px-6">
        <div className="pb-6 md:pb-0">
          <div className="flex items-center gap-2.5">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-pine-700 text-kibble-400"><IconPaw width={24} height={24} /></span>
            <span className="text-[19px] font-extrabold tracking-tight">{nome}</span>
          </div>
          <p className="mt-3 max-w-xs text-[14px] leading-relaxed text-white/70">Ração para cães, gatos e aves com entrega no bairro, no dia e horário que você escolher.</p>
          {cfg.loja_endereco && <p className="mt-3 text-[13px] text-white/60">{cfg.loja_endereco}</p>}
        </div>
        <Coluna titulo="Departamentos">
          <L href="/?ofertas=1">Ofertas</L>
          {categorias.map((c) => <L key={c.slug} href={`/?cat=${c.slug}`}>{c.nome}</L>)}
        </Coluna>
        <Coluna titulo="Atendimento">
          {wa && <L href={`https://wa.me/${wa}`} ext>WhatsApp: {wa.replace(/^55(\d{2})(\d{4,5})(\d{4})$/, "($1) $2-$3")}</L>}
          {cfg.loja_horario && <li>{cfg.loja_horario}</li>}
          <L href="/como-funciona">Como funciona a entrega</L>
          <L href="/conta">Meus pedidos</L>
        </Coluna>
        <Coluna titulo="Para você">
          <L href="/conta/favoritos">Favoritos</L>
          <L href="/conta/pets">Meus pets</L>
          <L href="/conta/indique">Indique e ganhe</L>
          <L href="/conta/assinaturas">Assinatura de ração</L>
          <L href="/login">Entrar ou cadastrar</L>
          <L href="/recuperar">Esqueci minha senha</L>
        </Coluna>
      </div>

      <div className="mx-auto mt-6 flex max-w-7xl flex-col gap-5 border-t border-white/10 px-4 py-6 md:flex-row md:items-center md:justify-between lg:px-6">
        <div>
          <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-white/50">Formas de pagamento</p>
          <div className="flex flex-wrap gap-2"><Selo>PIX</Selo><Selo>Cartão na entrega</Selo><Selo>Dinheiro</Selo></div>
        </div>
        {(insta || wa) && (
          <div>
            <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-white/50">Siga e fale com a gente</p>
            <div className="flex gap-2">
              {insta && (
                <a href={`https://instagram.com/${insta}`} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="grid h-10 w-10 place-items-center rounded-full bg-white/10 transition hover:bg-white/20">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" /></svg>
                </a>
              )}
              {wa && (
                <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="grid h-10 w-10 place-items-center rounded-full bg-white/10 transition hover:bg-white/20">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19.1L4 20z" /><path d="M9 9.5c.3 2 2.5 4.2 4.5 4.5l1-1.2 2 1-.5 1.7c-3.5.2-7.5-3.8-7.3-7.3L10.4 7l1 2-1.2 1" /></svg>
                </a>
              )}
            </div>
          </div>
        )}
        <div className="text-[12px] leading-relaxed text-white/50 md:text-right">
          <div className="inline-flex items-center gap-1.5 font-bold text-white/70">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
            Site seguro (HTTPS)
          </div>
          <div>© {ano} {nome}{cfg.loja_cnpj ? ` · CNPJ ${cfg.loja_cnpj}` : ""}</div>
        </div>
      </div>
    </footer>
  );
}

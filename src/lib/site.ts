/** URL pública do site (sem barra final). Usada em SEO, links de WhatsApp e webhooks. */
export function urlSite() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
  );
}

/** Serializa JSON-LD sem permitir fechar a tag <script>. */
export function jsonLd(obj: unknown) {
  return { __html: JSON.stringify(obj).replace(/</g, "\\u003c") };
}

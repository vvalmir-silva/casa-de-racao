import type { MetadataRoute } from "next";
import { sql } from "@/lib/db";
import { urlSite } from "@/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = urlSite();
  try {
    const produtos = (await sql`SELECT slug, atualizado_em FROM produtos WHERE ativo`) as { slug: string; atualizado_em: string | null }[];
    const categorias = (await sql`SELECT DISTINCT c.slug FROM categorias c JOIN produtos p ON p.categoria_id = c.id AND p.ativo`) as { slug: string }[];
    return [
      { url: base, changeFrequency: "daily", priority: 1 },
      { url: `${base}/como-funciona`, changeFrequency: "monthly", priority: 0.5 },
      ...categorias.map((c) => ({ url: `${base}/?cat=${c.slug}`, changeFrequency: "weekly" as const, priority: 0.7 })),
      ...produtos.map((p) => ({ url: `${base}/produto/${p.slug}`, lastModified: p.atualizado_em ? new Date(p.atualizado_em) : undefined, changeFrequency: "weekly" as const, priority: 0.8 })),
    ];
  } catch {
    return [{ url: base, changeFrequency: "daily", priority: 1 }];
  }
}

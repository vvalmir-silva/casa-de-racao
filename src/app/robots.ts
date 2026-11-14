import type { MetadataRoute } from "next";
import { urlSite } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/motorista", "/conta", "/checkout", "/carrinho", "/api/", "/login", "/cadastro", "/recuperar", "/offline"] }],
    sitemap: `${urlSite()}/sitemap.xml`,
  };
}

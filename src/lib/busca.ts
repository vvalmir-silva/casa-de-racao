import { sql } from "./db";

/** Como o cliente fala → como está no catálogo (sem acento). */
const SINONIMOS: Record<string, string> = {
  cachorro: "caes", cachorros: "caes", cachorrinho: "caes", dog: "caes", cao: "caes", caozinho: "caes",
  gatinho: "gatos", gata: "gatos", gato: "gatos", cat: "gatos",
  passaro: "aves", pasaro: "aves", passarinhos: "aves", passarinho: "aves", passaros: "aves", ave: "aves", calopsita: "calopsita", periquito: "periquitos",
  racao: "", de: "", para: "", pra: "", p: "", com: "",
};

export function normalizar(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/(\d)([a-z])/g, "$1 $2").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Palavras da busca já normalizadas, com sinônimos e sem palavras vazias. */
export function termosBusca(q: string) {
  const ws = normalizar(q).split(" ").filter(Boolean).map((w) => (w in SINONIMOS ? SINONIMOS[w] : w)).filter((w) => w.length >= 2 || /^\d+$/.test(w));
  return [...new Set(ws)].slice(0, 6);
}

export type ResultadoBusca = {
  id: string; slug: string; nome: string; marca: string | null; peso_kg: number; preco_centavos: number; estoque: number; imagem_url: string | null;
  destaque: boolean; categoria_slug: string; categoria: string;
};

/**
 * Busca sem acento e tolerante a erro de digitação: cada palavra precisa aparecer no nome, marca ou categoria,
 * por trecho exato ou por semelhança (pg_trgm). Exatos primeiro, depois os mais parecidos.
 */
export async function buscarProdutos(q: string, limite = 60): Promise<ResultadoBusca[]> {
  const termos = termosBusca(q);
  // só palavras genéricas ("ração") → tudo
  if (!termos.length) return normalizar(q) ? consultar(["%"], "", limite, true) : [];
  const todas = await consultar(termos, termos.join(" "), limite, true);
  if (todas.length || termos.length === 1) return todas;
  // nenhuma bate em todas as palavras ("areia gato") → mostra o que bate em alguma
  return consultar(termos, termos.join(" "), limite, false);
}

async function consultar(termos: string[], frase: string, limite: number, todas: boolean): Promise<ResultadoBusca[]> {
  if (termos[0] === "%") {
    return (await sql`
      SELECT p.id, p.slug, p.nome, p.marca, p.peso_kg, p.preco_centavos, p.estoque, p.imagem_url, p.destaque, c.slug AS categoria_slug, c.nome AS categoria
      FROM produtos p JOIN categorias c ON c.id = p.categoria_id WHERE p.ativo ORDER BY p.estoque = 0, p.destaque DESC, p.nome LIMIT ${limite}
    `) as ResultadoBusca[];
  }
  return (await sql`
    WITH base AS (
      SELECT p.id, p.slug, p.nome, p.marca, p.peso_kg, p.preco_centavos, p.estoque, p.imagem_url, p.destaque,
             c.slug AS categoria_slug, c.nome AS categoria,
             lower(unaccent(p.nome || ' ' || coalesce(p.marca, '') || ' ' || c.nome || ' ' || coalesce(p.descricao, ''))) AS doc,
             lower(unaccent(p.nome || ' ' || coalesce(p.marca, ''))) AS titulo
      FROM produtos p JOIN categorias c ON c.id = p.categoria_id
      WHERE p.ativo
    )
    SELECT id, slug, nome, marca, peso_kg, preco_centavos, estoque, imagem_url, destaque, categoria_slug, categoria
    FROM base
    WHERE CASE WHEN ${todas}::boolean
      THEN (SELECT bool_and(doc LIKE '%' || w || '%' OR (length(w) >= 5 AND word_similarity(w, doc) >= 0.4)) FROM unnest(${termos}::text[]) AS w)
      ELSE (SELECT bool_or(doc LIKE '%' || w || '%' OR (length(w) >= 5 AND word_similarity(w, doc) >= 0.4)) FROM unnest(${termos}::text[]) AS w)
    END
    ORDER BY
      (SELECT count(*) FROM unnest(${termos}::text[]) AS w WHERE doc LIKE '%' || w || '%') DESC,
      (SELECT count(*) FROM unnest(${termos}::text[]) AS w WHERE titulo LIKE '%' || w || '%') DESC,
      word_similarity(${frase}, titulo) DESC,
      estoque = 0, destaque DESC, nome
    LIMIT ${limite}
  `) as ResultadoBusca[];
}

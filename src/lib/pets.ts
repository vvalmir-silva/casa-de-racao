// Regras puras do perfil do pet (servem no servidor e no navegador).

export type Especie = "cao" | "gato" | "ave" | "outro";
export type Fase = "filhote" | "adulto" | "senior";
export type Pet = { id: string; nome: string; especie: Especie; fase: Fase; peso_kg: number | null; castrado: boolean };

export const ESPECIE: Record<Especie, string> = { cao: "Cachorro", gato: "Gato", ave: "Pássaro", outro: "Outro" };
export const EMOJI: Record<Especie, string> = { cao: "🐶", gato: "🐱", ave: "🐦", outro: "🐾" };
export const FASE: Record<Fase, string> = { filhote: "Filhote", adulto: "Adulto", senior: "Idoso (sênior)" };

/**
 * Consumo diário estimado de ração seca, em gramas.
 * Energia de manutenção: cão 130·kg^0,75 kcal, gato 100·kg^0,67 kcal; ração seca ≈ 3,6 kcal/g.
 * Filhote ×1,6 · sênior ×0,85 · castrado adulto ×0,85. Igual à função SQL consumo_pet_g.
 */
export function consumoDiarioG(p: Pick<Pet, "especie" | "peso_kg" | "fase" | "castrado">): number | null {
  if (!p.peso_kg || p.peso_kg <= 0 || (p.especie !== "cao" && p.especie !== "gato")) return null;
  const kcal = p.especie === "cao" ? 130 * Math.pow(p.peso_kg, 0.75) : 100 * Math.pow(p.peso_kg, 0.67);
  const fase = p.fase === "filhote" ? 1.6 : p.fase === "senior" ? 0.85 : 1;
  const cast = p.castrado && p.fase !== "filhote" ? 0.85 : 1;
  return Math.round((kcal / 3.6) * fase * cast);
}

/** Quantos dias um saco de `pesoSacoKg` dura para os pets dados (soma o consumo de todos). */
export function duracaoDias(pesoSacoKg: number, pets: Parameters<typeof consumoDiarioG>[0][]): number | null {
  const total = pets.reduce((a, p) => a + (consumoDiarioG(p) ?? 0), 0);
  if (!total || pesoSacoKg <= 0) return null;
  return Math.floor((pesoSacoKg * 1000) / total);
}

export function porte(pesoKg: number | null): "pequeno" | "medio" | "grande" | null {
  if (!pesoKg) return null;
  return pesoKg <= 10 ? "pequeno" : pesoKg <= 25 ? "medio" : "grande";
}

const tem = (txt: string, re: RegExp) => re.test(txt);
const RE = {
  filhote: /filhot|puppy|kitten/,
  senior: /s[eê]nior|idos|7\s?\+|\bmaduro/,
  adulto: /adult/,
  castrado: /castrad|esteriliz/,
  pequeno: /pequen|mini|small|toy/,
  medio: /m[eé]di/,
  grande: /grand|gigant|large/,
};

export type ProdutoPet = { id: string; nome: string; descricao: string | null; especie: string; categoria_slug: string; peso_kg: number; estoque: number };

/** Pontua o quanto o produto combina com o pet. Negativo = não indicar. */
export function pontuar(prod: ProdutoPet, pet: Pet): number {
  if (prod.especie !== pet.especie) return -99;
  const t = `${prod.nome} ${prod.descricao ?? ""}`.toLowerCase();
  let s = prod.categoria_slug.startsWith("racao") ? 5 : 1;
  const fasesDoProduto = (["filhote", "senior", "adulto"] as const).filter((f) => tem(t, RE[f]));
  if (fasesDoProduto.length) s += fasesDoProduto.includes(pet.fase) ? 3 : pet.fase === "adulto" && !fasesDoProduto.includes("adulto") ? -6 : fasesDoProduto.includes("adulto") ? -2 : -6;
  if (tem(t, RE.castrado)) s += pet.castrado ? 3 : -1;
  const pt = pet.especie === "cao" ? porte(pet.peso_kg) : null;
  if (pt) {
    const portes = (["pequeno", "medio", "grande"] as const).filter((x) => tem(t, RE[x]));
    if (portes.length) s += portes.includes(pt) ? 2 : -5;
  }
  // embalagem que dura entre 3 semanas e 2 meses é a mais prática
  const d = prod.peso_kg ? duracaoDias(prod.peso_kg, [pet]) : null;
  if (d && d >= 20 && d <= 60) s += 1;
  if (prod.estoque <= 0) s -= 2;
  return s;
}

export function indicados<T extends ProdutoPet>(produtos: T[], pet: Pet, n = 8): T[] {
  return produtos
    .map((p) => ({ p, s: pontuar(p, pet) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((x) => x.p);
}

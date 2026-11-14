import { sql } from "./db";
import { indicados, type Pet, type ProdutoPet } from "./pets";
import type { ProdutoResumo } from "@/components/ProdutoCard";

export type ProdutoPetCard = ProdutoResumo & ProdutoPet & { categoria_slug: string; destaque: boolean };

export async function petsDoUsuario(usuarioId: string): Promise<Pet[]> {
  const rows = (await sql`SELECT id, nome, especie, fase, peso_kg::float AS peso_kg, castrado FROM pets WHERE usuario_id = ${usuarioId} ORDER BY criado_em`) as Pet[];
  return rows;
}

export async function produtosParaPets(): Promise<ProdutoPetCard[]> {
  return (await sql`
    SELECT p.id, p.slug, p.nome, p.marca, p.descricao, p.peso_kg::float AS peso_kg, p.preco_centavos, p.preco_de_centavos, p.estoque, p.imagem_url, p.destaque,
      c.slug AS categoria_slug, c.especie
    FROM produtos p JOIN categorias c ON c.id = p.categoria_id
    WHERE p.ativo AND c.especie IN ('cao','gato','ave')
  `) as ProdutoPetCard[];
}

/** Ração indicada para cada pet (sem repetir produto entre pets). */
export async function indicadosPorPet(pets: Pet[], n = 8) {
  if (!pets.length) return [];
  const prods = await produtosParaPets();
  return pets.map((pet) => ({ pet, itens: indicados(prods, pet, n) })).filter((x) => x.itens.length);
}

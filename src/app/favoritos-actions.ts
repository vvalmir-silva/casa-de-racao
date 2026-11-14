"use server";

import { revalidatePath } from "next/cache";
import { getSessao } from "@/lib/auth";
import { sql } from "@/lib/db";

/** Liga/desliga o favorito. Sem login, devolve { login: true } para a tela mandar entrar. */
export async function alternarFavorito(produtoId: string): Promise<{ favorito?: boolean; login?: true; erro?: string }> {
  const s = await getSessao();
  if (!s) return { login: true };
  if (!/^[0-9a-f-]{36}$/i.test(produtoId)) return { erro: "Produto inválido." };
  const removido = await sql`DELETE FROM favoritos WHERE usuario_id = ${s.id} AND produto_id = ${produtoId} RETURNING produto_id`;
  if (!removido.length) {
    await sql`INSERT INTO favoritos (usuario_id, produto_id) SELECT ${s.id}, id FROM produtos WHERE id = ${produtoId} ON CONFLICT DO NOTHING`;
  }
  revalidatePath("/conta/favoritos");
  return { favorito: !removido.length };
}

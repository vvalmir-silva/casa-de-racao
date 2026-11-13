"use server";

import { revalidatePath } from "next/cache";
import { exigirSessao } from "@/lib/auth";
import { sql } from "@/lib/db";
import { notificarPedido } from "@/lib/whatsapp";

export async function iniciarRota(id: string) {
  const s = await exigirSessao(["motorista", "admin"]);
  await sql`UPDATE rotas SET status = 'em_andamento', iniciada_em = now() WHERE id = ${id} AND status = 'planejada' AND (motorista_id = ${s.id} OR ${s.papel === "admin"})`;
  const peds = (await sql`UPDATE pedidos SET status = 'em_rota' WHERE rota_id = ${id} AND status = 'separado' RETURNING id`) as { id: string }[];
  await Promise.allSettled(peds.map((p) => notificarPedido(p.id, "em_rota")));
  revalidatePath("/motorista"); revalidatePath("/admin/rotas");
}

export async function concluirRota(id: string) {
  const s = await exigirSessao(["motorista", "admin"]);
  await sql`UPDATE rotas SET status = 'concluida', concluida_em = now() WHERE id = ${id} AND (motorista_id = ${s.id} OR ${s.papel === "admin"})`;
  revalidatePath("/motorista"); revalidatePath("/admin/rotas");
}

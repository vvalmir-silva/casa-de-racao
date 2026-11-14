"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirSessao } from "@/lib/auth";
import { sql } from "@/lib/db";

const schema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  nome: z.string().trim().min(1, "Dê um nome ao pet.").max(40),
  especie: z.enum(["cao", "gato", "ave", "outro"], { message: "Escolha a espécie." }),
  fase: z.enum(["filhote", "adulto", "senior"]).default("adulto"),
  peso_kg: z.string().optional().transform((v, ctx) => {
    if (!v || !v.trim()) return null;
    const n = Number(v.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0 || n > 120) { ctx.addIssue({ code: "custom", message: "Peso entre 0,1 e 120 kg." }); return z.NEVER; }
    return Math.round(n * 100) / 100;
  }),
  castrado: z.string().optional().transform((v) => v === "on"),
});

export async function salvarPet(fd: FormData): Promise<{ ok?: true; erro?: string }> {
  const s = await exigirSessao();
  const r = schema.safeParse(Object.fromEntries(fd));
  if (!r.success) return { erro: r.error.issues[0].message };
  const p = r.data;
  if (p.id) {
    const up = await sql`UPDATE pets SET nome = ${p.nome}, especie = ${p.especie}, fase = ${p.fase}, peso_kg = ${p.peso_kg}, castrado = ${p.castrado}
      WHERE id = ${p.id} AND usuario_id = ${s.id} RETURNING id`;
    if (!up.length) return { erro: "Pet não encontrado." };
  } else {
    const [{ n }] = (await sql`SELECT count(*)::int AS n FROM pets WHERE usuario_id = ${s.id}`) as { n: number }[];
    if (n >= 10) return { erro: "Limite de 10 pets por conta." };
    await sql`INSERT INTO pets (usuario_id, nome, especie, fase, peso_kg, castrado) VALUES (${s.id}, ${p.nome}, ${p.especie}, ${p.fase}, ${p.peso_kg}, ${p.castrado})`;
  }
  revalidatePath("/conta/pets"); revalidatePath("/");
  return { ok: true };
}

export async function excluirPet(id: string): Promise<{ ok?: true; erro?: string }> {
  const s = await exigirSessao();
  await sql`DELETE FROM pets WHERE id = ${id} AND usuario_id = ${s.id}`;
  revalidatePath("/conta/pets"); revalidatePath("/");
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirSessao, hashSenha, normalizarTelefone } from "@/lib/auth";
import { sql } from "@/lib/db";
import { comTransacao } from "@/lib/pool";
import { cancelarPedido, ErroPedido } from "@/lib/pedidos";
import { slugify } from "@/lib/utils";
import { notificarPedido } from "@/lib/whatsapp";

type R = { ok?: true; erro?: string };

/* ---------- Produtos ---------- */
const produtoSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  categoria_id: z.coerce.number().int(),
  nome: z.string().trim().min(2),
  marca: z.string().trim().optional().or(z.literal("")),
  descricao: z.string().trim().optional().or(z.literal("")),
  peso_kg: z.coerce.number().min(0),
  preco: z.string().transform((v) => Math.round(Number(v.replace(/\./g, "").replace(",", ".")) * 100)).refine((n) => Number.isFinite(n) && n >= 0, "Preço inválido"),
  imagem_url: z.string().trim().url().optional().or(z.literal("")),
  duracao_dias: z.string().optional().transform((v) => (v && Number(v) > 0 ? Math.round(Number(v)) : null)),
  ativo: z.coerce.boolean().optional(),
  destaque: z.coerce.boolean().optional(),
});

export async function salvarProduto(fd: FormData): Promise<R> {
  await exigirSessao(["admin"]);
  const raw = Object.fromEntries(fd);
  const parsed = produtoSchema.safeParse({ ...raw, ativo: fd.get("ativo") === "on", destaque: fd.get("destaque") === "on" });
  if (!parsed.success) return { erro: parsed.error.issues[0].message };
  const p = parsed.data;
  const slug = slugify(p.nome);
  if (p.id) {
    await sql`
      UPDATE produtos SET categoria_id=${p.categoria_id}, nome=${p.nome}, marca=${p.marca || null}, descricao=${p.descricao || null},
        peso_kg=${p.peso_kg}, preco_centavos=${p.preco}, imagem_url=${p.imagem_url || null}, duracao_dias=${p.duracao_dias}, ativo=${!!p.ativo}, destaque=${!!p.destaque}
      WHERE id=${p.id}`;
  } else {
    const ex = await sql`SELECT 1 FROM produtos WHERE slug = ${slug}`;
    const s = ex.length ? `${slug}-${Date.now().toString(36)}` : slug;
    await sql`
      INSERT INTO produtos (categoria_id, nome, slug, marca, descricao, peso_kg, preco_centavos, imagem_url, duracao_dias, ativo, destaque, estoque)
      VALUES (${p.categoria_id}, ${p.nome}, ${s}, ${p.marca || null}, ${p.descricao || null}, ${p.peso_kg}, ${p.preco}, ${p.imagem_url || null}, ${p.duracao_dias}, ${!!p.ativo}, ${!!p.destaque}, 0)`;
  }
  revalidatePath("/admin/produtos"); revalidatePath("/");
  return { ok: true };
}

export async function ajustarEstoque(produtoId: string, delta: number, motivo: string): Promise<R> {
  const s = await exigirSessao(["admin"]);
  if (!Number.isInteger(delta) || delta === 0) return { erro: "Informe uma quantidade." };
  try {
    await comTransacao(async (q) => {
      const r = await q(`UPDATE produtos SET estoque = estoque + $2 WHERE id = $1 AND estoque + $2 >= 0 RETURNING estoque`, [produtoId, delta]);
      if (r.rowCount === 0) throw new ErroPedido("Estoque não pode ficar negativo.");
      await q(`INSERT INTO estoque_movimentos (produto_id, delta, motivo, usuario_id) VALUES ($1,$2,$3,$4)`, [produtoId, delta, motivo || "ajuste", s.id]);
    });
  } catch (e) {
    return { erro: e instanceof ErroPedido ? e.message : "Erro ao ajustar." };
  }
  revalidatePath("/admin/produtos"); revalidatePath("/");
  return { ok: true };
}

export async function salvarCategoria(fd: FormData): Promise<R> {
  await exigirSessao(["admin"]);
  const nome = String(fd.get("nome") ?? "").trim();
  const especie = String(fd.get("especie") ?? "outro");
  if (nome.length < 2) return { erro: "Nome inválido" };
  await sql`INSERT INTO categorias (nome, slug, especie) VALUES (${nome}, ${slugify(nome)}, ${especie}) ON CONFLICT (slug) DO UPDATE SET nome = EXCLUDED.nome, especie = EXCLUDED.especie`;
  revalidatePath("/admin/produtos");
  return { ok: true };
}

/* ---------- Pedidos ---------- */
const transicoes: Record<string, string[]> = {
  aguardando_pagamento: ["pago", "cancelado"],
  pago: ["separado", "cancelado"],
  separado: ["em_rota", "entregue", "cancelado"],
  em_rota: ["entregue", "separado", "cancelado"],
  entregue: [],
  cancelado: [],
};

export async function mudarStatusPedido(id: string, novo: string): Promise<R> {
  const s = await exigirSessao(["admin", "motorista"]);
  const [p] = (await sql`SELECT status FROM pedidos WHERE id = ${id}`) as { status: string }[];
  if (!p) return { erro: "Pedido não encontrado" };
  if (!transicoes[p.status]?.includes(novo)) return { erro: `Transição inválida: ${p.status} → ${novo}` };
  if (novo === "cancelado") {
    try { await cancelarPedido(id, s.id, true); } catch (e) { return { erro: e instanceof ErroPedido ? e.message : "Erro" }; }
  } else {
    await sql`UPDATE pedidos SET status = ${novo}, entregue_em = CASE WHEN ${novo} = 'entregue' THEN now() ELSE entregue_em END WHERE id = ${id}`;
  }
  const evento = ({ pago: "pagamento_confirmado", separado: "separado", em_rota: "em_rota", entregue: "entregue", cancelado: "cancelado" } as const)[novo as "pago"];
  if (evento) await notificarPedido(id, evento).catch(() => {});
  revalidatePath("/admin/pedidos"); revalidatePath("/admin/rotas"); revalidatePath("/motorista");
  return { ok: true };
}

/* ---------- Rotas ---------- */
export async function criarRota(fd: FormData): Promise<R> {
  await exigirSessao(["admin"]);
  const data = String(fd.get("data"));
  const motorista = String(fd.get("motorista_id") ?? "") || null;
  const zona = Number(fd.get("zona_id")) || null;
  const pedidos = fd.getAll("pedido_id").map(String);
  if (!data || pedidos.length === 0) return { erro: "Selecione a data e ao menos um pedido." };
  await comTransacao(async (q) => {
    const r = await q(`INSERT INTO rotas (data, motorista_id, zona_id) VALUES ($1,$2,$3) RETURNING id`, [data, motorista, zona]);
    const rotaId = r.rows[0].id;
    // ordena por CEP (aproximação de proximidade); motorista pode reordenar
    const ord = await q(
      `SELECT id FROM pedidos WHERE id = ANY($1::uuid[]) AND rota_id IS NULL AND status IN ('pago','separado') ORDER BY endereco->>'cep'`,
      [pedidos],
    );
    let i = 1;
    for (const row of ord.rows) {
      await q(`UPDATE pedidos SET rota_id = $1, ordem_rota = $2, status = CASE WHEN status = 'pago' THEN 'separado' ELSE status END WHERE id = $3`, [rotaId, i++, row.id]);
    }
  });
  revalidatePath("/admin/rotas"); revalidatePath("/motorista");
  return { ok: true };
}

export async function atualizarRota(fd: FormData): Promise<R> {
  await exigirSessao(["admin"]);
  const id = String(fd.get("rota_id"));
  const motorista = String(fd.get("motorista_id") ?? "") || null;
  await sql`UPDATE rotas SET motorista_id = ${motorista} WHERE id = ${id}`;
  revalidatePath("/admin/rotas"); revalidatePath("/motorista");
  return { ok: true };
}

export async function removerDaRota(pedidoId: string): Promise<R> {
  await exigirSessao(["admin"]);
  await sql`UPDATE pedidos SET rota_id = NULL, ordem_rota = NULL WHERE id = ${pedidoId} AND status IN ('separado','pago')`;
  revalidatePath("/admin/rotas");
  return { ok: true };
}

export async function excluirRota(id: string): Promise<R> {
  await exigirSessao(["admin"]);
  await comTransacao(async (q) => {
    await q(`UPDATE pedidos SET rota_id = NULL, ordem_rota = NULL WHERE rota_id = $1`, [id]);
    await q(`DELETE FROM rotas WHERE id = $1 AND status = 'planejada'`, [id]);
  });
  revalidatePath("/admin/rotas");
  return { ok: true };
}

export async function reordenarRota(rotaId: string, ids: string[]): Promise<R> {
  await exigirSessao(["admin", "motorista"]);
  await comTransacao(async (q) => {
    for (let i = 0; i < ids.length; i++) await q(`UPDATE pedidos SET ordem_rota = $1 WHERE id = $2 AND rota_id = $3`, [i + 1, ids[i], rotaId]);
  });
  revalidatePath("/admin/rotas"); revalidatePath("/motorista");
  return { ok: true };
}

/* ---------- Zonas / janelas ---------- */
export async function salvarZona(fd: FormData): Promise<R> {
  await exigirSessao(["admin"]);
  const id = Number(fd.get("id")) || null;
  const nome = String(fd.get("nome") ?? "").trim();
  const taxa = Math.round(Number(String(fd.get("taxa") ?? "0").replace(",", ".")) * 100);
  const dias = fd.getAll("dias").map(Number);
  const ativa = fd.get("ativa") === "on";
  const prefixos = String(fd.get("prefixos") ?? "").split(/[\s,;]+/).map((p) => p.replace(/\D/g, "").slice(0, 5)).filter((p) => p.length === 5);
  if (nome.length < 2) return { erro: "Nome inválido" };
  if (dias.length === 0) return { erro: "Escolha ao menos um dia de entrega" };
  try {
    await comTransacao(async (q) => {
      let zonaId = id;
      if (zonaId) {
        await q(`UPDATE zonas SET nome=$2, taxa_centavos=$3, dias_entrega=$4, ativa=$5 WHERE id=$1`, [zonaId, nome, taxa, dias, ativa]);
        await q(`DELETE FROM zona_ceps WHERE zona_id = $1`, [zonaId]);
      } else {
        const r = await q(`INSERT INTO zonas (nome, taxa_centavos, dias_entrega, ativa, ordem) VALUES ($1,$2,$3,$4,(SELECT coalesce(max(ordem),0)+1 FROM zonas)) RETURNING id`, [nome, taxa, dias, ativa]);
        zonaId = Number(r.rows[0].id);
      }
      for (const p of Array.from(new Set(prefixos))) {
        await q(`INSERT INTO zona_ceps (zona_id, prefixo) VALUES ($1,$2) ON CONFLICT (prefixo) DO UPDATE SET zona_id = EXCLUDED.zona_id`, [zonaId, p]);
      }
      // garante uma janela padrão
      const j = await q(`SELECT 1 FROM janelas WHERE zona_id = $1`, [zonaId]);
      if (j.rowCount === 0) await q(`INSERT INTO janelas (zona_id, corte, inicio, fim) VALUES ($1,'15:00','18:00','21:00')`, [zonaId]);
    });
  } catch (e) {
    console.error(e);
    return { erro: "Erro ao salvar zona." };
  }
  revalidatePath("/admin/entregas");
  return { ok: true };
}

export async function excluirZona(id: number): Promise<R> {
  await exigirSessao(["admin"]);
  await sql`UPDATE zonas SET ativa = false WHERE id = ${id}`;
  revalidatePath("/admin/entregas");
  return { ok: true };
}

export async function salvarJanela(fd: FormData): Promise<R> {
  await exigirSessao(["admin"]);
  const id = Number(fd.get("id")) || null;
  const zona_id = Number(fd.get("zona_id"));
  const corte = String(fd.get("corte")); const inicio = String(fd.get("inicio")); const fim = String(fd.get("fim"));
  const ativa = fd.get("ativa") !== "off";
  if (!/^\d{2}:\d{2}$/.test(corte) || !/^\d{2}:\d{2}$/.test(inicio) || !/^\d{2}:\d{2}$/.test(fim)) return { erro: "Horário inválido" };
  if (id) await sql`UPDATE janelas SET corte=${corte}, inicio=${inicio}, fim=${fim}, ativa=${ativa} WHERE id=${id}`;
  else await sql`INSERT INTO janelas (zona_id, corte, inicio, fim) VALUES (${zona_id}, ${corte}, ${inicio}, ${fim})`;
  revalidatePath("/admin/entregas");
  return { ok: true };
}

export async function excluirJanela(id: number): Promise<R> {
  await exigirSessao(["admin"]);
  await sql`UPDATE janelas SET ativa = false WHERE id = ${id}`;
  revalidatePath("/admin/entregas");
  return { ok: true };
}

/* ---------- Configurações ---------- */
const chavesPermitidas = new Set([
  "loja_nome","loja_endereco","loja_cep","loja_whatsapp","pix_chave","frete_gratis_minimo_centavos","peso_extra_limite_kg",
  "peso_extra_taxa_centavos","peso_extra_bloco_kg","expresso_ativo","expresso_taxa_centavos","expresso_peso_max_kg","expresso_prazo_horas","retirada_prazo_horas",
  "recompra_dias_antes","whatsapp_notificacoes","pix_expiracao_minutos",
]);

export async function salvarConfig(fd: FormData): Promise<R> {
  await exigirSessao(["admin"]);
  for (const [k, v] of fd.entries()) {
    if (!chavesPermitidas.has(k)) continue;
    let val = String(v).trim();
    if (k.endsWith("_centavos")) val = String(Math.round(Number(val.replace(",", ".")) * 100));
    if (k === "expresso_ativo" || k === "whatsapp_notificacoes") val = val === "on" ? "true" : "false";
    await sql`INSERT INTO configuracoes (chave, valor) VALUES (${k}, ${val}) ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor`;
  }
  if (!fd.has("expresso_ativo")) await sql`UPDATE configuracoes SET valor = 'false' WHERE chave = 'expresso_ativo'`;
  if (!fd.has("whatsapp_notificacoes")) await sql`UPDATE configuracoes SET valor = 'false' WHERE chave = 'whatsapp_notificacoes'`;
  revalidatePath("/admin/config"); revalidatePath("/");
  return { ok: true };
}

/* ---------- Usuários ---------- */
export async function salvarUsuario(fd: FormData): Promise<R> {
  await exigirSessao(["admin"]);
  const id = String(fd.get("id") ?? "") || null;
  const nome = String(fd.get("nome") ?? "").trim();
  const telefone = normalizarTelefone(String(fd.get("telefone") ?? ""));
  const papel = String(fd.get("papel") ?? "cliente");
  const senha = String(fd.get("senha") ?? "");
  const ativo = fd.get("ativo") !== "off";
  if (nome.length < 2 || telefone.length < 10) return { erro: "Nome/telefone inválidos" };
  if (!["cliente","admin","motorista"].includes(papel)) return { erro: "Papel inválido" };
  if (id) {
    await sql`UPDATE usuarios SET nome=${nome}, telefone=${telefone}, papel=${papel}, ativo=${ativo} WHERE id=${id}`;
    if (senha) await sql`UPDATE usuarios SET senha_hash=${await hashSenha(senha)} WHERE id=${id}`;
  } else {
    if (senha.length < 6) return { erro: "Senha com pelo menos 6 caracteres" };
    const ex = await sql`SELECT 1 FROM usuarios WHERE telefone = ${telefone}`;
    if (ex.length) return { erro: "Telefone já cadastrado" };
    await sql`INSERT INTO usuarios (nome, telefone, senha_hash, papel) VALUES (${nome}, ${telefone}, ${await hashSenha(senha)}, ${papel})`;
  }
  revalidatePath("/admin/usuarios");
  return { ok: true };
}

/* ---------- WhatsApp ---------- */
export async function testarWhatsApp(fd: FormData): Promise<R> {
  await exigirSessao(["admin"]);
  const { enviarWhatsApp } = await import("@/lib/whatsapp");
  const tel = String(fd.get("telefone") ?? "").replace(/\D/g, "");
  if (tel.length < 10) return { erro: "Telefone inválido" };
  const r = await enviarWhatsApp({ telefone: tel, texto: "Teste de notificação da Casa de Ração ✅", tipo: "teste" });
  revalidatePath("/admin/notificacoes");
  return r.ok ? { ok: true } : { erro: r.erro ?? "Falha no envio" };
}

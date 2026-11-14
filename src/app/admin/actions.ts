"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirSessao, hashSenha, normalizarTelefone, SENHAS_INICIAIS } from "@/lib/auth";
import { sql } from "@/lib/db";
import { comTransacao } from "@/lib/pool";
import { cancelarPedido, ErroPedido } from "@/lib/pedidos";
import { slugify } from "@/lib/utils";
import { notificarPedido } from "@/lib/whatsapp";
import { otimizarRota } from "@/lib/rota";
import { after } from "next/server";
import { getConfig } from "@/lib/db";
import { pedirConfirmacao } from "@/lib/confirmacao";

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
  custo: z.string().optional().transform((v) => (v && v.trim() ? Math.round(Number(v.replace(/\./g, "").replace(",", ".")) * 100) : null)),
  preco_de: z.string().optional().transform((v) => (v && v.trim() ? Math.round(Number(v.replace(/\./g, "").replace(",", ".")) * 100) : null)),
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
  // upload de imagem (Vercel Blob) — opcional
  const arquivo = fd.get("imagem_arquivo");
  let imagemUrl = p.imagem_url || null;
  if (arquivo instanceof File && arquivo.size > 0) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) return { erro: "Upload indisponível: defina BLOB_READ_WRITE_TOKEN (Vercel Blob) ou use a URL da imagem." };
    if (arquivo.size > 4 * 1024 * 1024) return { erro: "Imagem até 4 MB." };
    if (!/^image\/(jpeg|png|webp|gif)$/.test(arquivo.type)) return { erro: "Formato aceito: JPG, PNG, WEBP ou GIF." };
    const { put } = await import("@vercel/blob");
    const ext = arquivo.type.split("/")[1].replace("jpeg", "jpg");
    const blob = await put(`produtos/${slug}-${Date.now()}.${ext}`, arquivo, { access: "public", contentType: arquivo.type });
    imagemUrl = blob.url;
  }
  if (p.id) {
    await sql`
      UPDATE produtos SET categoria_id=${p.categoria_id}, nome=${p.nome}, marca=${p.marca || null}, descricao=${p.descricao || null},
        peso_kg=${p.peso_kg}, preco_centavos=${p.preco}, imagem_url=${imagemUrl}, duracao_dias=${p.duracao_dias}, custo_centavos=${p.custo}, preco_de_centavos=${p.preco_de && p.preco_de > p.preco ? p.preco_de : null}, ativo=${!!p.ativo}, destaque=${!!p.destaque}
      WHERE id=${p.id}`;
  } else {
    const ex = await sql`SELECT 1 FROM produtos WHERE slug = ${slug}`;
    const s = ex.length ? `${slug}-${Date.now().toString(36)}` : slug;
    await sql`
      INSERT INTO produtos (categoria_id, nome, slug, marca, descricao, peso_kg, preco_centavos, imagem_url, duracao_dias, custo_centavos, preco_de_centavos, ativo, destaque, estoque)
      VALUES (${p.categoria_id}, ${p.nome}, ${s}, ${p.marca || null}, ${p.descricao || null}, ${p.peso_kg}, ${p.preco}, ${imagemUrl}, ${p.duracao_dias}, ${p.custo}, ${p.preco_de && p.preco_de > p.preco ? p.preco_de : null}, ${!!p.ativo}, ${!!p.destaque}, 0)`;
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
  if (novo === "entregue") after(() => import("@/lib/indicacao").then((m) => m.premiarIndicacao(id)).catch((e) => console.error("premiarIndicacao", e)));
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
  const rotaId = await comTransacao(async (q) => {
    const r = await q(`INSERT INTO rotas (data, motorista_id, zona_id) VALUES ($1,$2,$3) RETURNING id`, [data, motorista, zona]);
    const rotaId = String(r.rows[0].id);
    // ordem inicial por CEP; em seguida otimizamos com geolocalização
    const ord = await q(
      `SELECT id FROM pedidos WHERE id = ANY($1::uuid[]) AND rota_id IS NULL AND status IN ('pago','separado') ORDER BY endereco->>'cep'`,
      [pedidos],
    );
    let i = 1;
    for (const row of ord.rows) {
      await q(`UPDATE pedidos SET rota_id = $1, ordem_rota = $2, confirmacao = NULL, confirmacao_em = NULL, confirmacao_pedida_em = NULL, status = CASE WHEN status = 'pago' THEN 'separado' ELSE status END WHERE id = $3`, [rotaId, i++, row.id]);
    }
    return rotaId;
  });
  try { await otimizarRota(rotaId); } catch (e) { console.error("otimizarRota", e); }
  if ((await getConfig()).confirmacao_automatica !== "false") {
    after(() => pedirConfirmacao(rotaId).catch((e) => console.error("pedirConfirmacao", e)));
  }
  revalidatePath("/admin/rotas"); revalidatePath("/motorista");
  return { ok: true };
}

/** Manda (ou reenvia) o WhatsApp “vai estar em casa?” para quem ainda não respondeu. */
export async function pedirConfirmacaoAction(rotaId: string): Promise<R> {
  await exigirSessao(["admin"]);
  const n = await pedirConfirmacao(rotaId, true);
  revalidatePath("/admin/rotas");
  return n ? { ok: true } : { erro: "Todos os clientes desta rota já responderam." };
}

/** Joga para o fim da rota as paradas sem confirmação (ou que disseram não), mantendo a ordem entre elas. */
export async function naoConfirmadosParaFim(rotaId: string): Promise<R> {
  const s = await exigirSessao(["admin", "motorista"]);
  const [r] = (await sql`SELECT motorista_id FROM rotas WHERE id = ${rotaId}`) as { motorista_id: string | null }[];
  if (!r) return { erro: "Rota não encontrada." };
  if (s.papel === "motorista" && r.motorista_id !== s.id) return { erro: "Rota de outro motorista." };
  await sql`
    UPDATE pedidos p SET ordem_rota = o.nova FROM (
      SELECT id, row_number() OVER (ORDER BY (confirmacao IS DISTINCT FROM 'sim'), ordem_rota) AS nova
      FROM pedidos WHERE rota_id = ${rotaId}
    ) o WHERE p.id = o.id
  `;
  revalidatePath("/admin/rotas"); revalidatePath("/motorista");
  return { ok: true };
}

/** Acerto de caixa: a loja confere o dinheiro e os comprovantes de cartão que o motorista trouxe. */
export async function registrarAcerto(fd: FormData): Promise<R> {
  const s = await exigirSessao(["admin"]);
  const rotaId = String(fd.get("rota_id"));
  const n = (k: string) => Math.round(Number(String(fd.get(k) ?? "0").replace(/\./g, "").replace(",", ".")) * 100) || 0;
  const { esperadoDaRota } = await import("@/lib/acerto");
  const esp = await esperadoDaRota(rotaId);
  if (!esp) return { erro: "Rota não encontrada." };
  const recebidoDinheiro = n("recebido_dinheiro"), recebidoCartao = n("recebido_cartao");
  if (recebidoDinheiro < 0 || recebidoCartao < 0) return { erro: "Valores inválidos." };
  const obs = String(fd.get("observacao") ?? "").trim().slice(0, 500) || null;
  const dif = recebidoDinheiro + recebidoCartao - esp.dinheiro - esp.cartao;
  if (dif !== 0 && !obs) return { erro: "Há diferença no caixa. Escreva uma observação explicando." };
  await sql`
    INSERT INTO acertos_caixa (rota_id, esperado_dinheiro, esperado_cartao, recebido_dinheiro, recebido_cartao, observacao, conferido_por)
    VALUES (${rotaId}, ${esp.dinheiro}, ${esp.cartao}, ${recebidoDinheiro}, ${recebidoCartao}, ${obs}, ${s.id})
    ON CONFLICT (rota_id) DO UPDATE SET esperado_dinheiro = EXCLUDED.esperado_dinheiro, esperado_cartao = EXCLUDED.esperado_cartao,
      recebido_dinheiro = EXCLUDED.recebido_dinheiro, recebido_cartao = EXCLUDED.recebido_cartao, observacao = EXCLUDED.observacao,
      conferido_por = EXCLUDED.conferido_por, conferido_em = now()
  `;
  revalidatePath("/admin/rotas"); revalidatePath("/admin/relatorios"); revalidatePath("/motorista");
  return { ok: true };
}

export async function otimizarRotaAction(rotaId: string): Promise<R> {
  const s = await exigirSessao(["admin", "motorista"]);
  const [r] = (await sql`SELECT motorista_id, status FROM rotas WHERE id = ${rotaId}`) as { motorista_id: string | null; status: string }[];
  if (!r) return { erro: "Rota não encontrada." };
  if (s.papel === "motorista" && r.motorista_id !== s.id) return { erro: "Rota de outro motorista." };
  if (r.status === "concluida") return { erro: "Rota já concluída." };
  try {
    const res = await otimizarRota(rotaId);
    if (!res.ok) return { erro: res.motivo };
    if (res.semOrigem) return { erro: "Rota ordenada por CEP. Para otimizar por distância, confira o endereço da loja em Configurações." };
  } catch (e) {
    console.error(e);
    return { erro: "Não foi possível otimizar agora. Tente de novo em instantes." };
  }
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
  "retirada_prazo_cancelar_horas","retirada_lembrete_horas","pagar_depois_min_pedidos","pagar_depois_max_centavos","faltas_bloqueio","carrinho_lembrete_horas","custo_entrega_centavos","custo_rota_centavos","custo_expresso_centavos","troco_maximo_centavos","confirmacao_automatica","indicacao_ativa","indicacao_desconto_centavos","indicacao_premio_centavos","indicacao_minimo_centavos",
  "avaliacao_auto_publicar","parcelas_max","parcela_minima_centavos","loja_instagram","loja_horario","loja_cnpj",
  "loja_nome","loja_endereco","loja_cep","loja_whatsapp","pix_chave","frete_gratis_minimo_centavos","peso_extra_limite_kg",
  "peso_extra_taxa_centavos","peso_extra_bloco_kg","expresso_ativo","expresso_taxa_centavos","expresso_peso_max_kg","expresso_prazo_horas","retirada_prazo_horas",
  "recompra_dias_antes","whatsapp_notificacoes","pix_expiracao_minutos","loja_lat","loja_lng","comprovante_obrigatorio",
]);

export async function salvarConfig(fd: FormData): Promise<R> {
  await exigirSessao(["admin"]);
  for (const [k, v] of fd.entries()) {
    if (!chavesPermitidas.has(k)) continue;
    let val = String(v).trim();
    if (k.endsWith("_centavos")) val = String(Math.round(Number(val.replace(",", ".")) * 100));
    if (k === "expresso_ativo" || k === "whatsapp_notificacoes" || k === "comprovante_obrigatorio" || k === "avaliacao_auto_publicar" || k === "confirmacao_automatica" || k === "indicacao_ativa") val = val === "on" ? "true" : "false";
    if (k === "loja_lat" || k === "loja_lng") val = val.replace(",", ".");
    await sql`INSERT INTO configuracoes (chave, valor) VALUES (${k}, ${val}) ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor`;
  }
  if (!fd.has("expresso_ativo")) await sql`UPDATE configuracoes SET valor = 'false' WHERE chave = 'expresso_ativo'`;
  if (!fd.has("whatsapp_notificacoes")) await sql`UPDATE configuracoes SET valor = 'false' WHERE chave = 'whatsapp_notificacoes'`;
  if (!fd.has("comprovante_obrigatorio")) await sql`UPDATE configuracoes SET valor = 'false' WHERE chave = 'comprovante_obrigatorio'`;
  if (!fd.has("indicacao_ativa")) await sql`INSERT INTO configuracoes (chave, valor) VALUES ('indicacao_ativa', 'false') ON CONFLICT (chave) DO UPDATE SET valor = 'false'`;
  if (!fd.has("confirmacao_automatica")) await sql`INSERT INTO configuracoes (chave, valor) VALUES ('confirmacao_automatica', 'false') ON CONFLICT (chave) DO UPDATE SET valor = 'false'`;
  if (!fd.has("avaliacao_auto_publicar")) await sql`INSERT INTO configuracoes (chave, valor) VALUES ('avaliacao_auto_publicar', 'false') ON CONFLICT (chave) DO UPDATE SET valor = 'false'`;
  // endereço da loja mudou → recalcula coordenadas na próxima otimização
  if (fd.has("loja_endereco") && !String(fd.get("loja_lat") ?? "").trim()) await sql`UPDATE configuracoes SET valor = '' WHERE chave IN ('loja_lat','loja_lng')`;
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
    if (senha) await sql`UPDATE usuarios SET senha_hash=${await hashSenha(senha)}, senha_padrao=${SENHAS_INICIAIS.includes(senha)} WHERE id=${id}`;
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

/* ---------- Cupons ---------- */
export async function salvarCupom(fd: FormData): Promise<R> {
  await exigirSessao(["admin"]);
  const { normalizarCodigo } = await import("@/lib/cupons");
  const id = Number(fd.get("id")) || null;
  const codigo = normalizarCodigo(String(fd.get("codigo") ?? ""));
  const descricao = String(fd.get("descricao") ?? "").trim() || null;
  const tipo = String(fd.get("tipo") ?? "percentual");
  const valorRaw = String(fd.get("valor") ?? "0").replace(",", ".");
  const valor = tipo === "percentual" ? Math.round(Number(valorRaw)) : tipo === "fixo" ? Math.round(Number(valorRaw) * 100) : 0;
  const minimo = Math.round(Number(String(fd.get("minimo") ?? "0").replace(",", ".")) * 100);
  const primeira = fd.get("primeira_compra") === "on";
  const limite = Number(fd.get("limite_usos")) || null;
  const validoAte = String(fd.get("valido_ate") ?? "") || null;
  const ativo = fd.get("ativo") === "on";
  if (codigo.length < 3) return { erro: "Código com pelo menos 3 caracteres" };
  if (!["percentual", "fixo", "frete_gratis"].includes(tipo)) return { erro: "Tipo inválido" };
  if (tipo === "percentual" && (valor < 1 || valor > 100)) return { erro: "Percentual entre 1 e 100" };
  if (tipo === "fixo" && valor < 1) return { erro: "Informe o valor do desconto" };
  if (id) {
    await sql`UPDATE cupons SET codigo=${codigo}, descricao=${descricao}, tipo=${tipo}, valor=${valor}, minimo_centavos=${minimo}, primeira_compra=${primeira}, limite_usos=${limite}, valido_ate=${validoAte}, ativo=${ativo} WHERE id=${id}`;
  } else {
    const ex = await sql`SELECT 1 FROM cupons WHERE codigo = ${codigo}`;
    if (ex.length) return { erro: "Já existe cupom com esse código" };
    await sql`INSERT INTO cupons (codigo, descricao, tipo, valor, minimo_centavos, primeira_compra, limite_usos, valido_ate, ativo) VALUES (${codigo}, ${descricao}, ${tipo}, ${valor}, ${minimo}, ${primeira}, ${limite}, ${validoAte}, ${ativo})`;
  }
  revalidatePath("/admin/cupons");
  return { ok: true };
}

export async function alternarCupom(id: number, ativo: boolean): Promise<R> {
  await exigirSessao(["admin"]);
  await sql`UPDATE cupons SET ativo = ${ativo} WHERE id = ${id}`;
  revalidatePath("/admin/cupons");
  return { ok: true };
}

/* ---------- Avaliações ---------- */
export async function publicarAvaliacao(id: number, publicada: boolean): Promise<R> {
  await exigirSessao(["admin"]);
  await sql`UPDATE avaliacoes SET publicada = ${publicada} WHERE id = ${id}`;
  revalidatePath("/admin/avaliacoes"); revalidatePath("/");
  return { ok: true };
}

export async function responderAvaliacao(fd: FormData): Promise<R> {
  await exigirSessao(["admin"]);
  const id = Number(fd.get("id"));
  const resposta = String(fd.get("resposta") ?? "").trim().slice(0, 500) || null;
  await sql`UPDATE avaliacoes SET resposta = ${resposta} WHERE id = ${id}`;
  revalidatePath("/admin/avaliacoes"); revalidatePath("/");
  return { ok: true };
}

/* ---------- Notificação push neste aparelho ---------- */
const inscricaoSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

export async function salvarInscricaoPush(sub: unknown, aparelho: string): Promise<R> {
  const s = await exigirSessao(["admin"]);
  const parsed = inscricaoSchema.safeParse(sub);
  if (!parsed.success) return { erro: "Inscrição inválida." };
  const { endpoint, keys } = parsed.data;
  await sql`
    INSERT INTO push_inscricoes (usuario_id, endpoint, p256dh, auth, aparelho)
    VALUES (${s.id}, ${endpoint}, ${keys.p256dh}, ${keys.auth}, ${aparelho.slice(0, 120)})
    ON CONFLICT (endpoint) DO UPDATE SET usuario_id = EXCLUDED.usuario_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, aparelho = EXCLUDED.aparelho
  `;
  return { ok: true };
}

export async function removerInscricaoPush(endpoint: string): Promise<R> {
  const s = await exigirSessao(["admin"]);
  await sql`DELETE FROM push_inscricoes WHERE endpoint = ${endpoint} AND usuario_id = ${s.id}`;
  return { ok: true };
}

export async function testarPush(): Promise<R> {
  await exigirSessao(["admin"]);
  const { enviarPush, pushConfigurado } = await import("@/lib/push");
  if (!pushConfigurado()) return { erro: "Notificações ainda não configuradas no servidor." };
  const r = await enviarPush({ titulo: "Teste da Casa de Ração 🔔", corpo: "Se você está vendo isto, os avisos de pedido novo vão chegar aqui.", url: "/admin", tag: "teste" });
  return r.enviados ? { ok: true } : { erro: "Nenhum aparelho recebeu. Ative de novo neste celular." };
}

/* ---------- Falta: cliente não retirou / não recebeu ---------- */
export async function registrarFalta(id: string): Promise<R> {
  const s = await exigirSessao(["admin", "motorista"]);
  const [p] = (await sql`
    SELECT p.status, p.tipo_entrega, r.motorista_id FROM pedidos p LEFT JOIN rotas r ON r.id = p.rota_id WHERE p.id = ${id}
  `) as { status: string; tipo_entrega: string; motorista_id: string | null }[];
  if (!p) return { erro: "Pedido não encontrado" };
  if (s.papel === "motorista" && p.motorista_id !== s.id) return { erro: "Este pedido é de outra rota." };
  if (!["pago", "separado", "em_rota"].includes(p.status)) return { erro: "Só para pedidos confirmados que ainda não foram entregues." };
  const motivo = p.tipo_entrega === "retirada" ? "nao_retirado" : "nao_recebido";
  try { await cancelarPedido(id, s.id, true, motivo); } catch (e) { return { erro: e instanceof ErroPedido ? e.message : "Erro" }; }
  await notificarPedido(id, "cancelado").catch(() => {});
  revalidatePath("/admin/pedidos"); revalidatePath("/admin/rotas"); revalidatePath("/motorista");
  return { ok: true };
}

import { randomInt } from "node:crypto";
import { sql, getConfig } from "./db";
import { urlSite } from "./site";

const ALFA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O/1/I
const aleatorio = (n: number) => Array.from({ length: n }, () => ALFA[randomInt(ALFA.length)]).join("");
const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export type ConfigIndicacao = { ativa: boolean; desconto: number; premio: number; minimo: number };
export async function configIndicacao(): Promise<ConfigIndicacao> {
  const c = await getConfig();
  return {
    ativa: (c.indicacao_ativa ?? "true") === "true",
    desconto: Number(c.indicacao_desconto_centavos ?? 1000),
    premio: Number(c.indicacao_premio_centavos ?? 1000),
    minimo: Number(c.indicacao_minimo_centavos ?? 5000),
  };
}

/** Código fixo do cliente (ex.: RITA7K2), criado na primeira vez. */
export async function codigoDoUsuario(usuarioId: string): Promise<string> {
  const [u] = (await sql`SELECT nome, codigo_indicacao FROM usuarios WHERE id = ${usuarioId}`) as { nome: string; codigo_indicacao: string | null }[];
  if (u?.codigo_indicacao) return u.codigo_indicacao;
  const base = (u?.nome ?? "AMIGO").split(" ")[0].normalize("NFD").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 6) || "AMIGO";
  for (let i = 0; i < 8; i++) {
    const cod = base + aleatorio(3);
    const r = await sql`UPDATE usuarios SET codigo_indicacao = ${cod} WHERE id = ${usuarioId} AND codigo_indicacao IS NULL
      AND NOT EXISTS (SELECT 1 FROM usuarios WHERE codigo_indicacao = ${cod}) RETURNING codigo_indicacao`;
    if (r.length) return cod;
    const [ja] = (await sql`SELECT codigo_indicacao FROM usuarios WHERE id = ${usuarioId}`) as { codigo_indicacao: string | null }[];
    if (ja?.codigo_indicacao) return ja.codigo_indicacao;
  }
  throw new Error("Não foi possível gerar o código de indicação");
}

export const linkIndicacao = (codigo: string) => `${urlSite()}/i/${codigo}`;
export const normalizarIndicacao = (c: string | null | undefined) => (c ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);

export async function indicadorPorCodigo(codigo: string) {
  const cod = normalizarIndicacao(codigo);
  if (!cod) return null;
  const [u] = (await sql`SELECT id, nome FROM usuarios WHERE codigo_indicacao = ${cod} AND ativo`) as { id: string; nome: string }[];
  return u ?? null;
}

async function criarCupomPessoal(o: { usuarioId: string; prefixo: string; valor: number; minimo: number; dias: number; primeiraCompra: boolean; descricao: string; origem: string }) {
  for (let i = 0; i < 5; i++) {
    const codigo = `${o.prefixo}${aleatorio(5)}`;
    const r = await sql`
      INSERT INTO cupons (codigo, descricao, tipo, valor, minimo_centavos, primeira_compra, limite_usos, valido_ate, usuario_id, origem)
      VALUES (${codigo}, ${o.descricao}, 'fixo', ${o.valor}, ${o.minimo}, ${o.primeiraCompra}, 1,
        ((now() AT TIME ZONE 'America/Sao_Paulo')::date + ${o.dias}::int), ${o.usuarioId}, ${o.origem})
      ON CONFLICT (codigo) DO NOTHING RETURNING codigo`;
    if (r.length) return codigo;
  }
  throw new Error("Não foi possível gerar o cupom");
}

/** Liga a conta nova a quem indicou e dá o cupom de boas-vindas. Silencioso se o código não vale. */
export async function registrarIndicacao(novoId: string, codigo: string | null | undefined) {
  const cfg = await configIndicacao();
  if (!cfg.ativa || !codigo) return null;
  const ind = await indicadorPorCodigo(codigo);
  if (!ind || ind.id === novoId) return null;
  const ok = await sql`UPDATE usuarios SET indicado_por = ${ind.id} WHERE id = ${novoId} AND indicado_por IS NULL RETURNING id`;
  if (!ok.length) return null;
  await sql`INSERT INTO indicacoes (indicado_id, indicador_id) VALUES (${novoId}, ${ind.id}) ON CONFLICT DO NOTHING`;
  if (cfg.desconto <= 0) return { indicador: ind.nome, cupom: null };
  const cupom = await criarCupomPessoal({
    usuarioId: novoId, prefixo: "AMIGO", valor: cfg.desconto, minimo: cfg.minimo, dias: 60, primeiraCompra: true,
    descricao: `Presente de ${ind.nome.split(" ")[0]}`, origem: "indicacao_amigo",
  });
  return { indicador: ind.nome, cupom };
}

const chaveEndereco = (e: { cep?: string; numero?: string } | null | undefined) =>
  e?.cep ? `${String(e.cep).replace(/\D/g, "")}|${String(e.numero ?? "").trim().toLowerCase()}` : null;

/**
 * Quando o 1º pedido do indicado é entregue, quem indicou ganha o prêmio (uma única vez por amigo).
 * Recusa se a entrega foi no mesmo endereço de quem indicou (indicação para si mesmo).
 */
export async function premiarIndicacao(pedidoId: string) {
  const [p] = (await sql`
    SELECT p.cliente_id, p.endereco, p.status, i.indicador_id, i.status AS ind_status, u.nome AS indicado, iu.nome AS indicador, iu.telefone AS tel_indicador
    FROM pedidos p JOIN indicacoes i ON i.indicado_id = p.cliente_id
    JOIN usuarios u ON u.id = p.cliente_id JOIN usuarios iu ON iu.id = i.indicador_id
    WHERE p.id = ${pedidoId}
  `) as { cliente_id: string; endereco: { cep?: string; numero?: string } | null; status: string; indicador_id: string; ind_status: string; indicado: string; indicador: string; tel_indicador: string }[];
  if (!p || p.status !== "entregue" || p.ind_status !== "cadastrou") return null;
  const cfg = await configIndicacao();
  if (!cfg.ativa || cfg.premio <= 0) return null;

  const chave = chaveEndereco(p.endereco);
  if (chave) {
    const ends = (await sql`SELECT cep, numero FROM enderecos WHERE usuario_id = ${p.indicador_id}`) as { cep: string; numero: string }[];
    if (ends.some((e) => chaveEndereco(e) === chave)) {
      await sql`UPDATE indicacoes SET status = 'recusado', motivo = 'Entrega no mesmo endereço de quem indicou', pedido_id = ${pedidoId} WHERE indicado_id = ${p.cliente_id} AND status = 'cadastrou'`;
      return null;
    }
  }
  // trava a linha antes de criar o cupom: nunca premia duas vezes
  const trava = await sql`UPDATE indicacoes SET status = 'premiado', pedido_id = ${pedidoId}, premiado_em = now() WHERE indicado_id = ${p.cliente_id} AND status = 'cadastrou' RETURNING indicado_id`;
  if (!trava.length) return null;
  const cupom = await criarCupomPessoal({
    usuarioId: p.indicador_id, prefixo: "PREMIO", valor: cfg.premio, minimo: cfg.minimo, dias: 90, primeiraCompra: false,
    descricao: `Indicação de ${p.indicado.split(" ")[0]}`, origem: "indicacao_premio",
  });
  await sql`UPDATE indicacoes SET cupom_premio = ${cupom} WHERE indicado_id = ${p.cliente_id}`;
  const { enviarWhatsApp } = await import("./whatsapp");
  await enviarWhatsApp({
    telefone: p.tel_indicador, tipo: "indicacao_premio", usuarioId: p.indicador_id,
    texto: `Oba, ${p.indicador.split(" ")[0]}! 🎁 ${p.indicado.split(" ")[0]} recebeu o primeiro pedido com a sua indicação.\nVocê ganhou ${brl(cfg.premio)} de desconto: cupom *${cupom}* (vale 90 dias, pedidos a partir de ${brl(cfg.minimo)}).\n${urlSite()}/conta/indique`,
  }).catch(() => {});
  return cupom;
}

export type CupomPessoal = { codigo: string; descricao: string | null; valor: number; minimo_centavos: number; valido_ate: string | null; primeira_compra: boolean };
export async function cuponsDisponiveis(usuarioId: string): Promise<CupomPessoal[]> {
  return (await sql`
    SELECT codigo, descricao, valor, minimo_centavos, valido_ate::text, primeira_compra FROM cupons
    WHERE usuario_id = ${usuarioId} AND ativo AND (limite_usos IS NULL OR usos < limite_usos)
      AND (valido_ate IS NULL OR valido_ate >= (now() AT TIME ZONE 'America/Sao_Paulo')::date)
      AND (NOT primeira_compra OR NOT EXISTS (SELECT 1 FROM pedidos WHERE cliente_id = ${usuarioId} AND status <> 'cancelado'))
    ORDER BY valido_ate NULLS LAST
  `) as CupomPessoal[];
}

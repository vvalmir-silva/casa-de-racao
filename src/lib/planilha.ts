import { slugify } from "./utils";

/**
 * Importação de produtos por planilha (CSV do Excel/Google Planilhas ou .xlsx).
 * Uma linha por produto. Produto existente é reconhecido pela coluna "codigo" (slug) ou pelo nome.
 */

export const COLUNAS = ["codigo", "nome", "categoria", "marca", "preco", "preco_de", "custo", "estoque", "peso_kg", "duracao_dias", "descricao", "imagem_url", "ativo", "destaque"] as const;
type Coluna = (typeof COLUNAS)[number];

const sem = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const APELIDOS: Record<string, Coluna> = {
  codigo: "codigo", slug: "codigo", sku: "codigo", "cod": "codigo",
  nome: "nome", produto: "nome", descricao_curta: "nome",
  categoria: "categoria", departamento: "categoria",
  marca: "marca", fabricante: "marca",
  preco: "preco", "preco (r$)": "preco", "preco por": "preco", valor: "preco", "preco de venda": "preco", venda: "preco",
  preco_de: "preco_de", "preco de": "preco_de", "preco antigo": "preco_de", "de": "preco_de", "preco original": "preco_de",
  custo: "custo", "preco de custo": "custo",
  estoque: "estoque", quantidade: "estoque", qtd: "estoque", saldo: "estoque",
  peso: "peso_kg", peso_kg: "peso_kg", "peso (kg)": "peso_kg", "peso kg": "peso_kg",
  duracao_dias: "duracao_dias", duracao: "duracao_dias", "dura (dias)": "duracao_dias", "duracao (dias)": "duracao_dias",
  descricao: "descricao", detalhes: "descricao",
  imagem_url: "imagem_url", imagem: "imagem_url", foto: "imagem_url", "url da imagem": "imagem_url",
  ativo: "ativo", "a venda": "ativo", "à venda": "ativo",
  destaque: "destaque",
};

/* ---------- leitura ---------- */

function decodificar(buf: Buffer) {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buf).replace(/^﻿/, ""); }
  catch { return new TextDecoder("windows-1252").decode(buf); } // CSV salvo pelo Excel no Brasil
}

export function lerCsv(texto: string): string[][] {
  const primeira = texto.split(/\r?\n/, 1)[0] ?? "";
  const sep = (primeira.match(/;/g)?.length ?? 0) >= (primeira.match(/,/g)?.length ?? 0) ? ";" : primeira.includes("\t") ? "\t" : ",";
  const linhas: string[][] = [];
  let campo = "", linha: string[] = [], aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { linha.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      linha.push(campo); linhas.push(linha); linha = []; campo = "";
    } else campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas.filter((l) => l.some((x) => x.trim()));
}

export async function lerArquivo(arquivo: File): Promise<string[][]> {
  const buf = Buffer.from(await arquivo.arrayBuffer());
  const nome = arquivo.name.toLowerCase();
  if (nome.endsWith(".xlsx") || buf.subarray(0, 2).toString() === "PK") {
    const { readSheet } = await import("read-excel-file/node");
    const dados = await readSheet(buf);
    return dados
      .map((l) => l.map((c) => (c == null ? "" : c instanceof Date ? c.toISOString().slice(0, 10) : String(c))))
      .filter((l) => l.some((x) => x.trim()));
  }
  return lerCsv(decodificar(buf));
}

/* ---------- conversões ---------- */

/** "R$ 1.234,56" | "79,9" | "79.90" | 79.9 → centavos */
export function dinheiro(v: string): number | null {
  const t = v.replace(/r\$|\s/gi, "");
  if (!t) return null;
  let n: number;
  if (/,\d{1,2}$/.test(t)) n = Number(t.replace(/\./g, "").replace(",", "."));
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) n = Number(t.replace(/\./g, ""));
  else n = Number(t.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
}
const numero = (v: string) => { const t = v.replace(/\s|kg/gi, "").replace(",", "."); if (!t) return null; const n = Number(t); return Number.isFinite(n) ? n : NaN; };
const simNao = (v: string) => { const t = sem(v); if (!t) return null; if (["sim", "s", "1", "true", "verdadeiro", "x", "yes"].includes(t)) return true; if (["nao", "n", "0", "false", "falso", "no"].includes(t)) return false; return undefined; };

/* ---------- validação ---------- */

export type Categoria = { id: number; nome: string; slug: string };
export type Existente = { id: string; slug: string; nome: string; estoque: number };

export type LinhaAnalisada = {
  linha: number;
  acao: "novo" | "atualizar" | "erro";
  nome: string;
  erros: string[];
  avisos: string[];
  produtoId?: string;
  dados: {
    slug: string; nome: string; categoria_id?: number; marca?: string | null; preco?: number; preco_de?: number | null; custo?: number | null;
    estoque?: number; peso_kg?: number; duracao_dias?: number | null; descricao?: string | null; imagem_url?: string | null; ativo?: boolean; destaque?: boolean;
  };
};

export function analisar(tabela: string[][], categorias: Categoria[], existentes: Existente[]) {
  if (tabela.length < 2) return { erroGeral: "A planilha está vazia ou só tem o cabeçalho.", linhas: [] as LinhaAnalisada[] };
  const cab = tabela[0].map((h) => APELIDOS[sem(h).replace(/\s+/g, " ")] ?? null);
  if (!cab.includes("nome")) return { erroGeral: "Falta a coluna “nome” no cabeçalho (primeira linha).", linhas: [] };

  const porSlug = new Map(existentes.map((e) => [e.slug, e]));
  const porNome = new Map(existentes.map((e) => [sem(e.nome), e]));
  const achaCategoria = (v: string) => {
    const t = sem(v);
    if (!t) return undefined;
    return categorias.find((c) => sem(c.nome) === t || c.slug === slugify(v))
      ?? categorias.find((c) => sem(c.nome).replace(/^racao para /, "") === t.replace(/^racao para /, ""))
      ?? categorias.find((c) => sem(c.nome).includes(t));
  };
  const vistos = new Set<string>();

  const linhas: LinhaAnalisada[] = tabela.slice(1).map((cels, idx) => {
    const v = (col: Coluna) => { const i = cab.indexOf(col); return i >= 0 ? String(cels[i] ?? "").trim() : ""; };
    const tem = (col: Coluna) => cab.includes(col) && v(col) !== "";
    const erros: string[] = [], avisos: string[] = [];
    const nome = v("nome");
    const codigo = v("codigo") ? slugify(v("codigo")) : "";
    const existente = (codigo && porSlug.get(codigo)) || porNome.get(sem(nome)) || (nome ? porSlug.get(slugify(nome)) : undefined);
    const slug = existente?.slug ?? (codigo || slugify(nome));
    const d: LinhaAnalisada["dados"] = { slug, nome: nome || existente?.nome || "" };

    if (!nome && !existente) erros.push("sem nome");
    else if (nome && nome.length < 2) erros.push("nome muito curto");
    if (vistos.has(slug)) erros.push("produto repetido na planilha");
    vistos.add(slug);

    if (tem("categoria")) {
      const c = achaCategoria(v("categoria"));
      if (c) d.categoria_id = c.id; else erros.push(`categoria “${v("categoria")}” não existe (use: ${categorias.map((c) => c.nome).join(", ")})`);
    } else if (!existente) erros.push("sem categoria");

    if (tem("preco")) { const p = dinheiro(v("preco")); if (p == null || Number.isNaN(p) || p <= 0) erros.push(`preço inválido “${v("preco")}”`); else d.preco = p; }
    else if (!existente) erros.push("sem preço");

    if (cab.includes("preco_de")) {
      const p = v("preco_de") ? dinheiro(v("preco_de")) : null;
      if (p != null && Number.isNaN(p)) erros.push(`preço “de” inválido “${v("preco_de")}”`);
      else d.preco_de = p || null;
    }
    if (cab.includes("custo")) { const p = v("custo") ? dinheiro(v("custo")) : null; if (p != null && Number.isNaN(p)) erros.push(`custo inválido “${v("custo")}”`); else d.custo = p; }
    if (tem("estoque")) { const n = numero(v("estoque")); if (n == null || Number.isNaN(n) || n < 0 || !Number.isInteger(n)) erros.push(`estoque inválido “${v("estoque")}”`); else d.estoque = n; }
    if (tem("peso_kg")) { const n = numero(v("peso_kg")); if (n == null || Number.isNaN(n) || n < 0 || n > 1000) erros.push(`peso inválido “${v("peso_kg")}”`); else d.peso_kg = n; }
    if (cab.includes("duracao_dias")) { const n = v("duracao_dias") ? numero(v("duracao_dias")) : null; if (n != null && (Number.isNaN(n) || n < 0)) erros.push("duração inválida"); else d.duracao_dias = n ? Math.round(n) : null; }
    if (cab.includes("marca")) d.marca = v("marca") || null;
    if (cab.includes("descricao")) d.descricao = v("descricao") || null;
    if (cab.includes("imagem_url")) {
      const u = v("imagem_url");
      if (u && !/^https?:\/\/\S+$/i.test(u) && !u.startsWith("/")) erros.push("imagem precisa ser um link (https://…)");
      else d.imagem_url = u || null;
    }
    for (const col of ["ativo", "destaque"] as const) {
      if (!cab.includes(col) || !v(col)) continue;
      const b = simNao(v(col));
      if (b === undefined) erros.push(`“${col}” deve ser sim ou não`); else if (b !== null) d[col] = b;
    }
    const preco = d.preco ?? undefined;
    if (d.preco_de != null && preco != null && d.preco_de <= preco) { avisos.push("preço “de” menor ou igual ao preço: ignorado"); d.preco_de = null; }
    if (existente && d.estoque != null && d.estoque !== existente.estoque) avisos.push(`estoque ${existente.estoque} → ${d.estoque}`);

    return {
      linha: idx + 2,
      acao: erros.length ? "erro" : existente ? "atualizar" : "novo",
      nome: d.nome || "(sem nome)",
      erros, avisos,
      produtoId: existente?.id,
      dados: d,
    } satisfies LinhaAnalisada;
  });
  return { erroGeral: null, linhas };
}

/** CSV (; e BOM, abre direto no Excel) com os produtos atuais, no mesmo formato da importação. */
export function gerarCsv(linhas: Record<Coluna, string | number | boolean | null>[]) {
  const esc = (x: unknown) => {
    const s = x == null ? "" : typeof x === "boolean" ? (x ? "sim" : "não") : String(x);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [COLUNAS.join(";"), ...linhas.map((l) => COLUNAS.map((c) => esc(l[c])).join(";"))].join("\r\n");
}

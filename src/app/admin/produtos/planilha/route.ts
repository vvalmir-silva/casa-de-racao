import { getSessao } from "@/lib/auth";
import { sql } from "@/lib/db";
import { gerarCsv } from "@/lib/planilha";

/** Baixa os produtos atuais no formato da importação (serve de modelo). */
export async function GET() {
  const s = await getSessao();
  if (s?.papel !== "admin") return new Response("Não autorizado", { status: 401 });
  const rows = (await sql`
    SELECT p.slug AS codigo, p.nome, c.nome AS categoria, p.marca,
      replace(to_char(p.preco_centavos / 100.0, 'FM999999990.00'), '.', ',') AS preco,
      CASE WHEN p.preco_de_centavos IS NULL THEN '' ELSE replace(to_char(p.preco_de_centavos / 100.0, 'FM999999990.00'), '.', ',') END AS preco_de,
      CASE WHEN p.custo_centavos IS NULL THEN '' ELSE replace(to_char(p.custo_centavos / 100.0, 'FM999999990.00'), '.', ',') END AS custo,
      p.estoque, replace(p.peso_kg::text, '.', ',') AS peso_kg, p.duracao_dias, p.descricao, p.imagem_url, p.ativo, p.destaque
    FROM produtos p JOIN categorias c ON c.id = p.categoria_id ORDER BY c.ordem, p.nome
  `) as Parameters<typeof gerarCsv>[0];
  const hoje = new Date().toISOString().slice(0, 10);
  return new Response(gerarCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="produtos-casa-de-racao-${hoje}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

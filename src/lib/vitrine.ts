import { sql, getConfig } from "./db";

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: c % 100 ? 2 : 0 });
const hora = (t: string) => { const [h, m] = t.split(":"); return m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`; };

/** Dados do topo/rodapé da loja, montados a partir das configurações reais (nada inventado). */
export async function dadosVitrine() {
  const [cfg, categorias, janela] = await Promise.all([
    getConfig(),
    sql`SELECT c.nome, c.slug FROM categorias c WHERE EXISTS (SELECT 1 FROM produtos p WHERE p.categoria_id = c.id AND p.ativo) ORDER BY c.ordem, c.nome`.catch(() => []) as Promise<{ nome: string; slug: string }[]>,
    sql`SELECT corte::text, inicio::text, fim::text FROM janelas WHERE ativa ORDER BY corte DESC LIMIT 1`.catch(() => []) as Promise<{ corte: string; inicio: string; fim: string }[]>,
  ]);
  const avisos: string[] = [];
  const gratis = Number(cfg.frete_gratis_minimo_centavos ?? 0);
  if (gratis > 0) avisos.push(`🚚 Frete grátis na rota do bairro em compras acima de ${brl(gratis)}`);
  if (janela[0]) avisos.push(`⏰ Pedidos até ${hora(janela[0].corte)} chegam hoje, entre ${hora(janela[0].inicio)} e ${hora(janela[0].fim)}`);
  avisos.push("💳 PIX, cartão ou dinheiro na entrega");
  avisos.push("🛍️ Retire grátis na loja");
  return { cfg, categorias, avisos };
}

import { sql, getConfig, cfgInt } from "./db";
import { limparCep } from "./utils";
export { brl, limparCep } from "./utils";

export const TZ = "America/Sao_Paulo";

export type Zona = {
  id: number;
  nome: string;
  taxa_centavos: number;
  dias_entrega: number[];
};
export type Janela = { id: number; zona_id: number; corte: string; inicio: string; fim: string };

export type OpcaoEntrega = {
  tipo: "retirada" | "rota" | "expresso";
  titulo: string;
  descricao: string;
  taxa_centavos: number;
  data_entrega: string | null; // YYYY-MM-DD
  zona_id: number | null;
  janela_id: number | null;
};

export type ResultadoFrete = {
  cep: string;
  atende: boolean; // há zona para o CEP
  zona: Zona | null;
  opcoes: OpcaoEntrega[];
  frete_gratis_minimo_centavos: number;
};

/* ---------- utilidades de data no fuso da loja ---------- */

export function partesLocais(d: Date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  const dias: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const hora = p.hour === "24" ? "00" : p.hour;
  return {
    data: `${p.year}-${p.month}-${p.day}`,
    hora: `${hora}:${p.minute}`,
    diaSemana: dias[p.weekday],
  };
}

export function somarDias(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export function diaSemanaDe(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function formatarDataCurta(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const nomes = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const hoje = partesLocais().data;
  if (iso === hoje) return "hoje";
  if (iso === somarDias(hoje, 1)) return "amanhã";
  return `${nomes[dt.getUTCDay()]}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

export function hm(t: string) {
  return t.slice(0, 5);
}

/**
 * Próxima data de entrega para uma zona/janela.
 * Se hoje é dia de entrega e ainda não passou o corte → hoje; senão próximo dia de entrega.
 */
export function proximaDataEntrega(dias: number[], corte: string, agora: Date = new Date()): string {
  const { data, hora, diaSemana } = partesLocais(agora);
  if (dias.includes(diaSemana) && hora < hm(corte)) return data;
  for (let i = 1; i <= 14; i++) {
    const cand = somarDias(data, i);
    if (dias.includes(diaSemanaDe(cand))) return cand;
  }
  return somarDias(data, 1);
}

/* ---------- consulta de zona ---------- */

export async function buscarZonaPorCep(cep: string): Promise<{ zona: Zona; janelas: Janela[] } | null> {
  const c = limparCep(cep);
  if (c.length !== 8) return null;
  const prefixo = c.slice(0, 5);
  const zonas = (await sql`
    SELECT z.id, z.nome, z.taxa_centavos, z.dias_entrega
    FROM zona_ceps zc JOIN zonas z ON z.id = zc.zona_id
    WHERE zc.prefixo = ${prefixo} AND z.ativa
    LIMIT 1
  `) as Zona[];
  if (!zonas[0]) return null;
  const janelas = (await sql`
    SELECT id, zona_id, corte::text, inicio::text, fim::text FROM janelas
    WHERE zona_id = ${zonas[0].id} AND ativa ORDER BY corte
  `) as Janela[];
  return { zona: zonas[0], janelas };
}

/* ---------- cálculo ---------- */

export function taxaPesoExtra(pesoKg: number, cfg: Record<string, string>) {
  const limite = cfgInt(cfg, "peso_extra_limite_kg", 30);
  const bloco = cfgInt(cfg, "peso_extra_bloco_kg", 15);
  const taxa = cfgInt(cfg, "peso_extra_taxa_centavos", 500);
  if (pesoKg <= limite) return 0;
  return Math.ceil((pesoKg - limite) / bloco) * taxa;
}

export async function calcularFrete(params: {
  cep: string;
  subtotal_centavos: number;
  peso_kg: number;
  agora?: Date;
}): Promise<ResultadoFrete> {
  const cfg = await getConfig();
  const agora = params.agora ?? new Date();
  const minimoGratis = cfgInt(cfg, "frete_gratis_minimo_centavos", 15000);
  const cep = limparCep(params.cep);
  const opcoes: OpcaoEntrega[] = [];

  // Retirada sempre disponível
  const prazoRetirada = cfgInt(cfg, "retirada_prazo_horas", 1);
  opcoes.push({
    tipo: "retirada",
    titulo: "Retirar na loja",
    descricao: `Grátis · pronto em ~${prazoRetirada}h · ${cfg.loja_endereco ?? ""}`,
    taxa_centavos: 0,
    data_entrega: partesLocais(agora).data,
    zona_id: null,
    janela_id: null,
  });

  const z = await buscarZonaPorCep(cep);
  if (!z) {
    return { cep, atende: false, zona: null, opcoes, frete_gratis_minimo_centavos: minimoGratis };
  }

  const extraPeso = taxaPesoExtra(params.peso_kg, cfg);
  const gratis = params.subtotal_centavos >= minimoGratis;

  // Entrega em rota: uma opção por janela
  for (const j of z.janelas) {
    const data = proximaDataEntrega(z.zona.dias_entrega, j.corte, agora);
    const taxa = (gratis ? 0 : z.zona.taxa_centavos) + extraPeso;
    opcoes.push({
      tipo: "rota",
      titulo: `Entrega ${formatarDataCurta(data)}, ${hm(j.inicio)}–${hm(j.fim)}`,
      descricao: gratis && extraPeso === 0 ? "Frete grátis" : `Pedidos até ${hm(j.corte)} saem no mesmo dia`,
      taxa_centavos: taxa,
      data_entrega: data,
      zona_id: z.zona.id,
      janela_id: j.id,
    });
  }

  // Expresso: só pedidos leves
  const expressoAtivo = (cfg.expresso_ativo ?? "true") === "true";
  const pesoMax = cfgInt(cfg, "expresso_peso_max_kg", 5);
  if (expressoAtivo && params.peso_kg <= pesoMax) {
    opcoes.push({
      tipo: "expresso",
      titulo: `Expresso · até ${cfgInt(cfg, "expresso_prazo_horas", 2)}h`,
      descricao: "Motoboy sob demanda (pedidos leves)",
      taxa_centavos: cfgInt(cfg, "expresso_taxa_centavos", 1800),
      data_entrega: partesLocais(agora).data,
      zona_id: z.zona.id,
      janela_id: null,
    });
  }

  return { cep, atende: true, zona: z.zona, opcoes, frete_gratis_minimo_centavos: minimoGratis };
}

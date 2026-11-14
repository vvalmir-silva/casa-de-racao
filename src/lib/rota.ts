import { sql, getConfig } from "./db";
import { enderecoTexto, type Endereco } from "./rota-cliente";
export { linksMaps, formatarDistancia, formatarDuracao, enderecoTexto } from "./rota-cliente";

/**
 * Otimização de rota de entrega.
 * Geocodificação: Google (GOOGLE_MAPS_API_KEY) ou Nominatim/OpenStreetMap (grátis, 1 req/s).
 * Ordem: Google Directions (optimize:true) → OSRM trip → heurística local (vizinho mais próximo + 2-opt) → CEP.
 */

export type Ponto = { lat: number; lng: number };
export type { Endereco };

/* ---------- geometria (funções puras, testadas) ---------- */

export function haversine(a: Ponto, b: Ponto) {
  const R = 6371000;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Distância total de um circuito origem → paradas (na ordem) → origem. */
export function distanciaCircuito(origem: Ponto, paradas: Ponto[], ordem: number[]) {
  let d = 0;
  let atual = origem;
  for (const i of ordem) { d += haversine(atual, paradas[i]); atual = paradas[i]; }
  return d + haversine(atual, origem);
}

/** Vizinho mais próximo a partir da origem + melhoria 2-opt. Retorna índices na ordem de visita. */
export function ordemHeuristica(origem: Ponto, paradas: Ponto[]): number[] {
  const n = paradas.length;
  if (n <= 1) return paradas.map((_, i) => i);
  const resto = new Set(paradas.map((_, i) => i));
  const ordem: number[] = [];
  let atual = origem;
  while (resto.size) {
    let melhor = -1, md = Infinity;
    for (const i of resto) { const d = haversine(atual, paradas[i]); if (d < md) { md = d; melhor = i; } }
    ordem.push(melhor); resto.delete(melhor); atual = paradas[melhor];
  }
  // 2-opt
  let melhorou = true;
  let melhorDist = distanciaCircuito(origem, paradas, ordem);
  for (let it = 0; melhorou && it < 50; it++) {
    melhorou = false;
    for (let i = 0; i < n - 1; i++) {
      for (let k = i + 1; k < n; k++) {
        const nova = [...ordem.slice(0, i), ...ordem.slice(i, k + 1).reverse(), ...ordem.slice(k + 1)];
        const d = distanciaCircuito(origem, paradas, nova);
        if (d + 1e-6 < melhorDist) { ordem.splice(0, n, ...nova); melhorDist = d; melhorou = true; }
      }
    }
  }
  return ordem;
}

/* ---------- geocodificação ---------- */

const UA = "CasaDeRacao/1.0 (entregas de bairro)";
let ultimaNominatim = 0;

async function esperarNominatim() {
  const espera = 1100 - (Date.now() - ultimaNominatim);
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  ultimaNominatim = Date.now();
}

export async function geocodificar(e: Endereco | string): Promise<Ponto | null> {
  if (process.env.GEOCODER === "off") return null; // testes / sem internet
  const texto = typeof e === "string" ? e : enderecoTexto(e);
  const key = process.env.GOOGLE_MAPS_API_KEY;
  try {
    if (key) {
      const u = new URL("https://maps.googleapis.com/maps/api/geocode/json");
      u.searchParams.set("address", texto);
      u.searchParams.set("region", "br");
      u.searchParams.set("key", key);
      const j = await (await fetch(u, { cache: "no-store" })).json();
      const loc = j.results?.[0]?.geometry?.location;
      return loc ? { lat: loc.lat, lng: loc.lng } : null;
    }
    await esperarNominatim();
    const u = new URL("https://nominatim.openstreetmap.org/search");
    u.searchParams.set("format", "json");
    u.searchParams.set("limit", "1");
    u.searchParams.set("countrycodes", "br");
    if (typeof e === "string") u.searchParams.set("q", e);
    else {
      u.searchParams.set("street", `${e.numero} ${e.logradouro}`);
      u.searchParams.set("city", e.cidade);
      u.searchParams.set("state", e.uf);
      u.searchParams.set("postalcode", e.cep.replace(/\D/g, "").replace(/^(\d{5})(\d{3})$/, "$1-$2"));
    }
    let j = await (await fetch(u, { headers: { "User-Agent": UA, "Accept-Language": "pt-BR" }, cache: "no-store" })).json();
    if (!j?.[0] && typeof e !== "string") {
      // segunda tentativa: busca livre (rua + cidade), útil quando o CEP não bate
      await esperarNominatim();
      const u2 = new URL("https://nominatim.openstreetmap.org/search");
      u2.searchParams.set("format", "json"); u2.searchParams.set("limit", "1"); u2.searchParams.set("countrycodes", "br");
      u2.searchParams.set("q", `${e.logradouro}, ${e.numero}, ${e.bairro}, ${e.cidade}`);
      j = await (await fetch(u2, { headers: { "User-Agent": UA, "Accept-Language": "pt-BR" }, cache: "no-store" })).json();
    }
    return j?.[0] ? { lat: Number(j[0].lat), lng: Number(j[0].lon) } : null;
  } catch (err) {
    console.error("geocodificar", err);
    return null;
  }
}

/** Coordenadas da loja (configuração; geocodifica e salva na primeira vez). */
export async function origemLoja(): Promise<Ponto | null> {
  const cfg = await getConfig();
  const lat = Number(cfg.loja_lat), lng = Number(cfg.loja_lng);
  if (cfg.loja_lat && cfg.loja_lng && Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  if (!cfg.loja_endereco) return null;
  const p = await geocodificar(cfg.loja_endereco);
  if (p) {
    await sql`INSERT INTO configuracoes (chave, valor) VALUES ('loja_lat', ${String(p.lat)}) ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor`;
    await sql`INSERT INTO configuracoes (chave, valor) VALUES ('loja_lng', ${String(p.lng)}) ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor`;
  }
  return p;
}

/* ---------- roteirização ---------- */

type Resultado = { ordem: number[]; distancia_m: number | null; duracao_s: number | null; por: "google" | "osrm" | "local" | "cep" };

async function viaGoogle(origem: Ponto, paradas: Ponto[]): Promise<Resultado | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key || paradas.length > 25) return null;
  const u = new URL("https://maps.googleapis.com/maps/api/directions/json");
  const o = `${origem.lat},${origem.lng}`;
  u.searchParams.set("origin", o);
  u.searchParams.set("destination", o);
  u.searchParams.set("waypoints", "optimize:true|" + paradas.map((p) => `${p.lat},${p.lng}`).join("|"));
  u.searchParams.set("key", key);
  const j = await (await fetch(u, { cache: "no-store" })).json();
  const r = j.routes?.[0];
  if (!r) return null;
  const legs = r.legs as { distance: { value: number }; duration: { value: number } }[];
  return {
    ordem: r.waypoint_order as number[],
    distancia_m: legs.reduce((a, l) => a + l.distance.value, 0),
    duracao_s: legs.reduce((a, l) => a + l.duration.value, 0),
    por: "google",
  };
}

async function viaOsrm(origem: Ponto, paradas: Ponto[]): Promise<Resultado | null> {
  if (paradas.length > 90 || process.env.GEOCODER === "off") return null;
  const coords = [origem, ...paradas].map((p) => `${p.lng},${p.lat}`).join(";");
  const base = process.env.OSRM_URL?.replace(/\/$/, "") || "https://router.project-osrm.org";
  const r = await fetch(`${base}/trip/v1/driving/${coords}?source=first&roundtrip=true&overview=false`, { headers: { "User-Agent": UA }, cache: "no-store" });
  if (!r.ok) return null;
  const j = await r.json();
  if (j.code !== "Ok") return null;
  // waypoints[i].waypoint_index = posição da coordenada i na viagem (0 = loja)
  const pos = (j.waypoints as { waypoint_index: number }[]).slice(1).map((w, i) => ({ i, pos: w.waypoint_index }));
  pos.sort((a, b) => a.pos - b.pos);
  return { ordem: pos.map((p) => p.i), distancia_m: Math.round(j.trips[0].distance), duracao_s: Math.round(j.trips[0].duration), por: "osrm" };
}

type PedidoRota = { id: string; endereco: Endereco & { id?: string }; lat: number | null; lng: number | null };

/**
 * Geocodifica as paradas sem coordenada, calcula a melhor ordem e grava em pedidos.ordem_rota e no resumo da rota.
 */
export async function otimizarRota(rotaId: string) {
  const peds = (await sql`
    SELECT id, endereco, lat, lng FROM pedidos WHERE rota_id = ${rotaId} AND status NOT IN ('cancelado','entregue') ORDER BY ordem_rota
  `) as PedidoRota[];
  if (peds.length === 0) return { ok: false as const, motivo: "Rota sem paradas pendentes." };

  // 1) coordenadas
  for (const p of peds) {
    if (p.lat != null && p.lng != null) continue;
    let pt: Ponto | null = null;
    if (p.endereco?.id) {
      const [e] = (await sql`SELECT lat, lng FROM enderecos WHERE id = ${p.endereco.id}`) as { lat: number | null; lng: number | null }[];
      if (e?.lat != null && e?.lng != null) pt = { lat: e.lat, lng: e.lng };
    }
    if (!pt && p.endereco) pt = await geocodificar(p.endereco);
    if (pt) {
      p.lat = pt.lat; p.lng = pt.lng;
      await sql`UPDATE pedidos SET lat = ${pt.lat}, lng = ${pt.lng} WHERE id = ${p.id}`;
      if (p.endereco?.id) await sql`UPDATE enderecos SET lat = ${pt.lat}, lng = ${pt.lng} WHERE id = ${p.endereco.id} AND lat IS NULL`;
    }
  }

  const com = peds.filter((p) => p.lat != null && p.lng != null);
  const sem = peds.filter((p) => p.lat == null || p.lng == null).sort((a, b) => (a.endereco?.cep ?? "").localeCompare(b.endereco?.cep ?? ""));
  const origem = await origemLoja();

  // 2) ordem
  let res: Resultado = { ordem: com.map((_, i) => i), distancia_m: null, duracao_s: null, por: "cep" };
  if (origem && com.length > 0) {
    const pts = com.map((p) => ({ lat: p.lat!, lng: p.lng! }));
    let r: Resultado | null = null;
    try { r = await viaGoogle(origem, pts); } catch (e) { console.error("google directions", e); }
    if (!r) { try { r = await viaOsrm(origem, pts); } catch (e) { console.error("osrm", e); } }
    if (!r) {
      const ordem = ordemHeuristica(origem, pts);
      const d = distanciaCircuito(origem, pts, ordem) * 1.35; // ruas ≠ linha reta
      r = { ordem, distancia_m: Math.round(d), duracao_s: Math.round((d / 1000 / 22) * 3600), por: "local" };
    }
    res = r;
  } else if (!origem) {
    res.por = "cep";
  }

  // 3) grava (paradas sem coordenada vão ao final, por CEP); + 3 min por parada no tempo
  const final = [...res.ordem.map((i) => com[i]), ...sem];
  for (let i = 0; i < final.length; i++) await sql`UPDATE pedidos SET ordem_rota = ${i + 1} WHERE id = ${final[i].id}`;
  const duracao = res.duracao_s != null ? res.duracao_s + final.length * 180 : null;
  await sql`UPDATE rotas SET distancia_m = ${res.distancia_m}, duracao_s = ${duracao}, otimizada_por = ${res.por} WHERE id = ${rotaId}`;
  return { ok: true as const, por: res.por, semCoordenada: sem.length, paradas: final.length, distancia_m: res.distancia_m, duracao_s: duracao, semOrigem: !origem };
}


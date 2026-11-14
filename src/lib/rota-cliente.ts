/** Funções de rota sem acesso ao banco (podem rodar no navegador). */

export type Endereco = { logradouro: string; numero: string; bairro: string; cidade: string; uf: string; cep: string };

/** Quebra a rota em trechos de até 9 paradas (limite prático de waypoints do Google Maps no celular). */
export function linksMaps(origem: string, enderecos: string[], porTrecho = 9) {
  const links: string[] = [];
  let inicio = origem;
  for (let i = 0; i < enderecos.length; i += porTrecho) {
    const trecho = enderecos.slice(i, i + porTrecho);
    const destino = trecho[trecho.length - 1];
    const meio = trecho.slice(0, -1);
    const u = new URL("https://www.google.com/maps/dir/");
    u.searchParams.set("api", "1");
    if (inicio) u.searchParams.set("origin", inicio);
    u.searchParams.set("destination", destino);
    if (meio.length) u.searchParams.set("waypoints", meio.join("|"));
    u.searchParams.set("travelmode", "driving");
    links.push(u.toString());
    inicio = destino;
  }
  return links;
}

export function enderecoTexto(e: Endereco) {
  return `${e.logradouro}, ${e.numero} - ${e.bairro}, ${e.cidade} - ${e.uf}, ${e.cep}`;
}

export function formatarDistancia(m: number | null) {
  if (m == null) return "—";
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}
export function formatarDuracao(s: number | null) {
  if (s == null) return "—";
  const min = Math.round(s / 60);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
}

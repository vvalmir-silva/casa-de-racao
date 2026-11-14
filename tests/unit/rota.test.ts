import { describe, it, expect } from "vitest";
import { haversine, ordemHeuristica, distanciaCircuito } from "@/lib/rota";
import { linksMaps, formatarDistancia, formatarDuracao } from "@/lib/rota-cliente";

const loja = { lat: -23.5115, lng: -46.6052 }; // Vila Guilherme (aprox.)

function permutacoes(n: number): number[][] {
  if (n === 1) return [[0]];
  return permutacoes(n - 1).flatMap((p) => Array.from({ length: n }, (_, i) => [...p.slice(0, i), n - 1, ...p.slice(i)]));
}

describe("geometria", () => {
  it("haversine em escala de bairro", () => {
    const d = haversine(loja, { lat: -23.5205, lng: -46.6052 }); // ~1 km ao sul
    expect(d).toBeGreaterThan(950);
    expect(d).toBeLessThan(1050);
  });
});

describe("ordem heurística", () => {
  it("visita pontos em linha na ordem natural", () => {
    const pts = [0.03, 0.01, 0.04, 0.02].map((k) => ({ lat: loja.lat - k, lng: loja.lng }));
    expect(ordemHeuristica(loja, pts)).toEqual([1, 3, 0, 2]);
  });

  it("fica a no máximo 10% do ótimo em 7 paradas aleatórias", () => {
    let seed = 42;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let caso = 0; caso < 20; caso++) {
      const pts = Array.from({ length: 7 }, () => ({ lat: loja.lat + (rnd() - 0.5) * 0.08, lng: loja.lng + (rnd() - 0.5) * 0.08 }));
      const otimo = Math.min(...permutacoes(7).map((o) => distanciaCircuito(loja, pts, o)));
      const h = distanciaCircuito(loja, pts, ordemHeuristica(loja, pts));
      expect(h).toBeLessThanOrEqual(otimo * 1.1);
    }
  });

  it("casos pequenos", () => {
    expect(ordemHeuristica(loja, [])).toEqual([]);
    expect(ordemHeuristica(loja, [loja])).toEqual([0]);
  });
});

describe("links do Maps", () => {
  it("quebra em trechos de 9 paradas, emendando o fim de um no início do próximo", () => {
    const ends = Array.from({ length: 20 }, (_, i) => `Rua ${i + 1}`);
    const l = linksMaps("Loja", ends);
    expect(l).toHaveLength(3);
    const u2 = new URL(l[1]);
    expect(u2.searchParams.get("origin")).toBe("Rua 9");
    expect(u2.searchParams.get("destination")).toBe("Rua 18");
    expect(u2.searchParams.get("waypoints")?.split("|")).toHaveLength(8);
  });
  it("formata distância e tempo", () => {
    expect(formatarDistancia(850)).toBe("850 m");
    expect(formatarDistancia(12345)).toBe("12,3 km");
    expect(formatarDuracao(45 * 60)).toBe("45 min");
    expect(formatarDuracao(95 * 60)).toBe("1h35");
  });
});

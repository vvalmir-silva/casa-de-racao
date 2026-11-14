import { describe, it, expect } from "vitest";
import { consumoDiarioG, duracaoDias, indicados, type Pet, type ProdutoPet } from "@/lib/pets";

const cao = (o: Partial<Pet> = {}): Pet => ({ id: "1", nome: "Thor", especie: "cao", fase: "adulto", peso_kg: 20, castrado: false, ...o });
const prod = (nome: string, especie = "cao", peso = 15): ProdutoPet => ({ id: nome, nome, descricao: null, especie, categoria_slug: especie === "cao" ? "racao-caes" : "racao-gatos", peso_kg: peso, estoque: 5 });

describe("consumo do pet", () => {
  it("cão de 20 kg come ~340 g por dia; gato de 4 kg ~70 g", () => {
    expect(consumoDiarioG(cao())).toBeGreaterThan(300);
    expect(consumoDiarioG(cao())).toBeLessThan(380);
    const g = consumoDiarioG({ especie: "gato", peso_kg: 4, fase: "adulto", castrado: false })!;
    expect(g).toBeGreaterThan(55); expect(g).toBeLessThan(85);
  });
  it("filhote come mais, castrado e sênior menos; sem peso não estima", () => {
    expect(consumoDiarioG(cao({ fase: "filhote" }))!).toBeGreaterThan(consumoDiarioG(cao())!);
    expect(consumoDiarioG(cao({ castrado: true }))!).toBeLessThan(consumoDiarioG(cao())!);
    expect(consumoDiarioG(cao({ peso_kg: null }))).toBeNull();
    expect(consumoDiarioG({ especie: "ave", peso_kg: 0.1, fase: "adulto", castrado: false })).toBeNull();
  });
  it("saco de 15 kg dura ~44 dias para um cão de 20 kg e soma vários pets", () => {
    const um = duracaoDias(15, [cao()])!;
    expect(um).toBeGreaterThan(38); expect(um).toBeLessThan(50);
    expect(duracaoDias(15, [cao(), cao()])).toBe(Math.floor(15000 / (2 * consumoDiarioG(cao())!)));
  });
});

describe("ração indicada", () => {
  const lista = [prod("Ração Cães Filhotes 10 kg", "cao", 10), prod("Ração Premium Cães Adultos 15 kg"), prod("Ração Gatos Castrados 10 kg", "gato", 10), prod("Ração Cães Raças Pequenas 3 kg", "cao", 3)];
  it("adulto grande não recebe filhote nem raça pequena; nunca outra espécie", () => {
    const r = indicados(lista, cao({ peso_kg: 30 })).map((p) => p.nome);
    expect(r[0]).toBe("Ração Premium Cães Adultos 15 kg");
    expect(r).not.toContain("Ração Cães Filhotes 10 kg");
    expect(r).not.toContain("Ração Gatos Castrados 10 kg");
    expect(r).not.toContain("Ração Cães Raças Pequenas 3 kg");
  });
  it("filhote recebe ração de filhote primeiro; gato castrado recebe castrado", () => {
    expect(indicados(lista, cao({ fase: "filhote", peso_kg: 8 }))[0].nome).toBe("Ração Cães Filhotes 10 kg");
    expect(indicados(lista, cao({ especie: "gato", peso_kg: 4, castrado: true }))[0].nome).toBe("Ração Gatos Castrados 10 kg");
  });
});

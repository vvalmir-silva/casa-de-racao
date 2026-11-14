import { describe, expect, it } from "vitest";
import { analisar, dinheiro, lerCsv } from "@/lib/planilha";

const cats = [{ id: 1, nome: "Ração para Cães", slug: "racao-caes" }, { id: 2, nome: "Ração para Gatos", slug: "racao-gatos" }];
const exist = [{ id: "a", slug: "racao-caes-3kg", nome: "Ração Cães 3 kg", estoque: 5 }];

describe("planilha", () => {
  it("lê CSV do Excel BR (; e aspas)", () => {
    expect(lerCsv('nome;preco\r\n"Ração ""top"" 1kg";79,90\r\n;\r\n')).toEqual([["nome", "preco"], ['Ração "top" 1kg', "79,90"]]);
    expect(lerCsv("nome,preco\nA,10.5\n")).toEqual([["nome", "preco"], ["A", "10.5"]]);
  });
  it("entende preços em vários formatos", () => {
    expect(dinheiro("R$ 1.234,56")).toBe(123456);
    expect(dinheiro("79,9")).toBe(7990);
    expect(dinheiro("79.90")).toBe(7990);
    expect(dinheiro("1.000")).toBe(100000);
    expect(dinheiro("")).toBeNull();
    expect(dinheiro("abc")).toBeNaN();
  });
  it("classifica novo, atualizar e erro", () => {
    const { linhas } = analisar([
      ["Nome", "Categoria", "Preço", "Estoque", "Preço de"],
      ["Ração Gatos 1 kg", "gatos", "29,90", "10", "35,00"],
      ["Ração Cães 3 kg", "", "", "8", ""],
      ["Petisco X", "Petiscos", "9,90", "", ""],
      ["Sem preço", "Cães", "", "", ""],
    ], cats, exist);
    expect(linhas.map((l) => l.acao)).toEqual(["novo", "atualizar", "erro", "erro"]);
    expect(linhas[0].dados).toMatchObject({ categoria_id: 2, preco: 2990, preco_de: 3500, estoque: 10 });
    expect(linhas[1].avisos).toContain("estoque 5 → 8");
    expect(linhas[2].erros[0]).toMatch(/categoria “Petiscos” não existe/);
    expect(linhas[3].erros).toContain("sem preço");
  });
  it("exige a coluna nome", () => {
    expect(analisar([["produto_x"], ["a"]], cats, []).erroGeral).toMatch(/nome/);
  });
});

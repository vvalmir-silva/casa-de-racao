import { describe, it, expect } from "vitest";
import { proximaDataEntrega, taxaPesoExtra, partesLocais, somarDias, diaSemanaDe } from "@/lib/frete";

// Sexta, 13/11/2026 — horários de São Paulo (UTC-3)
const sexta10h = new Date("2026-11-13T13:00:00Z");
const sexta16h = new Date("2026-11-13T19:00:00Z");
const sabado23h = new Date("2026-11-15T02:00:00Z"); // ainda sábado 14/11 no fuso da loja

describe("datas no fuso da loja", () => {
  it("converte para America/Sao_Paulo", () => {
    expect(partesLocais(sexta10h)).toMatchObject({ data: "2026-11-13", hora: "10:00", diaSemana: 5 });
    expect(partesLocais(sabado23h)).toMatchObject({ data: "2026-11-14", diaSemana: 6 });
  });
  it("soma dias e calcula dia da semana", () => {
    expect(somarDias("2026-11-30", 1)).toBe("2026-12-01");
    expect(diaSemanaDe("2026-11-16")).toBe(1);
  });
});

describe("próxima data de entrega", () => {
  const segASab = [1, 2, 3, 4, 5, 6];
  it("hoje, se for dia da zona e antes do corte", () => {
    expect(proximaDataEntrega(segASab, "15:00", sexta10h)).toBe("2026-11-13");
  });
  it("amanhã, se passou do corte", () => {
    expect(proximaDataEntrega(segASab, "15:00", sexta16h)).toBe("2026-11-14");
  });
  it("pula para o próximo dia da zona", () => {
    expect(proximaDataEntrega([1, 3, 5], "15:00", sexta16h)).toBe("2026-11-16");
    expect(proximaDataEntrega([2, 4], "15:00", sexta10h)).toBe("2026-11-17");
  });
  it("aceita corte com segundos (formato do Postgres)", () => {
    expect(proximaDataEntrega(segASab, "15:00:00", sexta10h)).toBe("2026-11-13");
  });
});

describe("adicional por peso", () => {
  const cfg = { peso_extra_limite_kg: "30", peso_extra_bloco_kg: "15", peso_extra_taxa_centavos: "500" };
  it("sem adicional até o limite", () => {
    expect(taxaPesoExtra(15, cfg)).toBe(0);
    expect(taxaPesoExtra(30, cfg)).toBe(0);
  });
  it("cobra por bloco iniciado acima do limite", () => {
    expect(taxaPesoExtra(31, cfg)).toBe(500);
    expect(taxaPesoExtra(45, cfg)).toBe(500);
    expect(taxaPesoExtra(46, cfg)).toBe(1000);
  });
});

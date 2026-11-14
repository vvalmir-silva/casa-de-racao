import { test, expect } from "@playwright/test";
import { entrar, ADMIN } from "./helpers";

test.describe("busca de CEP no endereço de entrega", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/cep?cep=01310100", (r) => r.fulfill({ json: { cep: "01310100", logradouro: "Avenida Paulista", bairro: "Bela Vista", cidade: "São Paulo", uf: "SP" } }));
    await page.route("**/api/cep?cep=13560000", (r) => r.fulfill({ json: { cep: "13560000", logradouro: "", bairro: "", cidade: "São Carlos", uf: "SP" } }));
    await page.route("**/api/cep?cep=00000000", (r) => r.fulfill({ status: 404, json: { erro: "CEP não encontrado." } }));
    await page.route("**/api/cep?cep=11111111", (r) => r.fulfill({ status: 502, json: { erro: "Não foi possível buscar o CEP agora." } }));
    await entrar(page, ADMIN);
    await page.goto("/conta");
    await page.getByRole("button", { name: "+ Novo endereço" }).click();
  });

  test("preenche rua, bairro, cidade e UF e leva ao número", async ({ page }) => {
    await page.getByLabel("CEP").fill("01310100");
    await expect(page.getByLabel("Rua")).toHaveValue("Avenida Paulista");
    await expect(page.getByLabel("Bairro")).toHaveValue("Bela Vista");
    await expect(page.getByLabel("Cidade")).toHaveValue("São Paulo");
    await expect(page.getByLabel("UF")).toHaveValue("SP");
    await expect(page.getByLabel("CEP")).toHaveValue("01310-100");
    await expect(page.getByLabel("Número")).toBeFocused();
    await expect(page.getByText(/✓ Avenida Paulista, Bela Vista/)).toBeVisible();
  });

  test("CEP geral da cidade pede rua e bairro", async ({ page }) => {
    await page.getByLabel("CEP").fill("13560000");
    await expect(page.getByLabel("Cidade")).toHaveValue("São Carlos");
    await expect(page.getByText("CEP geral da cidade: preencha rua e bairro.")).toBeVisible();
    await expect(page.getByLabel("Rua")).toBeFocused();
  });

  test("CEP inexistente e serviço fora do ar avisam sem travar o formulário", async ({ page }) => {
    await page.getByLabel("CEP").fill("00000000");
    await expect(page.getByText(/CEP não encontrado/)).toBeVisible();
    await page.getByLabel("CEP").fill("11111111");
    await expect(page.getByText(/Não deu para buscar o CEP agora/)).toBeVisible();
    await expect(page.getByLabel("Rua")).toBeEditable();
  });
});

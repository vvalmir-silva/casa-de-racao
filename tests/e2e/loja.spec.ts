import { test, expect } from "@playwright/test";
import { semErroNemOverflow } from "./helpers";

test("home lista produtos e filtra por categoria", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Ração na porta, no dia certo." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mais pedidos no bairro" })).toBeVisible();
  await page.getByRole("navigation", { name: "Categorias" }).getByRole("link", { name: "Gatos" }).click();
  await expect(page).toHaveURL(/cat=racao-gatos/);
  await expect(page.getByRole("article")).toHaveCount(3);
  await semErroNemOverflow(page);
});

test("busca sem resultado mostra caminho de volta", async ({ page }) => {
  await page.goto("/?q=xyzinexistente");
  await expect(page.getByText("Nada encontrado")).toBeVisible();
  await page.getByRole("link", { name: "Ver todos os produtos" }).click();
  await expect(page.getByRole("article").first()).toBeVisible();
});

test("endereço de entrega pelo chip do topo", async ({ page }) => {
  await page.route("**/api/cep?cep=02225010", (r) => r.fulfill({ json: { cep: "02225010", logradouro: "Rua X", bairro: "Vila Guilherme", cidade: "São Paulo", uf: "SP" } }));
  await page.goto("/");
  await page.getByRole("button", { name: /Informe seu CEP/ }).click();
  const folha = page.getByRole("dialog", { name: "Endereço de entrega" });
  await folha.getByLabel("CEP").fill("02225010");
  await folha.getByRole("button", { name: "Consultar" }).click();
  await expect(folha.getByText("Entregamos na Vila Guilherme!")).toBeVisible();
  await folha.getByRole("button", { name: "Continuar comprando" }).click();
  await expect(page.getByRole("button", { name: /Vila Guilherme/ })).toBeVisible();
  await page.getByRole("button", { name: /Vila Guilherme/ }).click();
  await folha.getByLabel("CEP").fill("99999999");
  await folha.getByRole("button", { name: "Consultar" }).click();
  await expect(folha.getByText("Ainda não entregamos nesse CEP")).toBeVisible();
});

test("botão + vira contador e a barra do carrinho aparece", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Adicionar Alpiste 1 kg" }).first().click();
  await expect(page.getByRole("button", { name: "Pôr mais um" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Pôr mais um" }).first().click();
  await expect(page.getByRole("link", { name: /Ver carrinho/ })).toContainText("R$ 25,80");
});

test("produto → carrinho → alterar quantidade", async ({ page }) => {
  await page.goto("/produto/racao-premium-caes-adultos-15kg");
  await expect(page.getByRole("heading", { name: "Ração Premium Cães Adultos 15 kg" })).toBeVisible();
  await page.getByRole("button", { name: "Adicionar · R$ 179,90" }).locator("visible=true").click();
  await page.getByRole("link", { name: /Ver carrinho/ }).locator("visible=true").click();
  await expect(page).toHaveURL(/\/carrinho/);
  await page.getByRole("button", { name: "Pôr mais um" }).click();
  await expect(page.getByText("R$ 359,80").first()).toBeVisible();
  await expect(page.getByText("Frete grátis na rota do bairro")).toBeVisible();
  await semErroNemOverflow(page);
});

test("app instalável: manifest e service worker", async ({ request }) => {
  const m = await (await request.get("/manifest.webmanifest")).json();
  expect(m.name).toBe("Casa de Ração");
  expect(m.icons.length).toBeGreaterThanOrEqual(2);
  expect((await request.get("/sw.js")).ok()).toBe(true);
  expect((await request.get("/offline")).ok()).toBe(true);
});

test("busca sem acento e com erro de digitação, com sugestões", async ({ page }) => {
  await page.goto("/");
  const campo = page.getByRole("combobox", { name: "Buscar" });
  await campo.fill("racao p/ cachorro filhote");
  const sugestoes = page.getByRole("listbox", { name: "Sugestões" });
  await expect(sugestoes.getByRole("option").first()).toContainText("Ração Cães Filhotes 10 kg");
  await campo.fill("aipiste");
  await expect(sugestoes.getByText("Alpiste 1 kg")).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/produto\/alpiste-1kg/);

  await page.goto("/?q=gato");
  await expect(page.getByRole("article")).toHaveCount(3);
  await semErroNemOverflow(page);
});

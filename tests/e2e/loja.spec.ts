import { test, expect } from "@playwright/test";
import { semErroNemOverflow } from "./helpers";

test("home lista produtos e filtra por categoria", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Ração na sua porta/ })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(11);
  await page.getByRole("link", { name: /Gatos/ }).first().click();
  await expect(page).toHaveURL(/cat=racao-gatos/);
  await expect(page.getByRole("article")).toHaveCount(3);
  await semErroNemOverflow(page);
});

test("busca sem resultado mostra caminho de volta", async ({ page }) => {
  await page.goto("/?q=xyzinexistente");
  await expect(page.getByText("Nada por aqui")).toBeVisible();
  await page.getByRole("link", { name: "Ver tudo" }).click();
  await expect(page.getByRole("article").first()).toBeVisible();
});

test("consulta de CEP no topo", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("CEP").fill("02225010");
  await page.getByRole("button", { name: "Ver entrega" }).click();
  await expect(page.getByText("Entregamos aí.")).toBeVisible();
  await page.getByLabel("CEP").fill("99999999");
  await page.getByRole("button", { name: "Ver entrega" }).click();
  await expect(page.getByText("Ainda não entregamos neste CEP.")).toBeVisible();
});

test("produto → carrinho → alterar quantidade", async ({ page }) => {
  await page.goto("/produto/racao-premium-caes-adultos-15kg");
  await expect(page.getByRole("heading", { name: "Ração Premium Cães Adultos 15 kg" })).toBeVisible();
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await expect(page).toHaveURL(/\/carrinho/);
  await expect(page.getByText("R$ 179,90").first()).toBeVisible();
  await page.getByRole("button", { name: "mais" }).click();
  await expect(page.getByText("R$ 359,80").first()).toBeVisible();
  await expect(page.getByText("Frete grátis")).toBeVisible();
  await semErroNemOverflow(page);
});

test("app instalável: manifest e service worker", async ({ request }) => {
  const m = await (await request.get("/manifest.webmanifest")).json();
  expect(m.name).toBe("Casa de Ração");
  expect(m.icons.length).toBeGreaterThanOrEqual(2);
  expect((await request.get("/sw.js")).ok()).toBe(true);
  expect((await request.get("/offline")).ok()).toBe(true);
});

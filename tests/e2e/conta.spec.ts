import { test, expect } from "@playwright/test";
import { entrar, ADMIN } from "./helpers";

test("login errado mostra mensagem", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Telefone (WhatsApp)").fill("11999999999");
  await page.getByLabel("Senha", { exact: true }).fill("errada");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("Telefone ou senha inválidos.")).toBeVisible();
});

test("esqueci a senha sem WhatsApp configurado orienta a falar com a loja", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Esqueci a senha" }).click();
  await expect(page.getByRole("heading", { name: "Trocar senha" })).toBeVisible();
  await page.getByLabel("Telefone (WhatsApp)").fill("11999999999");
  await page.getByRole("button", { name: "Enviar código" }).click();
  await expect(page.getByText(/Fale com a loja para trocar sua senha/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Chamar a loja no WhatsApp" })).toHaveAttribute("href", /wa\.me/);
});

test("áreas restritas pedem login e papel certo", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin/);
  await page.goto("/motorista");
  await expect(page).toHaveURL(/\/login/);
  await entrar(page, ADMIN);
  await expect(page).toHaveURL(/\/admin/);
});

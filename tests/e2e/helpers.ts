import { expect, type Page } from "@playwright/test";

export const ADMIN = { telefone: "11999999999", senha: "admin123" };
export const MOTORISTA = { telefone: "11988888888", senha: "moto123" };
/** Data longe no futuro: inclui qualquer pedido, independe do horário em que o teste roda. */
export const DATA_ROTA = "2099-12-31";

export async function entrar(page: Page, u: { telefone: string; senha: string }) {
  await page.goto("/login");
  await page.getByLabel("Telefone (WhatsApp)").fill(u.telefone);
  await page.getByLabel("Senha", { exact: true }).fill(u.senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

export async function semErroNemOverflow(page: Page) {
  await expect(page.getByText(/Runtime (Type)?Error|Application error/)).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow, `rolagem horizontal em ${page.url()}`).toBe(false);
}

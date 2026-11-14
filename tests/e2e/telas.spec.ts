import { test } from "@playwright/test";
import { entrar, ADMIN, semErroNemOverflow } from "./helpers";

const publicas = ["/", "/?ofertas=1", "/como-funciona", "/?cat=racao-aves", "/produto/alpiste-1kg", "/login", "/cadastro", "/recuperar", "/carrinho", "/offline"];
const admin = ["/admin", "/admin/pedidos", "/admin/rotas", "/admin/produtos", "/admin/produtos?editar=novo", "/admin/relatorios",
  "/admin/entregas", "/admin/cupons", "/admin/avaliacoes", "/admin/etiquetas", "/carrinho", "/admin/cupons?editar=novo", "/admin/usuarios", "/admin/notificacoes", "/admin/config", "/conta", "/conta/assinaturas", "/motorista"];

test("páginas públicas abrem sem erro e sem rolagem lateral", async ({ page }) => {
  for (const u of publicas) { await page.goto(u); await semErroNemOverflow(page); }
});

test("páginas do painel abrem sem erro e sem rolagem lateral", async ({ page }) => {
  await entrar(page, ADMIN);
  for (const u of admin) { await page.goto(u); await semErroNemOverflow(page); }
});

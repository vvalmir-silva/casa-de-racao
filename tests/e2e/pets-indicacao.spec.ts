import { test, expect } from "@playwright/test";
import { Client } from "pg";
import { entrar } from "./helpers";

test.describe.configure({ mode: "serial" });
const URL_DB = process.env.E2E_DATABASE_URL ?? "postgresql://cr@localhost:5433/cr_e2e?host=/tmp";
const sufixo = String(Date.now()).slice(-7);
const ana = { nome: "Ana Indica", telefone: `1150${sufixo}`, senha: "segredo1" };
const bia = { nome: "Bia Amiga", telefone: `1151${sufixo}`, senha: "segredo1" };

async function db<T = Record<string, unknown>>(q: string, p: unknown[] = []) {
  const c = new Client({ connectionString: URL_DB });
  await c.connect();
  try { return (await c.query(q, p)).rows as T[]; } finally { await c.end(); }
}

async function cadastrar(page: import("@playwright/test").Page, u: typeof ana) {
  await page.getByLabel("Nome").fill(u.nome);
  await page.getByLabel("Telefone (WhatsApp)").fill(u.telefone);
  await page.getByLabel("Senha").fill(u.senha);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL("/");
}

test("perfil do pet: cadastra, vê ração indicada e quanto o saco dura", async ({ page }) => {
  await page.goto("/cadastro");
  await cadastrar(page, ana);
  await expect(page.getByRole("link", { name: /Cadastre seu pet/ })).toBeVisible();
  await page.goto("/conta/pets");
  await page.getByLabel("Nome").fill("Thor");
  await page.getByText("Cachorro", { exact: true }).click();
  await page.getByLabel("Idade").selectOption("adulto");
  await page.getByLabel("Peso (kg)").fill("20");
  await expect(page.getByText(/Come cerca de \d+ g de ração seca por dia/)).toBeVisible();
  await page.getByRole("button", { name: "Adicionar pet" }).click();
  await expect(page.getByText("Thor", { exact: true })).toBeVisible();
  const ind = page.locator("section", { has: page.getByRole("heading", { name: "Indicados para Thor" }) });
  await expect(ind.getByText("Ração Premium Cães Adultos 15 kg")).toBeVisible();
  await expect(ind.getByText("Ração Cães Filhotes 10 kg")).toHaveCount(0);
  await expect(ind.getByText(/Dura ~\d+ dias para Thor/).first()).toBeVisible();

  // produto: duração para o Thor e aviso quando não é a ração indicada
  await page.goto("/produto/racao-premium-caes-adultos-15kg");
  await expect(page.getByText(/^~\d+ dias$/)).toBeVisible();
  await expect(page.getByText("para Thor")).toBeVisible();
  await page.goto("/produto/racao-caes-filhotes-10kg");
  await expect(page.getByTestId("aviso-pet")).toContainText("Thor");

  // home mostra carrossel do pet
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Para Thor" })).toBeVisible();

  // editar e remover
  await page.goto("/conta/pets");
  await page.getByRole("button", { name: "Editar" }).click();
  await page.getByLabel("Castrado(a)").first().check();
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText(/castrado\(a\)/)).toBeVisible();
  const [p] = await db<{ castrado: boolean }>("SELECT castrado FROM pets WHERE nome = 'Thor' AND usuario_id = (SELECT id FROM usuarios WHERE telefone = $1)", [ana.telefone]);
  expect(p.castrado).toBe(true);
});

test("lembrete de recompra usa o consumo do pet", async ({ request }) => {
  const [u] = await db<{ id: string }>("SELECT id FROM usuarios WHERE telefone = $1", [ana.telefone]);
  const [prod] = await db<{ id: string; nome: string; preco_centavos: number }>("SELECT id, nome, preco_centavos FROM produtos WHERE slug = 'racao-premium-caes-adultos-15kg'");
  const [dias] = await db<{ d: number }>("SELECT floor(15000 / consumo_pet_g('cao', 20, 'adulto', true))::int AS d");
  // saco entregue há (duração do Thor − 2) dias: hora de lembrar (padrão do produto seria outro prazo)
  const [ped] = await db<{ id: string }>(`INSERT INTO pedidos (cliente_id, tipo_entrega, forma_pagamento, status, subtotal_centavos, frete_centavos, total_centavos, entregue_em, criado_em)
    VALUES ($1, 'retirada', 'pix', 'entregue', $2, 0, $2, now() - make_interval(days => $3), now() - make_interval(days => $3 + 1)) RETURNING id`, [u.id, prod.preco_centavos, dias.d - 2]);
  await db("INSERT INTO pedido_itens (pedido_id, produto_id, nome, qtd, preco_centavos) VALUES ($1, $2, $3, 1, $4)", [ped.id, prod.id, prod.nome, prod.preco_centavos]);
  await db("UPDATE produtos SET duracao_dias = 200 WHERE id = $1", [prod.id]);
  try {
    expect((await request.get("/api/cron/recompra", { headers: { authorization: "Bearer e2e" } })).ok()).toBeTruthy();
    const n = await db<{ mensagem: string }>("SELECT mensagem FROM notificacoes WHERE tipo = 'recompra' AND usuario_id = $1", [u.id]);
    expect(n).toHaveLength(1);
    expect(n[0].mensagem).toContain("do(a) Thor");
  } finally {
    await db("UPDATE produtos SET duracao_dias = 30 WHERE id = $1", [prod.id]);
    await db("DELETE FROM pedido_itens WHERE pedido_id = $1", [ped.id]);
    await db("DELETE FROM pedidos WHERE id = $1", [ped.id]);
  }
});

test("indique e ganhe: amigo ganha desconto, quem indicou ganha ao entregar", async ({ page, browser }) => {
  await entrar(page, ana);
  await page.goto("/conta/indique");
  const link = await page.getByLabel("Seu link").inputValue();
  const caminho = new URL(link).pathname;
  expect(caminho).toMatch(/^\/i\/ANA[A-Z0-9]{3}$/);

  // amiga abre o link em outro aparelho, passeia e depois cria a conta
  const ctx = await browser.newContext();
  const amiga = await ctx.newPage();
  await amiga.goto(new URL(caminho, page.url()).toString());
  await expect(amiga).toHaveURL(/\/cadastro\?ind=ANA/);
  await amiga.goto("/");
  await amiga.goto("/cadastro");
  await expect(amiga.getByTestId("convite")).toContainText("Ana te deu R$");
  await cadastrar(amiga, bia);

  // cupom entra sozinho no checkout
  await amiga.goto("/produto/racao-premium-caes-adultos-15kg");
  await amiga.getByRole("button", { name: /^Adicionar · / }).locator("visible=true").click();
  await amiga.goto("/checkout");
  await expect(amiga.getByText(/🎟️ AMIGO[A-Z0-9]{5} · Presente de Ana/)).toBeVisible();
  await expect(amiga.getByText("Desconto", { exact: true })).toBeVisible();

  // cupom pessoal não serve para outra conta
  const [cupom] = await db<{ codigo: string }>("SELECT codigo FROM cupons WHERE usuario_id = (SELECT id FROM usuarios WHERE telefone = $1)", [bia.telefone]);
  const outra = await page.request.get(`/api/cupom?codigo=${cupom.codigo}&subtotal=20000&frete=0`);
  expect(outra.status()).toBe(400);

  await amiga.getByText("Retirar na loja").first().click();
  await amiga.getByRole("button", { name: "Confirmar pedido" }).last().click();
  await expect(amiga).toHaveURL(/\/conta\/pedido\//);
  await ctx.close();
  const [ped] = await db<{ id: string; desconto_centavos: number; cupom_codigo: string }>("SELECT id, desconto_centavos, cupom_codigo FROM pedidos WHERE cliente_id = (SELECT id FROM usuarios WHERE telefone = $1)", [bia.telefone]);
  expect(ped.cupom_codigo).toBe(cupom.codigo);
  expect(ped.desconto_centavos).toBe(1000);

  // loja marca entregue → Ana ganha o prêmio (uma vez só)
  await db("UPDATE pedidos SET status = 'separado' WHERE id = $1", [ped.id]);
  const { ADMIN } = await import("./helpers");
  await entrar(page, ADMIN);
  const [{ numero }] = await db<{ numero: number }>("SELECT numero FROM pedidos WHERE id = $1", [ped.id]);
  await page.goto(`/admin/pedidos?q=${numero}`);
  await page.getByRole("button", { name: "Entregue / retirado" }).first().click();
  await expect.poll(async () => (await db<{ status: string }>("SELECT status FROM indicacoes WHERE indicado_id = (SELECT id FROM usuarios WHERE telefone = $1)", [bia.telefone]))[0]?.status, { timeout: 10000 }).toBe("premiado");

  await page.goto("/admin/cupons");
  await expect(page.getByTestId("indicacoes")).toContainText("premiado");
  await entrar(page, ana);
  await page.goto("/conta/indique");
  await expect(page.getByText(/✓ você ganhou R\$/)).toBeVisible();
  await expect(page.getByTestId("meus-cupons")).toContainText(/PREMIO[A-Z0-9]{5}/);
  const msgs = await db("SELECT 1 FROM notificacoes WHERE tipo = 'indicacao_premio' AND usuario_id = (SELECT id FROM usuarios WHERE telefone = $1)", [ana.telefone]);
  expect(msgs).toHaveLength(1);
});

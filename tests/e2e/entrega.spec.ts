import { test, expect, type Page } from "@playwright/test";
import { Client } from "pg";
import { ADMIN, DATA_ROTA, entrar } from "./helpers";

test.describe.configure({ mode: "serial" });
const URL_DB = process.env.E2E_DATABASE_URL ?? "postgresql://cr@localhost:5433/cr_e2e?host=/tmp";
const cli = { nome: "Duda Entrega", telefone: `116${String(Date.now()).slice(-8)}`, senha: "segredo1" };
let pedidoId = "", numero = 0;

async function db<T = Record<string, unknown>>(q: string, p: unknown[] = []) {
  const c = new Client({ connectionString: URL_DB });
  await c.connect();
  try { return (await c.query(q, p)).rows as T[]; } finally { await c.end(); }
}

/** Monta rota em DATA_ROTA só com o pedido do teste. */
async function montarRota(page: Page) {
  await page.goto(`/admin/rotas?data=${DATA_ROTA}`);
  const form = page.locator("form", { has: page.getByRole("button", { name: "Criar rota com selecionados" }) });
  for (const box of await form.getByRole("checkbox").all()) {
    const label = await box.locator("xpath=..").innerText();
    if (label.includes(`#${numero} `)) await box.check(); else await box.uncheck();
  }
  await form.getByRole("button", { name: "Criar rota com selecionados" }).click();
  await expect(page.getByText(`#${numero}`).first()).toBeVisible();
}

async function linkConfirmacao() {
  let rows: { mensagem: string }[] = [];
  for (let i = 0; i < 20 && rows.length === 0; i++) {
    rows = await db<{ mensagem: string }>("SELECT mensagem FROM notificacoes WHERE tipo = 'confirmacao_entrega' AND pedido_id = $1 ORDER BY criado_em DESC", [pedidoId]);
    if (!rows.length) await new Promise((r) => setTimeout(r, 300));
  }
  expect(rows.length, "WhatsApp de confirmação enviado").toBeGreaterThan(0);
  const url = rows[0].mensagem.match(/https?:\/\/\S+/)![0];
  return new URL(url).pathname + new URL(url).search;
}

// não deixa a rota deste arquivo na data usada pelos outros testes de rota
test.afterAll(async () => {
  if (pedidoId) await db("UPDATE rotas SET data = '2099-12-30' WHERE id IN (SELECT rota_id FROM pedidos WHERE id = $1) OR (data = $2 AND NOT EXISTS (SELECT 1 FROM pedidos p WHERE p.rota_id = rotas.id))", [pedidoId, DATA_ROTA]);
});

test("troco tem limite e o pedido em dinheiro registra o valor", async ({ page }) => {
  await page.goto("/cadastro");
  await page.getByLabel("Nome").fill(cli.nome);
  await page.getByLabel("Telefone (WhatsApp)").fill(cli.telefone);
  await page.getByLabel("Senha").fill(cli.senha);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/produto/alpiste-1kg");
  await page.getByRole("button", { name: /^Adicionar · / }).locator("visible=true").click();
  await page.goto("/checkout");
  await page.route("**/api/cep?cep=02225020", (r) =>
    r.fulfill({ json: { cep: "02225020", logradouro: "Rua do Troco", bairro: "Vila Guilherme", cidade: "São Paulo", uf: "SP" } }));
  await page.getByLabel("CEP", { exact: true }).fill("02225-020");
  await page.getByLabel("Número", { exact: true }).fill("15");
  await page.getByLabel("É casa, sem complemento").check();
  await page.getByText(/^Entrega (hoje|amanhã|.+), 18:00–21:00$/).first().click();
  await page.getByRole("radiogroup", { name: "Forma de pagamento" }).getByText("Dinheiro na entrega").click();
  await expect(page.getByText(/O entregador leva até R\$\s?100,00 de troco/)).toBeVisible();
  await page.getByLabel(/Troco para/).fill("1000");
  await page.getByRole("button", { name: "Confirmar pedido" }).last().click();
  await expect(page.getByText(/leva no máximo R\$\s?100,00 de troco/).first()).toBeVisible();
  await expect(page).toHaveURL(/\/checkout/);

  await page.getByLabel(/Troco para/).fill("100");
  await expect(page.getByText(/Troco: R\$/)).toBeVisible();
  await page.getByRole("button", { name: "Confirmar pedido" }).last().click();
  await expect(page).toHaveURL(/\/conta\/pedido\//);
  const [p] = await db<{ id: string; numero: number; troco_para_centavos: number }>(
    "SELECT id, numero, troco_para_centavos FROM pedidos WHERE cliente_id = (SELECT id FROM usuarios WHERE telefone = $1)", [cli.telefone]);
  expect(p.troco_para_centavos).toBe(10000);
  pedidoId = p.id; numero = p.numero;
  // pedido em dinheiro já entra confirmado; garante data dentro da rota de teste
  await db("UPDATE pedidos SET status = 'pago' WHERE id = $1 AND status = 'aguardando_pagamento'", [pedidoId]);
});

test("cliente confirma presença pelo link; 'não vou estar' tira da rota", async ({ page, browser }) => {
  await entrar(page, ADMIN);
  await montarRota(page);
  const link = await linkConfirmacao();

  // cliente abre o link sem login
  const ctx = await browser.newContext();
  const cliPage = await ctx.newPage();
  await cliPage.goto(new URL(link, page.url()).toString());
  await expect(cliPage.getByRole("heading", { name: /Vai ter alguém para receber/ })).toBeVisible();
  await cliPage.getByRole("button", { name: "Sim, vou estar" }).click();
  await expect(cliPage.getByText("✓ Confirmado! Obrigado.")).toBeVisible();

  // link adulterado não funciona
  await cliPage.goto(new URL(link.replace(/t=[^&]+/, "t=xxxxxxxxxxxxxxxxxxxxxx"), page.url()).toString());
  await expect(cliPage.getByRole("heading", { name: "Link inválido" })).toBeVisible();

  await page.goto(`/admin/rotas?data=${DATA_ROTA}`);
  const item = page.locator("li", { hasText: `#${numero}` }).first();
  await expect(item.getByText("✓ confirmou")).toBeVisible();
  await expect(item.getByText(/💵 R\$/)).toBeVisible();

  // mudou de ideia → volta para "prontos para rota" com aviso
  await cliPage.goto(new URL(link, page.url()).toString());
  await cliPage.getByRole("button", { name: /Não vou estar/ }).click();
  await expect(cliPage.getByText(/Seu pedido saiu da rota/)).toBeVisible();
  await ctx.close();
  await page.reload();
  await expect(page.locator("label", { hasText: `#${numero} ` }).getByText(/disse que não vai estar/)).toBeVisible();

  // nova rota zera a resposta e pergunta de novo
  await montarRota(page);
  const [p] = await db<{ confirmacao: string | null }>("SELECT confirmacao FROM pedidos WHERE id = $1", [pedidoId]);
  expect(p.confirmacao).toBeNull();
});

test("acerto de caixa: loja confere o dinheiro do motorista", async ({ page }) => {
  await db("UPDATE pedidos SET status = 'entregue', entregue_em = now() WHERE id = $1", [pedidoId]);
  await entrar(page, ADMIN);
  await page.goto(`/admin/rotas?data=${DATA_ROTA}`);
  const sec = page.locator("section", { hasText: `#${numero}` }).filter({ has: page.getByTestId("acerto") }).first();
  const ac = sec.getByTestId("acerto");
  await expect(ac.getByText("a conferir")).toBeVisible();
  const [{ total }] = await db<{ total: number }>("SELECT total_centavos AS total FROM pedidos WHERE id = $1", [pedidoId]);
  await ac.getByLabel("Dinheiro recebido (R$)").fill(((total - 500) / 100).toFixed(2).replace(".", ","));
  await ac.getByLabel("Cartão (comprovantes, R$)").fill("0");
  await ac.getByLabel(/Observação/).fill("");
  await ac.getByRole("button", { name: "Conferir" }).click();
  await expect(page.getByText("Há diferença no caixa. Escreva uma observação explicando.")).toBeVisible();
  await ac.getByLabel(/Observação/).fill("faltou R$ 5, motorista repõe amanhã");
  await ac.getByRole("button", { name: "Conferir" }).click();
  await expect(ac.getByText(/diferença de -R\$\s?5,00/)).toBeVisible();
  const [a] = await db<{ recebido_dinheiro: number; esperado_dinheiro: number }>("SELECT recebido_dinheiro, esperado_dinheiro FROM acertos_caixa WHERE rota_id = (SELECT rota_id FROM pedidos WHERE id = $1)", [pedidoId]);
  expect(a.esperado_dinheiro - a.recebido_dinheiro).toBe(500);
});

test("relatório mostra custo da entrega, lucro real e pedidos no prejuízo", async ({ page }) => {
  await db("UPDATE configuracoes SET valor = '0' WHERE chave IN ('custo_entrega_centavos','custo_rota_centavos','custo_expresso_centavos')");
  await entrar(page, ADMIN);
  await page.goto("/admin/relatorios?p=7");
  await expect(page.getByTestId("lucro-entrega").getByText(/Informe quanto custa cada entrega/)).toBeVisible();

  const prod = await db<{ id: string; custo_centavos: number | null }>("SELECT id, custo_centavos FROM produtos WHERE slug = 'alpiste-1kg'");
  try {
    await db("UPDATE produtos SET custo_centavos = 500 WHERE slug = 'alpiste-1kg'");
    // salva pela tela de configurações (R$ 90 por entrega → este pedido fica no vermelho)
    await page.goto("/admin/config");
    await page.getByLabel("Custo por entrega (R$)").fill("90");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect.poll(async () => (await db<{ valor: string }>("SELECT valor FROM configuracoes WHERE chave = 'custo_entrega_centavos'"))[0].valor).toBe("9000");

    await page.goto("/admin/relatorios?p=7");
    const box = page.getByTestId("lucro-entrega");
    await expect(box.getByText("Lucro real", { exact: true })).toBeVisible();
    await expect(box.getByRole("link", { name: `#${numero}` })).toBeVisible();
  } finally {
    await db("UPDATE produtos SET custo_centavos = $1 WHERE id = $2", [prod[0].custo_centavos, prod[0].id]);
    await db("UPDATE configuracoes SET valor = '0' WHERE chave = 'custo_entrega_centavos'");
  }
});

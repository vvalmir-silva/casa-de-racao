import { test, expect } from "@playwright/test";
import { Client } from "pg";
import { ADMIN, entrar } from "./helpers";

test.describe.configure({ mode: "serial" });
const URL_DB = process.env.E2E_DATABASE_URL ?? "postgresql://cr@localhost:5433/cr_e2e?host=/tmp";
const cliente = { nome: "Rita Vendas", telefone: `118${String(Date.now()).slice(-8)}`, senha: "segredo1" };

test("carrinho sugere produtos para completar o frete grátis", async ({ page }) => {
  await page.goto("/produto/alpiste-1kg");
  await page.getByRole("button", { name: /^Adicionar · / }).locator("visible=true").click();
  await page.goto("/carrinho");
  await expect(page.getByRole("heading", { name: /Complete e ganhe frete grátis/ })).toBeVisible();
  const sugestoes = page.locator("section", { has: page.getByRole("heading", { name: /Complete e ganhe/ }) }).getByRole("article");
  await expect(sugestoes.first()).toBeVisible();
  await expect(sugestoes.filter({ hasText: "Alpiste 1 kg" })).toHaveCount(0);
});

test("carrinho do cliente logado volta em outro aparelho e gera lembrete", async ({ page, request }) => {
  await page.goto("/cadastro");
  await page.getByLabel("Nome").fill(cliente.nome);
  await page.getByLabel("Telefone (WhatsApp)").fill(cliente.telefone);
  await page.getByLabel("Senha").fill(cliente.senha);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL("/");
  await page.getByRole("button", { name: "Adicionar Ração Gatos Castrados 10 kg" }).first().click();
  await page.waitForTimeout(2500); // salva no servidor 1,5s depois

  // "outro aparelho": sem carrinho local
  await page.evaluate(() => localStorage.removeItem("cr_carrinho_v1"));
  await page.goto("/carrinho");
  await expect(page.locator("main").getByText("Ração Gatos Castrados 10 kg")).toBeVisible();

  // simula 1 dia parado e roda o lembrete diário
  const c = new Client({ connectionString: URL_DB });
  await c.connect();
  await c.query(`UPDATE carrinhos SET atualizado_em = now() - interval '1 day' WHERE usuario_id = (SELECT id FROM usuarios WHERE telefone = $1)`, [cliente.telefone]);
  const r = await request.get("/api/cron/recompra", { headers: { authorization: "Bearer e2e" } });
  expect(r.ok()).toBeTruthy();
  const n = await c.query(`SELECT mensagem FROM notificacoes WHERE tipo = 'carrinho_abandonado' AND telefone = $1`, [cliente.telefone]);
  // segunda execução não repete
  await request.get("/api/cron/recompra", { headers: { authorization: "Bearer e2e" } });
  const n2 = await c.query(`SELECT 1 FROM notificacoes WHERE tipo = 'carrinho_abandonado' AND telefone = $1`, [cliente.telefone]);
  await c.end();
  expect(n.rows).toHaveLength(1);
  expect(n.rows[0].mensagem).toContain("Ração Gatos Castrados 10 kg");
  expect(n2.rows).toHaveLength(1);
});

test("admin importa produtos por planilha com prévia", async ({ page }) => {
  await entrar(page, ADMIN);
  await page.goto("/admin/produtos");
  await page.getByRole("button", { name: "📄 Importar planilha" }).click();
  const csv = [
    "nome;categoria;marca;preco;preco_de;estoque;peso_kg;ativo",
    "Ração Teste Importada 2 kg;Gatos;MarcaX;39,90;49,90;12;2;sim",
    "Alpiste 1 kg;;;;;77;;",
    "Produto Sem Categoria;Inexistente;;10,00;;;;",
  ].join("\r\n");
  await page.getByLabel("Arquivo da planilha").setInputFiles({ name: "produtos.csv", mimeType: "text/csv", buffer: Buffer.from(csv, "utf-8") });
  await expect(page.getByText("1 novos")).toBeVisible();
  await expect(page.getByText("1 para atualizar")).toBeVisible();
  await expect(page.getByText("1 com erro")).toBeVisible();
  await expect(page.getByText(/categoria “Inexistente” não existe/)).toBeVisible();
  await page.getByRole("button", { name: "Importar 2 produtos" }).click();
  await expect(page.getByText(/Pronto! 1 produto novo e 1 atualizado/)).toBeVisible();

  await page.goto("/?q=teste importada");
  const card = page.getByRole("article").filter({ hasText: "Ração Teste Importada 2 kg" });
  await expect(card).toBeVisible();
  await expect(card.getByText("-20%")).toBeVisible();

  const resp = await page.request.get("/admin/produtos/planilha");
  expect(resp.headers()["content-type"]).toContain("text/csv");
  const corpo = await resp.text();
  expect(corpo).toContain("Ração Teste Importada 2 kg");
  expect(corpo).toMatch(/alpiste-1kg;Alpiste 1 kg;Ração para Aves;[^;]*;12,90;;[^;]*;77;/);
});

test("retirada: paga no app ou na loja; entrega: todas as formas", async ({ page }) => {
  await entrar(page, cliente);
  await page.goto("/");
  await page.getByRole("button", { name: /^Adicionar / }).first().click();
  await page.goto("/checkout");
  const formas = page.getByRole("radiogroup", { name: "Forma de pagamento" });

  await page.getByText("Retirar na loja").first().click();
  await expect(formas.getByRole("radio")).toHaveCount(2);
  await expect(formas.getByText("Pagar na loja")).toBeVisible();
  await expect(formas.getByText("Dinheiro na entrega")).toHaveCount(0);

  // endereço novo para ver as opções de entrega
  await page.route("**/api/cep?cep=02225010", (r) =>
    r.fulfill({ json: { cep: "02225010", logradouro: "Rua das Flores", bairro: "Vila Guilherme", cidade: "São Paulo", uf: "SP" } }));
  await page.getByLabel("CEP", { exact: true }).fill("02225-010");
  await page.getByLabel("Número", { exact: true }).fill("200");
  await page.getByLabel("É casa, sem complemento").check();
  await page.getByText(/^Entrega (hoje|amanhã|.+), 18:00–21:00$/).first().click();
  await expect(formas.getByRole("radio")).toHaveCount(3);
  await expect(formas.getByText("Cartão na entrega")).toBeVisible();
  await expect(formas.getByText("Pagar na loja")).toHaveCount(0);

  await page.getByText("Retirar na loja").first().click();
  await formas.getByText("Pagar na loja").click();
  await page.getByRole("button", { name: "Confirmar pedido" }).last().click();
  await expect(page).toHaveURL(/\/conta\/pedido\//);
  await expect(page.getByText("Confirmado", { exact: true })).toBeVisible();
  await expect(page.getByText("Pagar na loja")).toBeVisible();
});

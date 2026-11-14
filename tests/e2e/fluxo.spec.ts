import { test, expect } from "@playwright/test";
import { ADMIN, MOTORISTA, DATA_ROTA, entrar } from "./helpers";

test.describe.configure({ mode: "serial" });

const cliente = { nome: "Maria Teste", telefone: `119${String(Date.now()).slice(-8)}`, senha: "segredo1" };

test("cliente se cadastra e fecha pedido com cupom e entrega em rota", async ({ page }) => {
  await page.goto("/cadastro");
  await page.getByLabel("Nome").fill(cliente.nome);
  await page.getByLabel("Telefone (WhatsApp)").fill(cliente.telefone);
  await page.getByLabel("Senha").fill(cliente.senha);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL("/");

  await page.getByRole("button", { name: "Adicionar Ração Gatos Castrados 10 kg" }).first().click();
  // busca de CEP simulada (o teste não depende de serviço externo)
  await page.route("**/api/cep?cep=02225010", (r) =>
    r.fulfill({ json: { cep: "02225010", logradouro: "Rua das Flores", bairro: "Vila Guilherme", cidade: "São Paulo", uf: "SP" } }));
  await page.goto("/checkout");
  await page.getByLabel("CEP", { exact: true }).fill("02225-010");
  await expect(page.getByLabel("Rua", { exact: true })).toHaveValue("Rua das Flores");
  await expect(page.getByLabel("Número", { exact: true })).toBeFocused();
  await page.getByLabel("Número", { exact: true }).fill("100");

  const rota = page.getByRole("radio").and(page.locator("[name=ent]")).nth(1);
  await expect(page.getByText(/^Entrega (hoje|amanhã|.+), 18:00–21:00$/)).toBeVisible();
  await expect(rota).toBeChecked();

  await page.getByPlaceholder("Cupom").fill("bemvindo10");
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(page.getByText("−R$ 18,99")).toBeVisible();

  await page.getByText("Dinheiro na entrega").click();
  await page.getByRole("button", { name: "Confirmar pedido" }).last().click();
  await expect(page).toHaveURL(/\/conta\/pedido\//);
  await expect(page.getByText("Pedido recebido")).toBeVisible();
  await expect(page.getByText("R$ 170,91")).toBeVisible();
});

test("cupom de primeira compra não vale na segunda", async ({ page }) => {
  await entrar(page, cliente);
  await page.getByRole("button", { name: /^Adicionar / }).first().click();
  await page.goto("/checkout");
  await page.getByPlaceholder("Cupom").fill("BEMVINDO10");
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(page.getByText("Cupom válido apenas na primeira compra.")).toBeVisible();
});

test("loja monta a rota e o motorista entrega", async ({ page }) => {
  await entrar(page, ADMIN);
  await page.goto(`/admin/rotas?data=${DATA_ROTA}`);
  await expect(page.getByText(/Pedidos prontos para rota \(1\)/)).toBeVisible();
  await page.getByRole("button", { name: "Criar rota com selecionados" }).click();
  await expect(page.getByRole("link", { name: "Abrir no Maps" })).toBeVisible();
  await page.locator("select[name=motorista_id]").last().selectOption({ label: "Motorista" });
  await page.getByRole("button", { name: "Atribuir" }).click();

  await entrar(page, MOTORISTA);
  await page.goto(`/motorista?data=${DATA_ROTA}`);
  await page.getByRole("button", { name: "Iniciar rota" }).click();
  await expect(page.getByText("Próxima parada")).toBeVisible();
  await expect(page.getByText(/Receber R\$\s170,91/).first()).toBeVisible();
  await page.getByRole("button", { name: "Entregue", exact: true }).first().click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByLabel("Quem recebeu (opcional)").fill("Porteiro João");
  await dialogo.getByRole("button", { name: "Confirmar entrega" }).click();
  await expect(dialogo).toHaveCount(0);
  await page.getByRole("button", { name: "Concluir rota" }).click();
  await expect(page.getByText(/1 de 1 entregues/)).toBeVisible();

  await entrar(page, cliente);
  await page.goto("/conta");
  await page.getByText(/Pedido #/).first().click();
  await expect(page.getByText("Entregue", { exact: true })).toBeVisible();
  await expect(page.getByText("Porteiro João")).toBeVisible();
});

test("cliente avalia a entrega e a avaliação aparece no painel e na vitrine", async ({ page }) => {
  await entrar(page, cliente);
  await page.goto("/conta");
  await page.getByText(/Pedido #/).first().click();
  await expect(page.getByText("Como foi sua compra?")).toBeVisible();
  const enviar = page.getByRole("button", { name: "Enviar avaliação" });
  await expect(enviar).toBeDisabled();
  await page.getByRole("radio", { name: "5 estrelas" }).click();
  await page.getByLabel("Conte como foi (opcional)").fill("Chegou no horário e o motorista foi muito educado.");
  await enviar.click();
  await expect(page.getByText("Obrigado pela avaliação!")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Sua avaliação")).toBeVisible();
  await expect(page.getByText("Como foi sua compra?")).toHaveCount(0);

  await page.goto("/");
  await expect(page.getByText("Quem compra, recomenda")).toBeVisible();
  await expect(page.getByText(/Chegou no horário/)).toBeVisible();

  await entrar(page, ADMIN);
  await page.goto("/admin/avaliacoes");
  await expect(page.getByText(/Chegou no horário/)).toBeVisible();
  await expect(page.getByRole("alert").getByText("Senha inicial em uso:")).toBeVisible();
  await page.getByPlaceholder("Responder ao cliente (aparece no pedido dele)").fill("Obrigado! Volte sempre.");
  await page.getByRole("button", { name: "Salvar" }).click();
  await page.getByRole("button", { name: "Tirar da vitrine" }).click();
  await expect(page.getByRole("button", { name: "Mostrar na vitrine" })).toBeVisible();
  await page.goto("/");
  await expect(page.getByText("Quem compra, recomenda")).toHaveCount(0);
});

test("cancelar pedido abre pop-up de confirmação", async ({ page }) => {
  await entrar(page, cliente);
  await page.getByRole("button", { name: /^Adicionar / }).first().click();
  await page.goto("/checkout");
  await page.getByText("Dinheiro na entrega").click();
  await page.getByRole("button", { name: "Confirmar pedido" }).last().click();
  await expect(page).toHaveURL(/\/conta\/pedido\//);

  await page.getByRole("button", { name: "Cancelar pedido" }).click();
  const popup = page.getByRole("alertdialog");
  await expect(popup.getByRole("heading", { name: /Cancelar o pedido #\d+\?/ })).toBeVisible();
  await expect(popup.getByRole("button", { name: "Manter pedido" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(popup).toHaveCount(0);

  await page.getByRole("button", { name: "Cancelar pedido" }).click();
  await popup.getByRole("button", { name: "Sim, cancelar" }).click();
  await expect(popup).toHaveCount(0);
  await expect(page.getByText("Cancelado", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancelar pedido" })).toHaveCount(0);
});

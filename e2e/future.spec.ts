import { test, expect, type Page, type Locator } from "@playwright/test";
async function save(form: Locator) {
  await form
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await expect(form).toHaveCount(0);
}
async function finance(page: Page) {
  await page.goto("/#/financas");
  await page
    .getByRole("button", { name: "Configurar minhas finanças" })
    .click();
  const form = page.getByRole("region", { name: "Formulário financeiro" });
  await form.getByRole("button", { name: "Confirmar e salvar" }).click();
  await expect(form).toHaveCount(0);
}
async function account(
  page: Page,
  name: string,
  type: string,
  balance: string,
) {
  await page.goto("/#/financas/contas");
  await page
    .getByRole("button", { name: "Adicionar conta", exact: true })
    .click();
  const form = page.getByRole("region", { name: "Formulário financeiro" });
  await form.getByLabel("Nome da conta", { exact: true }).fill(name);
  await form
    .getByRole("combobox", { name: "Tipo de conta", exact: true })
    .selectOption(type);
  await form
    .getByLabel("Saldo inicial confirmado (R$)", { exact: true })
    .fill(balance);
  await form
    .getByRole("combobox", {
      name: "Confirma o saldo inicial e sua data?",
      exact: true,
    })
    .selectOption("yes");
  await form.getByRole("button", { name: "Confirmar e salvar" }).click();
  await expect(form).toHaveCount(0);
}
async function createGoal(page: Page, title = "Reserva pessoal") {
  await page.goto("/#/metas/objetivos");
  await page.getByRole("button", { name: "Nova meta", exact: true }).click();
  const form = page.getByRole("region", { name: "Nova meta", exact: true });
  await form.getByLabel("Título da meta", { exact: true }).fill(title);
  await form
    .getByRole("combobox", { name: "Tipo de meta", exact: true })
    .selectOption("financial");
  await form
    .getByLabel("Valor-alvo opcional (R$)", { exact: true })
    .fill("1000,00");
  await save(form);
  await page.getByRole("button", { name: new RegExp(title) }).click();
}
test("meta, transferência, retirada, tarefas e persistência offline sem criar patrimônio", async ({
  page,
  context,
}) => {
  await finance(page);
  await account(page, "Banco do futuro", "checking", "1000,00");
  await account(page, "Reserva do futuro", "savings", "0,00");
  await createGoal(page);
  await page
    .getByRole("button", { name: "Reservar valor", exact: true })
    .click();
  let form = page.getByRole("region", {
    name: "Reservar para esta meta",
    exact: true,
  });
  await form
    .getByRole("combobox", { name: "Conta da reserva", exact: true })
    .selectOption({ label: "Reserva do futuro" });
  await form
    .getByRole("combobox", {
      name: "Transferir de outra conta? (opcional)",
      exact: true,
    })
    .selectOption({ label: "Banco do futuro" });
  await form
    .getByLabel("Valor confirmado (R$)", { exact: true })
    .fill("250,00");
  await save(form);
  await expect(page.getByTestId("goal-reserved")).toContainText("250,00");
  await page
    .getByRole("button", { name: "Liberar reserva", exact: true })
    .click();
  form = page.getByRole("region", {
    name: "Liberar valor reservado",
    exact: true,
  });
  await form
    .getByRole("combobox", { name: "Conta da reserva", exact: true })
    .selectOption({ label: "Reserva do futuro" });
  await form.getByLabel("Valor confirmado (R$)", { exact: true }).fill("50,00");
  await save(form);
  await expect(page.getByTestId("goal-reserved")).toContainText("200,00");
  await page.getByRole("button", { name: "Criar tarefa vinculada" }).click();
  await page
    .getByLabel("Título da tarefa", { exact: true })
    .fill("Revisar meu objetivo");
  await page
    .getByRole("button", { name: "Salvar tarefa", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Qual é o próximo passo?" }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Revisar meu objetivo", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Concluir tarefa", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reabrir", exact: true }),
  ).toBeVisible();
  await page.goto("/#/financas");
  await expect(page.getByTestId("bank-balance")).toContainText("1.000,00");
  await page.goto("/#/metas/objetivos");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: /Reserva pessoal/ }).click();
  await expect(page.getByTestId("goal-reserved")).toContainText("200,00");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/future-goal-mobile.png",
    fullPage: true,
  });
});
test("casamento e moradia têm marcos editáveis e sugestões não se duplicam", async ({
  page,
}) => {
  await page.goto("/#/metas");
  await page
    .getByText("Ideias para começar · você escolhe", { exact: true })
    .click();
  const wedding = page.locator(".future-suggestion").filter({
    has: page.getByRole("heading", {
      name: "Planejamento do casamento",
      exact: true,
    }),
  });
  await wedding.getByRole("button", { name: "Adicionar sugestão" }).click();
  await expect(
    wedding.getByRole("button", { name: "Já adicionada" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("heading", { name: "Definir orçamento", exact: true }),
  ).toBeVisible();
  const milestone = page.locator(".manage-row").filter({
    has: page.getByRole("heading", {
      name: "Definir orçamento",
      exact: true,
    }),
  });
  await milestone.getByRole("button", { name: "Editar marco" }).click();
  const form = page.getByRole("region", { name: "Editar marco", exact: true });
  await form
    .getByLabel("Título do marco", { exact: true })
    .fill("Conversar sobre o orçamento");
  await form.getByLabel("Marco concluído", { exact: true }).check();
  await save(form);
  await expect(
    page.getByRole("heading", {
      name: "✓ Conversar sobre o orçamento",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByText("Ideias para começar · você escolhe", { exact: true })
    .click();
  await expect(
    wedding.getByRole("button", { name: "Já adicionada" }),
  ).toBeDisabled();
  const housing = page.locator(".future-suggestion").filter({
    has: page.getByRole("heading", {
      name: "Planejamento da moradia",
      exact: true,
    }),
  });
  await housing.getByRole("button", { name: "Adicionar sugestão" }).click();
  await expect(
    page.getByRole("heading", { name: "Estimar custos", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Editar meta", exact: true }).click();
  const edit = page.getByRole("region", { name: "Editar meta", exact: true });
  await expect(
    edit.getByLabel("Valor-alvo opcional (R$)", { exact: true }),
  ).toHaveValue("");
  await expect(edit.getByLabel("Prazo opcional", { exact: true })).toHaveValue(
    "",
  );
  await edit
    .getByLabel("Título da meta", { exact: true })
    .fill("Meu espaço futuro");
  await edit
    .getByRole("combobox", { name: "Estado da meta", exact: true })
    .selectOption("archived");
  await save(edit);
  await page
    .getByRole("combobox", { name: "Exibir", exact: true })
    .selectOption("archived");
  await expect(
    page.getByRole("button", { name: /Meu espaço futuro/ }),
  ).toBeVisible();
});
test("projeto recebe parciais, paga custos, registra tempo e estorna sem duplicidade", async ({
  page,
}) => {
  await finance(page);
  await account(page, "Conta de projetos", "checking", "0,00");
  await page.goto("/#/mais/renda");
  await page.getByRole("button", { name: "Novo projeto", exact: true }).click();
  let form = page.getByRole("region", { name: "Novo projeto", exact: true });
  await form
    .getByLabel("Serviço ou projeto", { exact: true })
    .fill("Site para cliente");
  await form
    .getByLabel("Cliente ou origem", { exact: true })
    .fill("Cliente local");
  await form
    .getByLabel("Valor contratado opcional (R$)", { exact: true })
    .fill("600,00");
  await form
    .getByRole("combobox", { name: "Etapa", exact: true })
    .selectOption("contracted");
  await save(form);
  await page.getByRole("button", { name: /Site para cliente/ }).click();
  await expect(page.getByTestId("project-received")).toContainText("0,00");
  for (const amount of ["200,00", "100,00"]) {
    await page
      .getByRole("button", { name: "Registrar recebimento", exact: true })
      .click();
    form = page.getByRole("region", {
      name: "Confirmar recebimento parcial",
      exact: true,
    });
    await form
      .getByLabel("Valor efetivamente movimentado (R$)", { exact: true })
      .fill(amount);
    await form
      .getByRole("combobox", { name: "Conta bancária", exact: true })
      .selectOption({ label: "Conta de projetos" });
    await form
      .getByRole("combobox", { name: "Categoria financeira", exact: true })
      .selectOption({ label: "Outras receitas" });
    await save(form);
  }
  await expect(page.getByTestId("project-received")).toContainText("300,00");
  await page
    .getByRole("button", { name: "Registrar custo", exact: true })
    .click();
  form = page.getByRole("region", {
    name: "Registrar custo realizado",
    exact: true,
  });
  await form
    .getByLabel("Valor efetivamente movimentado (R$)", { exact: true })
    .fill("50,00");
  await form
    .getByRole("combobox", { name: "Conta bancária", exact: true })
    .selectOption({ label: "Conta de projetos" });
  await form
    .getByRole("combobox", { name: "Categoria financeira", exact: true })
    .selectOption({ label: "Outras despesas" });
  await save(form);
  await page
    .getByRole("button", { name: "Registrar tempo", exact: true })
    .click();
  form = page.getByRole("region", {
    name: "Registrar tempo dedicado",
    exact: true,
  });
  await form.getByLabel("Minutos dedicados", { exact: true }).fill("120");
  await save(form);
  await expect(page.getByTestId("project-net")).toContainText("Confirme");
  await page
    .getByRole("button", { name: "Editar projeto", exact: true })
    .click();
  form = page.getByRole("region", { name: "Editar projeto", exact: true });
  await form
    .getByLabel(
      "Confirmei todos os custos realizados até agora (inclusive se zero)",
      { exact: true },
    )
    .check();
  await form
    .getByLabel("Registrei todo o tempo dedicado até agora", { exact: true })
    .check();
  await save(form);
  await expect(page.getByTestId("project-net")).toContainText("250,00");
  await expect(
    page.getByText("R$ 150,00/h", { exact: true }).first(),
  ).toBeVisible();
  await page
    .locator(".manage-row")
    .filter({ has: page.getByText("Recebimento · R$ 200,00", { exact: true }) })
    .getByRole("button", { name: "Revisar estorno", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirmar estorno", exact: true })
    .click();
  await expect(page.getByTestId("project-received")).toContainText("100,00");
  await expect(page.getByTestId("project-net")).toContainText("50,00");
  await page.goto("/#/financas");
  await expect(page.getByTestId("bank-balance")).toContainText("50,00");
  await page.goto("/#/mais/renda");
  await page.reload();
  await page.getByRole("button", { name: /Site para cliente/ }).click();
  await expect(page.getByTestId("project-received")).toContainText("100,00");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/future-project-dark.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const navigation = page.getByRole("navigation", { name: "Metas e projetos" });
  const first = await navigation
    .getByRole("link", { name: "Meu futuro", exact: true })
    .boundingBox();
  const second = await navigation
    .getByRole("link", { name: "Minhas metas", exact: true })
    .boundingBox();
  expect(first && second && Math.abs(first.y - second.y) < 2).toBe(true);
  await page.screenshot({
    path: "test-results/future-project-desktop.png",
    fullPage: true,
  });
});
test("backup v4 restaura metas, marcos e projetos após revisão", async ({
  page,
}) => {
  await page.goto("/#/metas/objetivos");
  await page.getByRole("button", { name: "Nova meta", exact: true }).click();
  const form = page.getByRole("region", { name: "Nova meta", exact: true });
  await form
    .getByLabel("Título da meta", { exact: true })
    .fill("Caminho para o futuro");
  await save(form);
  await page.goto("/#/mais/backup");
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exportar cópia JSON", exact: true })
    .click();
  const download = await downloadEvent,
    path = await download.path();
  expect(path).toBeTruthy();
  await page.goto("/#/metas/objetivos");
  await page.getByRole("button", { name: /Caminho para o futuro/ }).click();
  await page.getByRole("button", { name: "Editar meta", exact: true }).click();
  const edit = page.getByRole("region", { name: "Editar meta", exact: true });
  await edit
    .getByLabel("Título da meta", { exact: true })
    .fill("Título posterior");
  await save(edit);
  await page.goto("/#/mais/backup");
  await page.locator('input[type="file"]').setInputFiles(path!);
  await page.getByLabel("Digite RESTAURAR", { exact: false }).fill("RESTAURAR");
  await page
    .getByRole("button", { name: "Restaurar cópia confirmada", exact: true })
    .click();
  await expect(
    page.getByText(
      "Restauração concluída. A cópia anterior está disponível abaixo.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.goto("/#/metas/objetivos");
  await expect(
    page.getByRole("button", { name: /Caminho para o futuro/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Título posterior/ }),
  ).toHaveCount(0);
});

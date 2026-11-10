import { test, expect, type Page, type Locator } from "@playwright/test";
import { localDate } from "../src/lib/date";
async function editor(page: Page) {
  return page.getByRole("region", { name: "Formulário financeiro" });
}
async function confirm(page: Page) {
  await (
    await editor(page)
  )
    .getByRole("button", { name: "Confirmar e salvar" })
    .click();
  await expect(
    page.getByRole("region", { name: "Formulário financeiro" }),
  ).toHaveCount(0);
}
async function setup(page: Page) {
  await page.goto("/#/financas");
  await page
    .getByRole("button", { name: "Configurar minhas finanças" })
    .click();
  await confirm(page);
  await expect(
    page.getByRole("link", { name: "Visão geral", exact: true }),
  ).toBeVisible();
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
  const form = await editor(page);
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
  await confirm(page);
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}
async function selectLabel(form: Locator, name: string, label: string) {
  await form
    .getByRole("combobox", { name, exact: true })
    .selectOption({ label });
}
async function expense(page: Page, description: string, amount: string) {
  await page.goto("/#/financas/lancamentos");
  await page
    .getByRole("button", { name: "Adicionar gasto", exact: true })
    .click();
  const form = await editor(page);
  await form.getByLabel("Descrição", { exact: true }).fill(description);
  await selectLabel(form, "Conta do lançamento", "Banco teste");
  await selectLabel(form, "Categoria do lançamento", "Outras despesas");
  await form
    .getByLabel("Valor do lançamento (R$)", { exact: true })
    .fill(amount);
  await confirm(page);
}
async function payExpense(page: Page, description: string, amount: string) {
  const row = page.locator(".routine-card").filter({
    has: page.getByRole("heading", { name: description, exact: true }),
  });
  await row.getByRole("button", { name: "Pagar conta", exact: true }).click();
  const form = await editor(page);
  await form.getByLabel("Valor efetivo (R$)", { exact: true }).fill(amount);
  await confirm(page);
}
test("saldo real, parcial, estorno e ticket separado persistem offline", async ({
  page,
  context,
}) => {
  await setup(page);
  await account(page, "Banco teste", "checking", "1000,00");
  await account(page, "Ticket teste", "benefit", "1200,00");
  await expense(page, "Conta do mês", "100,00");
  await page.goto("/#/financas");
  await expect(page.getByTestId("bank-balance")).toContainText("1.000,00");
  await expect(page.getByTestId("benefit-balance")).toContainText("1.200,00");
  await page.goto("/#/financas/lancamentos");
  await payExpense(page, "Conta do mês", "40,00");
  await expect(page.getByText("Despesa · Parcial")).toBeVisible();
  await page.goto("/#/financas");
  await expect(page.getByTestId("bank-balance")).toContainText("960,00");
  await page.goto("/#/financas/ticket");
  await page
    .getByRole("button", { name: "Registrar consumo / crédito" })
    .click();
  const form = await editor(page);
  await form
    .getByLabel("Descrição do ticket", { exact: true })
    .fill("Alimentação do mês");
  await selectLabel(form, "Categoria do benefício", "Alimentação");
  await form.getByLabel("Valor do ticket (R$)", { exact: true }).fill("350,00");
  await confirm(page);
  await page.goto("/#/financas");
  await expect(page.getByTestId("bank-balance")).toContainText("960,00");
  await expect(page.getByTestId("benefit-balance")).toContainText("850,00");
  await page.goto("/#/financas/lancamentos");
  await page.getByText("Pagamentos e estornos", { exact: true }).click();
  await page
    .getByRole("button", { name: "Estornar pagamento", exact: true })
    .click();
  await page.goto("/#/financas");
  await expect(page.getByTestId("bank-balance")).toContainText("1.000,00");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId("bank-balance")).toContainText("1.000,00");
  await expect(page.getByTestId("benefit-balance")).toContainText("850,00");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "test-results/phase3-finance-mobile.png",
    fullPage: true,
  });
});
test("cartão parcelado, fatura parcial, projeções e relatório sem duplicar despesa", async ({
  page,
}) => {
  await setup(page);
  await account(page, "Banco teste", "checking", "1000,00");
  await page.goto("/#/financas/cartoes");
  await page
    .getByRole("button", { name: "Adicionar cartão", exact: true })
    .click();
  let form = await editor(page);
  await form.getByLabel("Nome do cartão", { exact: true }).fill("Cartão teste");
  await form
    .getByLabel("Limite informado (R$)", { exact: true })
    .fill("3000,00");
  await confirm(page);
  await page
    .getByRole("button", { name: "Adicionar compra parcelada", exact: true })
    .click();
  form = await editor(page);
  await form
    .getByLabel("Descrição da compra", { exact: true })
    .fill("Compra parcelada teste");
  await selectLabel(form, "Categoria da compra", "Outras despesas");
  await form
    .getByLabel("Valor total da compra (R$)", { exact: true })
    .fill("100,01");
  await form.getByLabel("Número de parcelas", { exact: true }).fill("3");
  await confirm(page);
  await expect(page.locator(".invoice-row")).toHaveCount(3);
  await page
    .locator(".invoice-row")
    .first()
    .getByRole("button", { name: "Pagar fatura", exact: true })
    .click();
  form = await editor(page);
  await form.getByLabel("Valor efetivo (R$)", { exact: true }).fill("10,00");
  await confirm(page);
  await expect(page.locator(".invoice-row").first()).toContainText("23,34");
  await page.goto("/#/financas");
  await expect(page.getByTestId("bank-balance")).toContainText("990,00");
  await page.goto("/#/financas/relatorios");
  await expect(page.getByRole("table")).toContainText("100,01");
  await expect(page.getByRole("table")).not.toContainText("110,01");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar competência CSV" }).click();
  await expect((await download).suggestedFilename()).toContain(".csv");
  await page.goto("/#/financas/projecoes");
  await expect(page.locator(".projection-list .routine-card")).toHaveCount(12);
  await expect(
    page.getByText(
      "Projeção incompleta: gastos variáveis ainda não estimados.",
    ),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Cenário", exact: true })
    .selectOption("conservative");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "test-results/phase3-projections-dark.png",
    fullPage: true,
  });
});
test("exportação e restauração confirmada com cópia anterior preservada", async ({
  page,
}) => {
  await setup(page);
  await account(page, "Banco teste", "checking", "1000,00");
  await page.goto("/#/mais/backup");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar cópia JSON" }).click();
  const file = await download;
  await file.saveAs("test-results/phase3-backup.json");
  await page
    .getByRole("button", { name: "Confirmo que guardei o arquivo" })
    .click();
  await expense(page, "Conta posterior à cópia", "100,00");
  await payExpense(page, "Conta posterior à cópia", "100,00");
  await page.goto("/#/financas");
  await expect(page.getByTestId("bank-balance")).toContainText("900,00");
  await page.goto("/#/mais/backup");
  await page
    .getByLabel("Arquivo de backup JSON", { exact: true })
    .setInputFiles("test-results/phase3-backup.json");
  await expect(
    page.getByRole("heading", { name: "Pré-visualização da cópia" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Restaurar cópia confirmada" }),
  ).toBeDisabled();
  await page
    .getByLabel("Digite RESTAURAR para substituir os dados", { exact: true })
    .fill("RESTAURAR");
  await page
    .getByRole("button", { name: "Restaurar cópia confirmada" })
    .click();
  await expect(
    page.getByRole("button", { name: "Baixar cópia anterior" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Restauração concluída. A cópia anterior está disponível abaixo.",
    ),
  ).toBeVisible();
  await page.goto("/#/financas");
  await expect(page.getByTestId("bank-balance")).toContainText("1.000,00");
});
test("upgrade v2 mantém check-in e privacidade antes do onboarding financeiro", async ({
  page,
}) => {
  await page.goto("/offline.html");
  await page.evaluate(async (date) => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("minha-virada", 20);
      req.onupgradeneeded = () => {
        const d = req.result;
        d.createObjectStore("settings", { keyPath: "id" });
        const audit = d.createObjectStore("audit", {
          keyPath: "id",
          autoIncrement: true,
        });
        audit.createIndex("entity", "entity");
        audit.createIndex("at", "at");
        d.createObjectStore("checkIns", { keyPath: "date" });
        for (const table of ["habits", "attempts", "tasks"])
          d.createObjectStore(table, { keyPath: "id" });
        d.createObjectStore("habitLogs", { keyPath: ["habitId", "date"] });
        d.createObjectStore("taskRecords", {
          keyPath: ["taskId", "scheduledDate"],
        });
        d.createObjectStore("routineEvents", {
          keyPath: "id",
          autoIncrement: true,
        });
      };
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const d = req.result;
        const tx = d.transaction(["settings", "checkIns"], "readwrite");
        const at = new Date().toISOString();
        tx.objectStore("settings").put({
          id: "profile",
          name: "Perfil v2",
          salary: 250000,
          benefit: 120000,
          fuel: 35000,
          food: 35000,
          reserve: 1000000,
          theme: "dark",
          hideSensitive: true,
          updatedAt: at,
        });
        tx.objectStore("checkIns").put({
          date,
          mood: 4,
          energy: 5,
          consumed: true,
          craving: 2,
          triggers: "Registro local preservado",
          exercise: false,
          activityMinutes: 0,
          projectMinutes: 30,
          notes: "",
          revision: 1,
          createdAt: at,
          updatedAt: at,
        });
        tx.oncomplete = () => {
          d.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  }, localDate());
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Olá, Perfil v2." }),
  ).toBeVisible();
  await expect(page.getByTestId("sensitive-summary")).toHaveCount(0);
  await page.goto("/#/habitos/check-in");
  await expect(page.getByLabel("Houve consumo de maconha?")).toHaveValue(
    "true",
  );
  await expect(page.getByLabel("Energia (1 a 5)")).toHaveValue("5");
  await page.goto("/#/financas");
  await expect(
    page.getByRole("button", { name: "Configurar minhas finanças" }),
  ).toBeVisible();
  await expect(page.getByTestId("bank-balance")).toHaveCount(0);
});

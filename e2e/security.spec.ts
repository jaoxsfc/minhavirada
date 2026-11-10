import { test, expect, devices, type Page } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
async function importFile(page: Page, path = "e2e/fixtures/backup-v4.json") {
  await page.goto("/#/mais/seguranca");
  await page
    .getByLabel("Arquivo de backup JSON", { exact: true })
    .setInputFiles(path);
  await expect(
    page.getByRole("heading", { name: "Pré-visualização da cópia" }),
  ).toBeVisible();
}
async function restore(page: Page) {
  await page
    .getByLabel("Digite RESTAURAR para substituir os dados", { exact: true })
    .fill("RESTAURAR");
  await page
    .getByRole("button", { name: "Restaurar cópia confirmada" })
    .click();
  await expect(
    page.getByText(
      "Restauração concluída. A cópia anterior está disponível abaixo.",
      { exact: true },
    ),
  ).toBeVisible();
}
async function configure(page: Page) {
  await page.goto("/#/financas");
  await page
    .getByRole("button", { name: "Configurar minhas finanças" })
    .click();
  const form = page.getByRole("region", { name: "Formulário financeiro" });
  await form.getByRole("button", { name: "Confirmar e salvar" }).click();
  await expect(form).toHaveCount(0);
}
async function createBank(page: Page) {
  await configure(page);
  await page.goto("/#/financas/contas");
  await page
    .getByRole("button", { name: "Adicionar conta", exact: true })
    .click();
  const form = page.getByRole("region", { name: "Formulário financeiro" });
  await form
    .getByLabel("Nome da conta", { exact: true })
    .fill("Banco preservado");
  await form
    .getByLabel("Saldo inicial confirmado (R$)", { exact: true })
    .fill("1000,00");
  await form
    .getByRole("combobox", {
      name: "Confirma o saldo inicial e sua data?",
      exact: true,
    })
    .selectOption("yes");
  await form.getByRole("button", { name: "Confirmar e salvar" }).click();
  await expect(form).toHaveCount(0);
}
async function accountCount(page: Page) {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const req = indexedDB.open("minha-virada");
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const database = req.result,
            tx = database.transaction("financeAccounts", "readonly"),
            count = tx.objectStore("financeAccounts").count();
          count.onsuccess = () => resolve(count.result);
          count.onerror = () => reject(count.error);
          tx.oncomplete = () => database.close();
        };
      }),
  );
}
test("backup criptografado restaura em banco limpo, preserva históricos e funciona offline", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(90000);
  await importFile(page);
  await restore(page);
  await configure(page);
  await page.goto("/#/habitos/tarefas");
  await page.getByRole("button", { name: "Nova tarefa", exact: true }).click();
  await page
    .getByLabel("Título da tarefa", { exact: true })
    .fill("Registro exclusivo para proteção");
  await page
    .getByRole("button", { name: "Salvar tarefa", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Qual é o próximo passo?" }),
  ).toHaveCount(0);
  await page.goto("/#/mais/seguranca");
  await page
    .getByLabel("Senha da nova cópia", { exact: true })
    .fill("minha frase segura de teste");
  await page
    .getByLabel("Repita a senha", { exact: true })
    .fill("minha frase segura de teste");
  const downloading = page.waitForEvent("download"),
    started = Date.now();
  await page
    .getByRole("button", { name: "Exportar cópia criptografada" })
    .click();
  const file = await downloading;
  await file.saveAs("test-results/phase5-protected.mvbackup");
  writeFileSync(
    "test-results/phase5-crypto-timing.json",
    JSON.stringify({
      milliseconds: Date.now() - started,
      environment:
        "Chromium Pixel 7 emulado, CPU do computador; inclui validação e exportação",
    }),
  );
  await expect(
    page.getByLabel("Senha da nova cópia", { exact: true }),
  ).toHaveValue("");
  await expect(page.getByLabel("Repita a senha", { exact: true })).toHaveValue(
    "",
  );
  const raw = readFileSync("test-results/phase5-protected.mvbackup", "utf8");
  expect(raw).not.toContain("Registro exclusivo");
  expect(raw).not.toContain("Banco representativo");
  await page
    .getByRole("button", { name: "Confirmo que guardei o arquivo" })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Cópia externa confirmada" }),
  ).toBeVisible();
  await page
    .getByLabel("Arquivo de backup JSON", { exact: true })
    .setInputFiles("test-results/phase5-protected.mvbackup");
  await page
    .getByLabel("Senha para abrir a cópia", { exact: true })
    .fill("senha incorreta");
  await page.getByRole("button", { name: "Abrir cópia protegida" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "senha incorreta ou arquivo" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Senha para abrir a cópia", { exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByRole("heading", { name: "Pré-visualização da cópia" }),
  ).toHaveCount(0);
  await page.goto("/#/financas");
  await expect(page.getByTestId("bank-balance")).toContainText("1.200,00");
  const clean = await browser.newContext({
    ...devices["Pixel 7"],
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  });
  try {
    const other = await clean.newPage();
    await other.goto(baseURL + "/#/mais/seguranca");
    expect(await accountCount(other)).toBe(0);
    await other
      .getByLabel("Arquivo de backup JSON", { exact: true })
      .setInputFiles("test-results/phase5-protected.mvbackup");
    await other
      .getByLabel("Senha para abrir a cópia", { exact: true })
      .fill("minha frase segura de teste");
    await other.getByRole("button", { name: "Abrir cópia protegida" }).click();
    await expect(
      other.getByRole("heading", { name: "Pré-visualização da cópia" }),
    ).toBeVisible();
    expect(await accountCount(other)).toBe(0);
    await restore(other);
    await other.goto(baseURL + "/#/financas");
    await expect(other.getByTestId("bank-balance")).toContainText("1.200,00");
    await expect(other.getByTestId("benefit-balance")).toContainText("500,00");
    await other.goto(baseURL + "/#/metas/objetivos");
    await other.getByRole("button", { name: /Reserva representativa/ }).click();
    await expect(other.getByTestId("goal-reserved")).toContainText("100,00");
    await other.goto(baseURL + "/#/mais/renda");
    await other.getByRole("button", { name: /Serviço representativo/ }).click();
    await expect(other.getByTestId("project-received")).toContainText("200,00");
    await other.goto(baseURL + "/#/mais/seguranca");
    await other
      .getByRole("button", { name: "Verificar integridade", exact: true })
      .click();
    await expect(
      other.getByRole("heading", { name: "Nenhuma inconsistência detectada" }),
    ).toBeVisible();
    await other.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await other.waitForFunction(() => !!navigator.serviceWorker.controller);
    const privateCached = await other.evaluate(async () => {
      for (const key of await caches.keys())
        for (const request of await (await caches.open(key)).keys()) {
          const response = await (await caches.open(key)).match(request);
          if (
            response?.headers.get("content-type")?.includes("text") &&
            (await response.text()).includes("Registro exclusivo para proteção")
          )
            return true;
        }
      return false;
    });
    expect(privateCached).toBe(false);
    await clean.setOffline(true);
    await other.reload();
    await expect(
      other.getByRole("heading", { name: "Seus dados e segurança." }),
    ).toBeVisible();
    expect(
      await other.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await other.screenshot({
      path: "test-results/phase5-security-mobile.png",
      fullPage: true,
    });
  } finally {
    await clean.close();
  }
  // Deletion is tested only in this isolated context, after an explicit external-copy acknowledgement.
  await page.goto("/#/mais/seguranca");
  await page.getByText("Apagar dados locais", { exact: true }).click();
  await page
    .getByLabel(
      "Entendo que os registros locais e as cópias internas serão apagados.",
      { exact: true },
    )
    .check();
  await page.getByLabel("Digite APAGAR", { exact: true }).fill("APAGAR");
  await Promise.all([
    page.waitForEvent("load"),
    page
      .getByRole("button", {
        name: "Apagar todos os dados locais",
        exact: true,
      })
      .click(),
  ]);
  await expect(
    page.getByRole("heading", { name: "Seus dados e segurança." }),
  ).toBeVisible();
  await expect.poll(() => accountCount(page)).toBe(0);
});
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
test("arquivos inválidos, truncados e futuros não alteram saldos", async ({
  page,
}) => {
  await importFile(page);
  await restore(page);
  await configure(page);
  const file = JSON.parse(readFileSync("e2e/fixtures/backup-v4.json", "utf8"));
  const broken = structuredClone(file);
  broken.data.financePayments[0].accountId =
    "11111111-1111-4111-8111-111111111111";
  const { checksum, ...body } = broken;
  void checksum;
  broken.checksum = createHash("sha256")
    .update(JSON.stringify(canonical(body)))
    .digest("hex");
  for (const [value, message] of [
    ['{"format":', "incompleto"],
    [JSON.stringify({ ...file, schemaVersion: 99 }), "não suportada"],
    [JSON.stringify(broken), "inconsistentes"],
  ]) {
    await page.goto("/#/mais/seguranca");
    await page
      .getByLabel("Arquivo de backup JSON", { exact: true })
      .setInputFiles({
        name: "invalid.json",
        mimeType: "application/json",
        buffer: Buffer.from(value),
      });
    await expect(
      page.getByRole("status").filter({ hasText: message }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Pré-visualização da cópia" }),
    ).toHaveCount(0);
    await page.goto("/#/financas");
    await expect(page.getByTestId("bank-balance")).toContainText("1.200,00");
  }
});
test("falha de quota ao criar recuperação bloqueia substituição e preserva banco", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (
      ...args: Parameters<IDBObjectStore["add"]>
    ) {
      if (this.name === "recoverySnapshots")
        throw new DOMException("simulated-quota", "QuotaExceededError");
      return original.apply(this, args);
    };
  });
  await createBank(page);
  await importFile(page);
  await page
    .getByLabel("Digite RESTAURAR para substituir os dados", { exact: true })
    .fill("RESTAURAR");
  await page
    .getByRole("button", { name: "Restaurar cópia confirmada" })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Não foi possível preservar" }),
  ).toBeVisible();
  await page.goto("/#/financas");
  await expect(page.getByTestId("bank-balance")).toContainText("1.000,00");
});

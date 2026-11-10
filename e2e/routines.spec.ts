import { test, expect, type Page } from "@playwright/test";
import { localDate } from "../src/lib/date";
import { shiftDate } from "../src/lib/calendar";
const today = localDate();
async function saveDay(
  page: Page,
  date: string,
  consumed = "false",
  activity = false,
) {
  await page.goto(`/#/habitos/check-in?date=${date}`);
  await expect(
    page.getByRole("heading", { name: "Seu check-in." }),
  ).toBeVisible();
  await page.getByLabel("Houve consumo de maconha?").selectOption(consumed);
  await page.getByLabel("Energia (1 a 5)").selectOption("4");
  if (activity) {
    await page.getByLabel("Realizei atividade física").check();
    await page.getByLabel("Minutos de atividade").fill("25");
  }
  await page.getByLabel("Minutos em projetos pessoais").fill("40");
  await page
    .getByLabel("Gatilhos percebidos (opcional)")
    .fill("Texto reservado de teste");
  await page.getByRole("button", { name: "Salvar check-in" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Check-in salvo neste dispositivo.",
  );
}
test("check-in, edição, sequência, calendário, privacidade e reabertura offline", async ({
  page,
  context,
}) => {
  await page.goto("/#/habitos/check-in");
  await page.getByRole("button", { name: "Salvar check-in" }).click();
  await expect(page.getByText("Escolha sim ou não.")).toBeVisible();
  await saveDay(page, shiftDate(today, -1));
  await saveDay(page, today, "false", true);
  await page.reload();
  await expect(page.getByLabel("Houve consumo de maconha?")).toHaveValue(
    "false",
  );
  await expect(page.getByLabel("Minutos de atividade")).toHaveValue("25");
  await page.goto("/#/habitos/acompanhamento");
  await page.getByLabel("Data inicial").fill(shiftDate(today, -1));
  await page
    .getByRole("button", { name: "Registrar início / nova etapa" })
    .click();
  await expect(
    page.getByText("Início registrado. Seu histórico foi preservado."),
  ).toBeVisible();
  await expect(
    page
      .locator(".stat")
      .filter({ hasText: "Sequência confirmada" })
      .locator("strong"),
  ).toHaveText("2");
  await saveDay(page, shiftDate(today, -1), "true");
  await page.goto("/#/habitos/acompanhamento");
  await expect(
    page
      .locator(".stat")
      .filter({ hasText: "Sequência confirmada" })
      .locator("strong"),
  ).toHaveText("1");
  await page.getByRole("button", { name: "Ver registros" }).click();
  await expect(
    page.getByRole("link", { name: new RegExp("Com consumo") }),
  ).toBeVisible();
  await page.goto("/#/habitos/calendario");
  await expect(
    page.getByRole("button", {
      name: `${today}: registrado, com atividade`,
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: `${shiftDate(today, -2)}: sem registro`,
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByTestId("calendar-sensitive")).toHaveCount(0);
  await page
    .getByRole("button", {
      name: `${shiftDate(today, -2)}: sem registro`,
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sem check-in neste dia" }),
  ).toBeVisible();
  await page.goto("/");
  await expect(page.getByText("Check-in de hoje concluído")).toBeVisible();
  await expect(page.getByTestId("sensitive-summary")).toHaveCount(0);
  await expect(page.getByText("Texto reservado de teste")).toHaveCount(0);
  await page.goto("/#/mais/configuracoes");
  await page
    .getByRole("textbox", { name: "Como você quer ser chamado?" })
    .fill("Teste local");
  await page.getByLabel("Ocultar indicadores sensíveis no início").uncheck();
  await page.getByRole("button", { name: "Começar minha virada" }).click();
  await expect(
    page.getByRole("heading", { name: "Suas preferências" }),
  ).toBeVisible();
  await page.goto("/");
  await expect(page.getByTestId("sensitive-summary")).toBeVisible();
  await page.goto("/#/mais/configuracoes");
  await page.getByLabel("Ocultar indicadores sensíveis no início").check();
  await page.getByRole("button", { name: "Salvar preferências" }).click();
  await expect(
    page.getByText("Preferências salvas neste dispositivo."),
  ).toBeVisible();
  await page.goto("/");
  await expect(page.getByTestId("sensitive-summary")).toHaveCount(0);
  await page.goto("/#/mais/relatorios");
  await expect(
    page.getByRole("heading", { name: "Minha evolução." }),
  ).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByLabel("Período dos gráficos").selectOption("month");
  await page.screenshot({
    path: "test-results/phase2-reports-mobile.png",
    fullPage: true,
  });
  const viewport = page.viewportSize();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.screenshot({
    path: "test-results/phase2-reports-desktop-dark.png",
    fullPage: true,
  });
  await page.emulateMedia({ colorScheme: "light" });
  if (viewport) await page.setViewportSize(viewport);
  await expect(
    page.getByRole("img", {
      name: "Gráfico de humor e energia nos dias registrados",
    }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  const reopened = await context.newPage();
  await page.close();
  await reopened.goto("/#/habitos/check-in");
  await expect(reopened.getByLabel("Houve consumo de maconha?")).toHaveValue(
    "false",
  );
  await expect(reopened.getByLabel("Minutos de atividade")).toHaveValue("25");
  await reopened.screenshot({
    path: "test-results/phase2-checkin-mobile.png",
    fullPage: true,
  });
});
test("hábitos e tarefas recorrentes editáveis sem duplicação", async ({
  page,
}) => {
  await page.goto("/#/habitos");
  await page.getByRole("button", { name: "Escolher sugestões" }).click();
  await page.getByLabel("Fazer check-in diário · 7×/semana").check();
  await page.getByRole("button", { name: "Confirmar sugestões" }).click();
  await expect(
    page.getByRole("heading", { name: "Fazer check-in diário", exact: true }),
  ).toHaveCount(1);
  await page.reload();
  await page.getByRole("button", { name: "Escolher sugestões" }).click();
  await expect(
    page.getByLabel(/Fazer check-in diário · 7×\/semana/),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Novo hábito" }).click();
  await page.getByLabel("Nome do hábito").fill("Alongar");
  await page.getByLabel("Meta de dias por semana").fill("7");
  await page.getByLabel("Duração sugerida (minutos)").fill("10");
  await page.getByRole("button", { name: "Salvar hábito" }).click();
  const card = page.locator(".routine-card").filter({
    has: page.getByRole("heading", { name: "Alongar", exact: true }),
  });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Concluir neste dia" }).click();
  await expect(
    card.getByRole("button", { name: "✓ Concluído · desfazer" }),
  ).toBeVisible();
  await card.getByRole("button", { name: "Editar", exact: true }).click();
  await page.getByLabel("Nome do hábito").fill("Alongar com calma");
  await page.getByRole("button", { name: "Salvar hábito" }).click();
  const edited = page.locator(".routine-card").filter({
    has: page.getByRole("heading", {
      name: "Alongar com calma",
      exact: true,
    }),
  });
  await edited.getByRole("button", { name: "Arquivar", exact: true }).click();
  await expect(edited).toHaveCount(0);
  await page.getByLabel("Mostrar arquivados").check();
  await expect(edited).toBeVisible();
  await edited.getByRole("button", { name: "Histórico", exact: true }).click();
  await expect(
    edited.getByText(/Concluído · 10 min de referência/),
  ).toBeVisible();
  await page.goto("/#/habitos/tarefas");
  await page.getByRole("button", { name: "Nova tarefa" }).click();
  await page.getByLabel("Título da tarefa").fill("Organizar mesa");
  await page
    .getByRole("combobox", { name: "Frequência", exact: true })
    .selectOption("daily");
  await page.getByRole("button", { name: "Salvar tarefa" }).click();
  await page.getByRole("button", { name: "Hoje", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Organizar mesa", exact: true }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Concluir tarefa", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Estado", exact: true })
    .selectOption("done");
  await expect(
    page.getByRole("heading", { name: "Organizar mesa", exact: true }),
  ).toHaveCount(1);
  await page.reload();
  await page.getByRole("button", { name: "Hoje", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Organizar mesa", exact: true }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "✓ Concluída · reabrir" }).click();
  await page.getByRole("button", { name: "Adiar", exact: true }).click();
  await page.getByLabel("Nova data", { exact: true }).fill(shiftDate(today, 1));
  await page.getByRole("button", { name: "Confirmar adiamento" }).click();
  await expect(
    page.getByRole("heading", { name: "Organizar mesa", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Gerenciar tarefas" }).click();
  await page.getByRole("button", { name: "Editar tarefa" }).click();
  await page.getByLabel("Título da tarefa").fill("Organizar mesa com calma");
  await page.getByRole("button", { name: "Salvar tarefa" }).click();
  await expect(
    page.getByRole("heading", { name: /Organizar mesa com calma/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/phase2-tasks-mobile.png",
    fullPage: true,
  });
});

test("migração no navegador preserva o perfil v1", async ({ page }) => {
  await page.goto("/offline.html");
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      // Dexie version 1 maps to native IndexedDB version 10.
      const request = indexedDB.open("minha-virada", 10);
      request.onupgradeneeded = () => {
        const old = request.result;
        old.createObjectStore("settings", { keyPath: "id" });
        const audit = old.createObjectStore("audit", {
          keyPath: "id",
          autoIncrement: true,
        });
        audit.createIndex("entity", "entity");
        audit.createIndex("at", "at");
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const tx = database.transaction(["settings", "audit"], "readwrite");
        tx.objectStore("settings").put({
          id: "profile",
          name: "Perfil preservado",
          salary: 123456,
          benefit: 120000,
          fuel: 35000,
          food: 35000,
          reserve: 1000000,
          theme: "dark",
          hideSensitive: true,
          updatedAt: "2026-01-01T12:00:00Z",
        });
        tx.objectStore("audit").add({
          entity: "settings",
          action: "saved",
          at: "2026-01-01T12:00:00Z",
        });
        tx.oncomplete = () => {
          database.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Olá, Perfil preservado." }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goto("/#/mais/configuracoes");
  await expect(
    page.getByRole("textbox", { name: "Salário planejado (R$)" }),
  ).toHaveValue("1234.56");
  await page.goto("/#/habitos");
  await expect(
    page.getByRole("heading", { name: "Um pequeno hábito já é um começo." }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Hábitos", exact: true }),
  ).toBeVisible();
});

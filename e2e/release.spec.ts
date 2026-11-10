import { test, expect } from "@playwright/test";

test("primeiros passos podem ser pulados, retomados e não criam transações", async ({
  page,
}) => {
  await page.goto("/#/mais/boas-vindas");
  await page.getByRole("link", { name: "Pular para o conteúdo" }).focus();
  await expect(
    page.getByRole("link", { name: "Pular para o conteúdo" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  await expect(page).toHaveURL(/#\/mais\/boas-vindas$/);
  await page.getByRole("link", { name: /Pular por enquanto/ }).click();
  await expect(
    page.getByRole("heading", { name: "Uma nova fase começa aqui." }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Conhecer meu espaço/ }).click();
  await page.getByLabel("Como você quer ser chamado?").fill("Ana");
  await page
    .getByRole("combobox", { name: "Aparência", exact: true })
    .selectOption("dark");
  await page.getByRole("button", { name: "Preparar meu espaço" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("status").filter({ hasText: /Seu espaço está preparado/ }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Como você quer ser chamado?")).toHaveValue(
    "Ana",
  );
  const counts = await page.evaluate(
    () =>
      new Promise<Record<string, number>>((resolve, reject) => {
        const request = indexedDB.open("minha-virada");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const names = [
            "financeAccounts",
            "financeEntries",
            "financePayments",
            "habits",
            "goals",
          ];
          const result: Record<string, number> = {};
          const tx = db.transaction(names, "readonly");
          for (const name of names) {
            const count = tx.objectStore(name).count();
            count.onsuccess = () => (result[name] = count.result);
          }
          tx.oncomplete = () => {
            db.close();
            resolve(result);
          };
        };
      }),
  );
  expect(Object.values(counts)).toEqual([0, 0, 0, 0, 0]);
  await page.getByRole("link", { name: /Pular por enquanto/ }).click();
  await expect(page.getByRole("heading", { name: "Olá, Ana." })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Registrar check-in", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: /O futuro que/ })).toHaveCount(
    0,
  );
  await page.screenshot({
    path: "test-results/release-daily-home.png",
    fullPage: true,
  });
});

test("edição resiste à navegação e ao voltar até confirmação", async ({
  page,
}) => {
  await page.goto("/#/habitos");
  await page.getByRole("link", { name: /Fazer check-in/ }).click();
  await page
    .getByLabel("Observações (opcional)", { exact: true })
    .fill("Um dia de cada vez");
  await page.getByRole("link", { name: "Início", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Sua edição ainda está aqui.",
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Continuar editando" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByLabel("Observações (opcional)", { exact: true }),
  ).toHaveValue("Um dia de cada vez");
  await page.goBack();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Continuar editando" }).click();
  await expect(
    page.getByLabel("Observações (opcional)", { exact: true }),
  ).toHaveValue("Um dia de cada vez");
  await page.getByRole("link", { name: "Início", exact: true }).click();
  await dialog.getByRole("button", { name: "Descartar e sair" }).click();
  await expect(
    page.getByRole("heading", { name: "Uma nova fase começa aqui." }),
  ).toBeVisible();
  await page.goto("/#/habitos/check-in");
  await expect(
    page.getByLabel("Observações (opcional)", { exact: true }),
  ).toHaveValue("");
});

test("rotas, temas, alvos de toque, zoom e teclado adaptativo", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.goto("/#/financas");
  await page
    .getByRole("button", { name: "Configurar minhas finanças" })
    .click();
  await page
    .getByRole("region", { name: "Formulário financeiro" })
    .getByRole("button", { name: "Confirmar e salvar" })
    .click();
  const routes = [
    "/",
    "/habitos",
    "/habitos/check-in",
    "/habitos/calendario",
    "/habitos/acompanhamento",
    "/habitos/tarefas",
    "/mais/relatorios",
    "/financas",
    "/financas/lancamentos",
    "/financas/contas",
    "/financas/cartoes",
    "/financas/ticket",
    "/financas/vencimentos",
    "/financas/recorrencias",
    "/financas/orcamentos",
    "/financas/projecoes",
    "/financas/relatorios",
    "/metas",
    "/metas/objetivos",
    "/mais/renda",
    "/mais",
    "/mais/configuracoes",
    "/mais/privacidade",
    "/mais/seguranca",
    "/mais/boas-vindas",
  ];
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    for (const width of [320, 393, 760, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of routes) {
        await page.goto("/#" + route);
        await expect(page.locator("main h1")).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `${theme} ${width} ${route}`,
        ).toBe(true);
      }
      if (width === 393) {
        await page.goto("/");
        await page.screenshot({
          path: `test-results/release-home-${theme}.png`,
          fullPage: true,
        });
      }
    }
  }
  await page.setViewportSize({ width: 393, height: 850 });
  await page.goto("/#/mais/boas-vindas");
  const name = page.getByLabel("Como você quer ser chamado?");
  expect((await name.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const nav = page.getByRole("navigation", { name: "Navegação principal" });
  for (const link of await nav.getByRole("link").all())
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await name.focus();
  await page.evaluate(() => {
    Object.defineProperty(visualViewport!, "height", {
      configurable: true,
      value: innerHeight - 300,
    });
    visualViewport!.dispatchEvent(new Event("resize"));
  });
  await expect(page.locator("html")).toHaveClass(/keyboard-open/);
  await expect(nav).not.toBeVisible();
  await name.blur();
  await expect(nav).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

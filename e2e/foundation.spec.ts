import { test, expect } from "@playwright/test";
test("configuração persiste, navegação mobile e shell offline", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Uma nova fase começa aqui." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Preparar meu caminho" }).click();
  await page
    .getByRole("textbox", { name: "Como você quer ser chamado?" })
    .fill("Ana");
  await page.getByRole("button", { name: "Começar minha virada" }).click();
  await expect(
    page.getByRole("heading", { name: "Suas preferências" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Como você quer ser chamado?" }),
  ).toHaveValue("Ana");
  await page.getByRole("link", { name: "Finanças", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Finanças", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Início", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Olá, Ana." })).toBeVisible();
  await page.screenshot({
    path: "test-results/mobile-home.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Olá, Ana." })).toBeVisible();
  await page.getByRole("link", { name: "Hábitos", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Hábitos", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/mobile-offline.png",
    fullPage: true,
  });
});

test("tema escuro, navegação desktop e manifest", async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("navigation", { name: "Navegação principal" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/desktop-dark.png",
    fullPage: true,
  });
  await page.emulateMedia({ colorScheme: "light" });
  await page.screenshot({
    path: "test-results/desktop-light.png",
    fullPage: true,
  });
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ sizes: "192x192" }),
      expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
    ]),
  );
  for (const icon of manifest.icons)
    expect((await request.get("/" + icon.src)).ok()).toBe(true);
  await page.goto("/#/inexistente");
  await expect(
    page.getByRole("heading", { name: "Página não encontrada" }),
  ).toBeVisible();
});

import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync, readdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { resolve, relative, sep } from "node:path";
for (const from of ["0.4.0", "0.5.0"]) {
  test(`upgrade real ${from} → candidata 1.0 mantém banco, preserva edição até confirmação e segue offline`, async ({
    page,
    context,
  }) => {
    test.setTimeout(90000);
    const previous = JSON.parse(
      gunzipSync(readFileSync(`e2e/fixtures/pwa-${from}.json.gz`)).toString(),
    ) as Record<string, string>;
    const current: Record<string, Buffer> = {};
    for (const file of readdirSync("dist", {
      recursive: true,
      withFileTypes: true,
    }))
      if (file.isFile()) {
        const absolute = resolve(file.parentPath, file.name);
        current[relative(resolve("dist"), absolute).split(sep).join("/")] =
          readFileSync(absolute);
      }
    let upgraded = false;
    let workerEpoch = 0;
    const server = createServer((request, response) => {
      const path =
        (request.url ?? "/").split("?")[0].replace(/^\//, "") || "index.html";
      const body =
        upgraded && Object.hasOwn(current, path)
          ? current[path]
          : Object.hasOwn(previous, path)
            ? Buffer.from(previous[path], "base64")
            : undefined;
      if (!body) {
        response.writeHead(404);
        response.end();
        return;
      }
      const ext = path.split(".").at(-1) ?? "";
      const types: Record<string, string> = {
        html: "text/html; charset=utf-8",
        js: "application/javascript",
        css: "text/css",
        png: "image/png",
        woff2: "font/woff2",
        woff: "font/woff",
        webmanifest: "application/manifest+json",
      };
      response.writeHead(200, {
        "Content-Type": types[ext] ?? "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      response.end(
        path === "sw.js" && workerEpoch
          ? Buffer.concat([
              body,
              Buffer.from("\n/* phase5 update test " + workerEpoch + " */"),
            ])
          : body,
      );
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("test server unavailable");
    const origin = "http://127.0.0.1:" + address.port;
    try {
      await page.goto(origin + "/#/mais/configuracoes");
      await page
        .getByRole("textbox", { name: "Como você quer ser chamado?" })
        .fill("Perfil de atualização");
      await page.getByRole("button", { name: "Começar minha virada" }).click();
      await expect(
        page.getByRole("button", { name: "Salvar preferências" }),
      ).toBeVisible();
      await page.goto(origin + "/#/habitos/check-in");
      await page.getByLabel("Houve consumo de maconha?").selectOption("false");
      await page
        .getByLabel("Gatilhos percebidos (opcional)")
        .fill("Histórico privado de atualização");
      await page
        .getByRole("button", { name: "Salvar check-in", exact: true })
        .click();
      await expect(page.getByRole("status")).toContainText(
        "Check-in salvo neste dispositivo.",
      );
      await page.evaluate(async () => {
        await navigator.serviceWorker.ready;
      });
      await page.waitForFunction(() => !!navigator.serviceWorker.controller);
      await page
        .getByLabel("Gatilhos percebidos (opcional)")
        .fill("Rascunho que precisa ser salvo");
      upgraded = true;
      await page.evaluate(async () => {
        await (await navigator.serviceWorker.getRegistration())?.update();
      });
      await expect(
        page.getByRole("button", { name: "Atualizar", exact: true }),
      ).toBeVisible({ timeout: 20000 });
      await expect(
        page.getByLabel("Gatilhos percebidos (opcional)"),
      ).toHaveValue("Rascunho que precisa ser salvo");
      // The old application remains usable while the new worker waits.
      await page
        .getByRole("button", { name: "Salvar check-in", exact: true })
        .click();
      await expect(page.getByRole("status")).toContainText(
        "Check-in salvo neste dispositivo.",
      );
      await page
        .getByRole("button", { name: "Atualizar", exact: true })
        .click();
      if (from === "0.5.0")
        await page
          .getByRole("button", {
            name: "Já salvei, atualizar agora",
            exact: true,
          })
          .click();
      // v0.4.0's helper can activate an external worker without reloading.
      // Reopening after activation is the supported transition from that archived build.
      await page.waitForFunction(async () => {
        const r = await navigator.serviceWorker.getRegistration();
        return !r?.waiting && r?.active?.state === "activated";
      });
      await page.reload();
      await page.waitForFunction(
        () =>
          !!document.querySelector(
            'meta[http-equiv="Content-Security-Policy"]',
          ),
      );
      await expect(
        page.getByLabel("Gatilhos percebidos (opcional)"),
      ).toHaveValue("Rascunho que precisa ser salvo");
      // New route only exists in v0.5.0; native schema stays at v40.
      await page.goto(origin + "/#/mais/seguranca");
      await expect(
        page.getByRole("heading", { name: "Seus dados e segurança." }),
      ).toBeVisible();
      const version = await page.evaluate(
        () =>
          new Promise<number>((r, reject) => {
            const req = indexedDB.open("minha-virada");
            req.onerror = () => reject(req.error);
            req.onsuccess = () => {
              r(req.result.version);
              req.result.close();
            };
          }),
      );
      expect(version).toBe(40);
      await page.goto(origin + "/#/mais/configuracoes");
      await expect(
        page.getByRole("textbox", { name: "Como você quer ser chamado?" }),
      ).toHaveValue("Perfil de atualização");
      await page.goto(origin + "/#/habitos/check-in");
      await page
        .getByLabel("Gatilhos percebidos (opcional)")
        .fill("Rascunho preservado pela versão nova");
      workerEpoch++;
      await page.evaluate(async () => {
        await (await navigator.serviceWorker.getRegistration())?.update();
      });
      await expect(
        page.getByRole("button", { name: "Atualizar", exact: true }),
      ).toBeVisible({ timeout: 20000 });
      // Simulate another tab activating the waiting worker: this tab must keep its draft.
      await page.evaluate(async () => {
        (await navigator.serviceWorker.getRegistration())?.waiting?.postMessage(
          {
            type: "SKIP_WAITING",
          },
        );
      });
      await expect(
        page.getByText(
          "A versão nova está pronta. Salve sua edição e escolha quando reabrir o aplicativo.",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        page.getByLabel("Gatilhos percebidos (opcional)"),
      ).toHaveValue("Rascunho preservado pela versão nova");
      await page
        .getByRole("button", { name: "Atualizar", exact: true })
        .click();
      await expect(
        page.getByRole("alertdialog", { name: "Atualizar aplicativo" }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Continuar editando", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Salvar check-in", exact: true })
        .click();
      await expect(
        page
          .getByRole("status")
          .filter({ hasText: "Check-in salvo neste dispositivo." }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Atualizar", exact: true })
        .click();
      await Promise.all([
        page.waitForEvent("load"),
        page
          .getByRole("button", {
            name: "Já salvei, atualizar agora",
            exact: true,
          })
          .click(),
      ]);
      await expect(
        page.getByLabel("Gatilhos percebidos (opcional)"),
      ).toHaveValue("Rascunho preservado pela versão nova");
      await page.goto(origin + "/#/mais/configuracoes");
      await page.evaluate(async () => {
        await navigator.serviceWorker.ready;
      });
      await page.waitForFunction(() => !!navigator.serviceWorker.controller);
      await context.setOffline(true);
      await page.reload();
      await expect(
        page.getByRole("textbox", { name: "Como você quer ser chamado?" }),
      ).toHaveValue("Perfil de atualização");
      await page
        .getByRole("link", { name: "Seus dados e segurança →", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Seus dados e segurança." }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () =>
            !!document
              .querySelector('meta[http-equiv="Content-Security-Policy"]')
              ?.getAttribute("content")
              ?.includes("script-src 'self'"),
        ),
      ).toBe(true);
    } finally {
      await context.setOffline(false);
      await context.close();
      server.closeAllConnections();
      await new Promise<void>((r, reject) =>
        server.close((error) => (error ? reject(error) : r())),
      );
    }
  });
}

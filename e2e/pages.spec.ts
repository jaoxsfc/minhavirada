import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve, extname, sep } from "node:path";

test("artefato Pages em subdiretório mantém rotas, manifest, recursos e offline", async ({
  browser,
}) => {
  test.setTimeout(120000);
  const output = resolve("test-results/pages-dist");
  execFileSync(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "build",
      "--base=/minhavirada/",
      `--outDir=${output}`,
    ],
    { stdio: "pipe", timeout: 60000 },
  );
  const types: Record<string, string> = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".webmanifest": "application/manifest+json",
    ".png": "image/png",
    ".woff2": "font/woff2",
  };
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://local");
    if (!url.pathname.startsWith("/minhavirada/")) {
      res.writeHead(404);
      res.end();
      return;
    }
    const relative =
      decodeURIComponent(url.pathname.slice("/minhavirada/".length)) ||
      "index.html";
    const path = resolve(output, relative);
    if (!path.startsWith(output + sep) || !existsSync(path)) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, {
      "Content-Type": types[extname(path)] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(readFileSync(path));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing address");
  const origin = `http://127.0.0.1:${address.port}`;
  const context = await browser.newContext({
    viewport: { width: 393, height: 851 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    const failures: string[] = [];
    page.on("response", (r) => {
      if (r.status() >= 400) failures.push(r.url());
    });
    await page.goto(origin + "/minhavirada/#/mais/boas-vindas");
    await expect(
      page.getByRole("heading", { name: "Um espaço para sua virada." }),
    ).toBeVisible();
    const manifest = await (
      await page.request.get(origin + "/minhavirada/manifest.webmanifest")
    ).json();
    expect(manifest.start_url).toBe("./");
    expect(manifest.scope).toBe("./");
    expect(manifest.display).toBe("standalone");
    for (const icon of manifest.icons)
      expect(
        (
          await page.request.get(
            new URL(icon.src, origin + "/minhavirada/").href,
          )
        ).ok(),
      ).toBe(true);
    await page.getByLabel("Como você quer ser chamado?").fill("Perfil Pages");
    await page.getByRole("button", { name: "Preparar meu espaço" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: /Seu espaço está preparado/ }),
    ).toBeVisible();
    await page.getByRole("link", { name: /Pular por enquanto/ }).click();
    await expect(
      page.getByRole("heading", { name: "Olá, Perfil Pages." }),
    ).toBeVisible();
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    expect(
      await page.evaluate(
        async () => (await navigator.serviceWorker.getRegistration())?.scope,
      ),
    ).toBe(origin + "/minhavirada/");
    await page.goto(origin + "/minhavirada/#/mais/seguranca");
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Seus dados e segurança." }),
    ).toBeVisible();
    await context.setOffline(true);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Seus dados e segurança." }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Início", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Olá, Perfil Pages." }),
    ).toBeVisible();
    expect(failures).toEqual([]);
    const precache = readFileSync(resolve(output, "sw.js"), "utf8");
    expect(precache).not.toMatch(
      /backup-v[34]|fixtures|Pasted|test-results|\.env/,
    );
  } finally {
    await context.close();
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
});

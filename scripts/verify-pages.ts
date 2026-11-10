import { chromium, devices } from "@playwright/test";
import { productionScripts } from "./check-pages-build.ts";

const input = process.argv[2];
if (!input)
  throw new Error(
    "Informe a URL: npm run verify:pages -- https://jaoxsfc.github.io/minhavirada/",
  );
const target = new URL(input);
if (
  target.username ||
  target.password ||
  target.search ||
  target.hash ||
  !target.pathname.endsWith("/")
)
  throw new Error(
    "Use a URL base, sem credenciais, query ou hash, terminada em /.",
  );
if (
  target.protocol !== "https:" &&
  !["localhost", "127.0.0.1"].includes(target.hostname)
)
  throw new Error("A publicação precisa usar HTTPS.");
const attempts = Math.min(
  6,
  Math.max(1, Number(process.env.PAGES_VERIFY_ATTEMPTS) || 1),
);
let passed = false;
for (let attempt = 1; attempt <= attempts; attempt++) {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      ...devices["Pixel 7"],
      locale: "pt-BR",
      timezoneId: "America/Sao_Paulo",
      serviceWorkers: "allow",
    });
    const page = await context.newPage();
    const failures: string[] = [];
    page.on("response", (response) => {
      if (response.status() >= 400)
        failures.push(`${response.status()} ${response.url()}`);
    });
    page.on("requestfailed", (request) =>
      failures.push(`Falha de rede: ${request.url()}`),
    );
    page.on("pageerror", () =>
      failures.push("Erro JavaScript durante renderização."),
    );
    const response = await page.goto(target.href, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    if (!response?.ok())
      throw new Error(`HTML público HTTP ${response?.status()}`);
    const scripts = productionScripts(await response.text(), target.pathname);
    for (const script of scripts) {
      const resource = await context.request.get(new URL(script, target).href);
      if (
        !resource.ok() ||
        !/javascript/.test(resource.headers()["content-type"] ?? "")
      )
        throw new Error(`JavaScript compilado indisponível: ${script}`);
    }
    await page
      .getByRole("heading", { name: "Uma nova fase começa aqui.", exact: true })
      .waitFor({ timeout: 20000 });
    await page
      .getByRole("navigation", { name: "Navegação principal" })
      .waitFor();
    const manifestLink = await page
      .locator('link[rel="manifest"]')
      .getAttribute("href");
    if (!manifestLink) throw new Error("Manifest não referenciado.");
    const manifestUrl = new URL(manifestLink, target);
    const manifestResponse = await context.request.get(manifestUrl.href);
    if (!manifestResponse.ok())
      throw new Error("Manifest público indisponível.");
    const manifest = await manifestResponse.json();
    for (const key of ["start_url", "scope"])
      if (new URL(manifest[key], manifestUrl).href !== target.href)
        throw new Error(`Manifest ${key} incorreto.`);
    for (const icon of manifest.icons) {
      const iconResponse = await context.request.get(
        new URL(icon.src, manifestUrl).href,
      );
      if (!iconResponse.ok()) throw new Error("Ícone público indisponível.");
    }
    await page.waitForFunction(
      async () => !!(await navigator.serviceWorker.getRegistration())?.active,
      undefined,
      { timeout: 20000 },
    );
    await page.waitForFunction(
      () => !!navigator.serviceWorker.controller,
      undefined,
      { timeout: 20000 },
    );
    const scope = await page.evaluate(
      async () => (await navigator.serviceWorker.getRegistration())?.scope,
    );
    if (scope !== target.href)
      throw new Error("Service Worker fora do escopo publicado.");
    await page.getByRole("link", { name: "Hábitos", exact: true }).click();
    await page.getByRole("heading", { name: "Hábitos", exact: true }).waitFor();
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Hábitos", exact: true }).waitFor();
    if (failures.length) throw new Error(failures.join("\n"));
    console.log(
      JSON.stringify({
        url: target.href,
        scripts,
        rendered: true,
        initial404s: 0,
        manifest: true,
        serviceWorkerScope: scope,
        hashRouteReload: true,
      }),
    );
    passed = true;
    break;
  } catch (error) {
    console.error(
      `Verificação ${attempt}/${attempts}: ${error instanceof Error ? error.message : "falha"}`,
    );
  } finally {
    await browser.close();
  }
  if (attempt < attempts)
    await new Promise((resolve) => setTimeout(resolve, 5000));
}
if (!passed) process.exitCode = 1;

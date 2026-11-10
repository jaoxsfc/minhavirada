import { readFileSync, existsSync } from "node:fs";
import { resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

export function productionScripts(html: string, base = "/minhavirada/") {
  if (/\/src\/|\.(?:tsx?|jsx)(?:["'?\s>]|$)/i.test(html)) {
    throw new Error(
      "HTML de desenvolvimento: referências a fontes não podem ser publicadas.",
    );
  }
  const scripts = [
    ...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi),
  ].map((match) => match[1]);
  if (
    !scripts.length ||
    scripts.some(
      (src) => !src.startsWith(base + "assets/") || !src.endsWith(".js"),
    )
  ) {
    throw new Error(
      `O HTML precisa carregar JavaScript compilado em ${base}assets/.`,
    );
  }
  return scripts;
}

export function checkPagesBuild(directory = "dist", base = "/minhavirada/") {
  const root = resolve(directory);
  const html = readFileSync(resolve(root, "index.html"), "utf8");
  const scripts = productionScripts(html, base);
  const resources = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)].map(
    (match) => match[1],
  );
  for (const resource of resources) {
    if (!resource.startsWith(base))
      throw new Error(`Recurso fora da base: ${resource}`);
    const file = resolve(root, resource.slice(base.length));
    if (!file.startsWith(root + sep) || !existsSync(file))
      throw new Error(`Recurso compilado ausente: ${resource}`);
  }
  const manifest = JSON.parse(
    readFileSync(resolve(root, "manifest.webmanifest"), "utf8"),
  );
  const origin = "https://example.invalid" + base;
  if (
    new URL(manifest.start_url, origin).pathname !== base ||
    new URL(manifest.scope, origin).pathname !== base
  ) {
    throw new Error("Manifest fora do escopo do repositório.");
  }
  if (!existsSync(resolve(root, "sw.js")))
    throw new Error("Service Worker ausente.");
  return {
    base,
    scripts,
    resources: resources.length,
    manifest: true,
    serviceWorker: true,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  console.log(JSON.stringify(checkPagesBuild(), null, 2));
}

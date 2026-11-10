import { expect, it } from "vitest";
import { productionScripts } from "../../scripts/check-pages-build";

it("aceita somente módulos compilados sob a base do repositório", () => {
  expect(
    productionScripts(
      '<script type="module" src="/minhavirada/assets/index-abc.js"></script>',
    ),
  ).toEqual(["/minhavirada/assets/index-abc.js"]);
});
it.each([
  '<script type="module" src="/src/main.tsx"></script>',
  '<script type="module" src="/minhavirada/src/main.tsx"></script>',
  '<script type="module" src="/assets/index.js"></script>',
  '<script type="module" src="/outro/assets/index.js"></script>',
  '<div id="root"></div>',
])(
  "recusa HTML que causaria tela branca ou arquivo-fonte publicado: %s",
  (html) => {
    expect(() => productionScripts(html)).toThrow();
  },
);

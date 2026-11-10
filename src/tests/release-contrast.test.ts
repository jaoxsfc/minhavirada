import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const css = readFileSync("src/styles/refinement.css", "utf8");
function token(theme: "light" | "dark", name: string) {
  const block =
    theme === "light"
      ? css.split(":root {")[1].split("}")[0]
      : css.split('[data-theme="dark"] {')[1].split("}")[0];
  return block.match(new RegExp(`--${name}: (#[0-9a-f]+)`))![1];
}
function luminance(hex: string) {
  return [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
    .reduce((sum, x, i) => sum + x * [0.2126, 0.7152, 0.0722][i], 0);
}
function ratio(a: string, b: string) {
  const [low, high] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (high + 0.05) / (low + 0.05);
}
it.each(["light", "dark"] as const)(
  "texto secundário, erro e foco contrastam nas superfícies %s",
  (theme) => {
    const backgrounds =
      theme === "light"
        ? ["#f6f3eb", "#fffefa", token(theme, "soft")]
        : ["#101f1a", "#192c24", token(theme, "soft")];
    for (const bg of backgrounds) {
      expect(ratio(token(theme, "muted"), bg)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(token(theme, "danger"), bg)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(token(theme, "focus"), bg)).toBeGreaterThanOrEqual(3);
      expect(ratio(token(theme, "control-border"), bg)).toBeGreaterThanOrEqual(
        3,
      );
      expect(ratio(token(theme, "chart-primary"), bg)).toBeGreaterThanOrEqual(
        3,
      );
      expect(ratio(token(theme, "chart-secondary"), bg)).toBeGreaterThanOrEqual(
        3,
      );
    }
  },
);

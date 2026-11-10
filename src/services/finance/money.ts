export function parseMoney(input: string) {
  const text = input.trim();
  if (!/^-?\d{1,10}([,.]\d{1,2})?$/.test(text))
    throw new Error(
      "Use um valor sem separador de milhar, com até 2 casas decimais.",
    );
  const negative = text.startsWith("-");
  const [whole, fraction = ""] = text
    .replace("-", "")
    .replace(",", ".")
    .split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(result) || result > 100000000000)
    throw new Error("Valor fora do limite.");
  return negative ? -result : result;
}
export function splitInstallments(total: number, count: number) {
  if (
    !Number.isSafeInteger(total) ||
    total <= 0 ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > 120 ||
    count > total
  )
    throw new Error("Parcelamento inválido.");
  const base = Math.floor(total / count),
    rest = total % count;
  return Array.from({ length: count }, (_, i) => base + (i < rest ? 1 : 0));
}

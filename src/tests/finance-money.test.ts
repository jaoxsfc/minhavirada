import { describe, expect, it } from "vitest";
import { parseMoney, splitInstallments } from "../services/finance/money";
import {
  invoiceCycle,
  recurrenceDates,
  nextPayday,
} from "../services/finance/dates";
import { createCsv } from "../lib/csv";
describe("Centavos inteiros", () => {
  it("converte sem arredondar ponto flutuante de entrada", () => {
    expect(parseMoney("246,42")).toBe(24642);
    expect(parseMoney("0.29")).toBe(29);
    expect(parseMoney("-12,03")).toBe(-1203);
  });
  it.each(["1.234,56", "NaN", "Infinity", "-", "1,001", "", "1e3"])(
    "rejeita entrada inválida %s",
    (value) => expect(() => parseMoney(value)).toThrow(),
  );
  it("distribui resíduos sem perder centavos", () => {
    expect(splitInstallments(10001, 3)).toEqual([3334, 3334, 3333]);
    for (let n = 1; n <= 120; n++) {
      const parts = splitInstallments(10001, n);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(10001);
      expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1);
    }
  });
  it("rejeita parcelas de zero centavos e totais fracionários", () => {
    expect(() => splitInstallments(1, 2)).toThrow();
    expect(() => splitInstallments(1.5, 1)).toThrow();
  });
});
describe("Ciclos e recorrência", () => {
  it("inclui o dia do fechamento e muda no dia seguinte", () => {
    expect(invoiceCycle("2024-01-20", 20, 5)).toEqual({
      cycleMonth: "2024-01",
      closingDate: "2024-01-20",
      dueDate: "2024-02-05",
    });
    expect(invoiceCycle("2024-01-21", 20, 5).cycleMonth).toBe("2024-02");
  });
  it("vence no mesmo mês quando o dia vem após o fechamento", () =>
    expect(invoiceCycle("2024-01-10", 10, 25).dueDate).toBe("2024-01-25"));
  it("ajusta datas curtas e preserva o dia âncora nos próximos meses", () => {
    expect(
      recurrenceDates(
        {
          startDate: "2024-01-31",
          endDate: "",
          frequency: "monthly",
          intervalDays: 30,
        },
        "2024-01-01",
        "2024-04-30",
      ),
    ).toEqual(["2024-01-31", "2024-02-29", "2024-03-31", "2024-04-30"]);
  });
  it("gera regras semanais, anuais e personalizadas limitadas pela data final", () => {
    expect(
      recurrenceDates(
        {
          startDate: "2024-01-01",
          endDate: "2024-01-15",
          frequency: "weekly",
          intervalDays: 30,
        },
        "2024-01-01",
        "2024-02-01",
      ),
    ).toEqual(["2024-01-01", "2024-01-08", "2024-01-15"]);
    expect(
      recurrenceDates(
        {
          startDate: "2024-02-29",
          endDate: "",
          frequency: "yearly",
          intervalDays: 30,
        },
        "2025-01-01",
        "2025-12-31",
      ),
    ).toEqual(["2025-02-28"]);
    expect(
      recurrenceDates(
        {
          startDate: "2024-01-01",
          endDate: "",
          frequency: "custom",
          intervalDays: 10,
        },
        "2024-01-02",
        "2024-01-31",
      ),
    ).toEqual(["2024-01-11", "2024-01-21", "2024-01-31"]);
  });
  it("próximo salário usa o próximo mês quando hoje é o dia informado", () => {
    expect(nextPayday("2024-01-31", 31)).toBe("2024-02-29");
  });
  it("protege CSV de fórmulas e aspas sem alterar os centavos originais do banco", () => {
    const csv = createCsv([
      { descricao: "=SUM(A1)", valor: 1000 },
      { descricao: 'texto "com aspas"', valor: -1000 },
    ]);
    expect(csv).toContain("'=SUM(A1)");
    expect(csv).toContain('""com aspas""');
  });
});

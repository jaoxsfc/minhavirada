import { afterEach, beforeEach, expect, it } from "vitest";
import { financeFixture, uid, refDate, type Fixture } from "./finance-fixtures";
import { readFinance } from "../repositories/finance-data";
import {
  saveEntry,
  payTarget,
  saveRule,
  cancelEntry,
  ensureOccurrences,
  saveCard,
  addPurchase,
  saveFinanceSettings,
  saveBudget,
  addBenefit,
} from "../services/finance/commands";
import {
  projectMonths,
  bankBalance,
  untilSalary,
} from "../services/finance/calculations";
import { financeDefaults } from "../features/finance/models";
import { localDate } from "../lib/date";
import { dateAtDay } from "../services/finance/dates";
import { monthShift } from "../lib/calendar";
let f: Fixture;
beforeEach(async () => {
  f = await financeFixture();
});
afterEach(async () => {
  await f.db.delete();
});
it("projeção parte do saldo atual sem descontar novamente contas pagas", async () => {
  await saveEntry(f.entry, uid(), f.db);
  await payTarget(
    {
      id: uid(),
      targetType: "entry",
      targetId: f.entry.id,
      accountId: f.bank.id,
      amount: 10000,
      date: refDate,
      eligibilityConfirmed: false,
    },
    uid(),
    f.db,
  );
  const data = await readFinance(f.db);
  const rows = projectMonths(data, refDate);
  expect(rows).toHaveLength(12);
  expect(rows[0]).toMatchObject({
    opening: 90000,
    expenses: 0,
    closing: 90000,
    alreadyPaid: 10000,
    incomplete: true,
  });
  expect(bankBalance(data, refDate)).toBe(90000);
});
it("receita paga não reaparece como entrada projetada", async () => {
  const e = { ...f.entry, kind: "income" as const, categoryId: f.income.id };
  await saveEntry(e, uid(), f.db);
  await payTarget(
    {
      id: uid(),
      targetType: "entry",
      targetId: e.id,
      accountId: f.bank.id,
      amount: 10000,
      date: refDate,
      eligibilityConfirmed: false,
    },
    uid(),
    f.db,
  );
  const rows = projectMonths(await readFinance(f.db), refDate);
  expect(rows[0]).toMatchObject({
    opening: 110000,
    income: 0,
    closing: 110000,
  });
});
it("mês sem receita preserva zero entradas e sinaliza saldo negativo", async () => {
  await saveEntry({ ...f.entry, amount: 150000 }, uid(), f.db);
  const rows = projectMonths(await readFinance(f.db), refDate);
  expect(rows[0]).toMatchObject({
    income: 0,
    closing: -50000,
    negative: true,
    potentialSaving: 0,
  });
  expect(rows[1].income).toBe(0);
  expect(rows[1].closing).toBe(-50000);
});
it("cenários usam premissas explícitas sem modificar o saldo real", async () => {
  await saveFinanceSettings(
    {
      ...financeDefaults,
      variableEstimate: 10000,
      updatedAt: new Date().toISOString(),
    },
    uid(),
    false,
    f.db,
  );
  await saveEntry(
    {
      ...f.entry,
      kind: "income",
      categoryId: f.income.id,
      amount: 100000,
      dueDate: "2024-01-31",
    },
    uid(),
    f.db,
  );
  const data = await readFinance(f.db);
  expect(projectMonths(data, refDate, "base")[0].closing).toBe(190000);
  expect(projectMonths(data, refDate, "conservative")[0].closing).toBe(179000);
  expect(projectMonths(data, refDate, "optimistic")[0].closing).toBe(201000);
  expect(bankBalance(data, refDate)).toBe(100000);
  expect(projectMonths(data, refDate)[0].incomplete).toBe(false);
});
it("gera ocorrências mensais uma vez e não duplica previsões no cálculo", async () => {
  const rule = {
    id: uid(),
    kind: "income" as const,
    accountId: f.bank.id,
    categoryId: f.income.id,
    description: "Salário previsto",
    amount: 250000,
    startDate: "2024-01-31",
    endDate: "2024-03-31",
    frequency: "monthly" as const,
    intervalDays: 30,
    status: "active" as const,
    entryStatus: "planned" as const,
    revision: 1,
  };
  await saveRule(rule, uid(), localDate(), f.db);
  await ensureOccurrences("2024-01-01", "2024-12-31", f.db);
  await ensureOccurrences("2024-01-01", "2024-12-31", f.db);
  const data = await readFinance(f.db);
  expect(data.entries).toHaveLength(3);
  expect(data.occurrences).toHaveLength(3);
  const rows = projectMonths(data, refDate);
  expect(rows[0].income).toBe(250000);
  expect(rows[1].income).toBe(250000);
  expect(rows[3].income).toBe(0);
  expect(bankBalance(data, refDate)).toBe(100000);
});
it("projeta recorrências conhecidas sem depender da materialização no banco", async () => {
  const rule = {
    id: uid(),
    kind: "expense" as const,
    accountId: f.bank.id,
    categoryId: f.expense.id,
    description: "Conta fixa",
    amount: 10000,
    startDate: "2024-01-05",
    endDate: "2024-03-05",
    frequency: "monthly" as const,
    intervalDays: 30,
    status: "active" as const,
    entryStatus: "planned" as const,
    revision: 1,
  };
  await saveRule(rule, uid(), localDate(), f.db);
  const data = await readFinance(f.db);
  expect(projectMonths(data, refDate)[0].expenses).toBe(10000);
  expect(projectMonths(data, refDate)[3].expenses).toBe(0);
  expect(await f.db.financeEntries.count()).toBe(0);
});
it("edição das próximas ocorrências mantém as pagas e as antigas", async () => {
  const today = localDate();
  const end = dateAtDay(monthShift(today.slice(0, 7), 2), 31);
  const rule = {
    id: uid(),
    kind: "expense" as const,
    accountId: f.bank.id,
    categoryId: f.expense.id,
    description: "Mensal",
    amount: 10000,
    startDate: today,
    endDate: "",
    frequency: "monthly" as const,
    intervalDays: 30,
    status: "active" as const,
    entryStatus: "pending" as const,
    revision: 1,
  };
  await saveRule(rule, uid(), today, f.db);
  await ensureOccurrences(today, end, f.db);
  const first = (await readFinance(f.db)).entries.find(
    (e) => e.dueDate === today,
  )!;
  await payTarget(
    {
      id: uid(),
      targetType: "entry",
      targetId: first.id,
      accountId: f.bank.id,
      amount: 10000,
      date: today,
      eligibilityConfirmed: false,
    },
    uid(),
    f.db,
  );
  await saveRule({ ...rule, amount: 20000, revision: 2 }, uid(), today, f.db);
  const entries = (await readFinance(f.db)).entries;
  expect(entries.find((e) => e.id === first.id)?.amount).toBe(10000);
  expect(
    entries.filter((e) => e.id !== first.id).every((e) => e.amount === 20000),
  ).toBe(true);
});
it("parcelas terminam no mês certo e reduzem compromissos futuros", async () => {
  await saveCard(f.card, uid(), f.db);
  await addPurchase(f.purchase, uid(), f.db);
  const rows = projectMonths(await readFinance(f.db), refDate);
  expect(rows[0].expenses).toBe(0);
  expect(rows[1].expenses).toBe(3334);
  expect(rows[2].expenses).toBe(3334);
  expect(rows[3]).toMatchObject({ expenses: 3333, lastInstallments: 1 });
  expect(rows[4].expenses).toBe(0);
});
it("ticket acumula separado e orçamento estima apenas a parte ainda não registrada", async () => {
  await saveBudget(
    {
      id: uid(),
      month: "2024-01",
      categoryId: f.food.id,
      scope: "benefit",
      amount: 35000,
    },
    uid(),
    f.db,
  );
  await addBenefit(
    {
      id: uid(),
      accountId: f.benefit.id,
      kind: "consume",
      categoryId: f.food.id,
      amount: 10000,
      description: "Alimentação confirmada",
      date: refDate,
      status: "active",
      eligibilityConfirmed: false,
    },
    uid(),
    f.db,
  );
  const row = projectMonths(await readFinance(f.db), refDate)[0];
  expect(row).toMatchObject({
    benefitClosing: 85000,
    benefitBudgetEstimate: 25000,
    closing: 100000,
  });
});
it("até o próximo salário usa compromissos sem somar limite ou ticket", async () => {
  await saveEntry(f.entry, uid(), f.db);
  const summary = untilSalary(await readFinance(f.db), refDate);
  expect(summary.pending).toBe(10000);
  expect(summary.afterKnownBills).toBe(90000);
});

it("reativar uma regra recupera previsões automáticas, preservando cancelamentos manuais", async () => {
  const today = localDate();
  const end = dateAtDay(monthShift(today.slice(0, 7), 2), 31);
  const rule = {
    id: uid(),
    kind: "expense" as const,
    accountId: f.bank.id,
    categoryId: f.expense.id,
    description: "Repetição",
    amount: 1000,
    startDate: today,
    endDate: "",
    frequency: "monthly" as const,
    intervalDays: 30,
    status: "active" as const,
    entryStatus: "planned" as const,
    revision: 1,
  };
  await saveRule(rule, uid(), today, f.db);
  await ensureOccurrences(today, end, f.db);
  const rows = (await readFinance(f.db)).entries.sort((a, b) =>
    a.dueDate.localeCompare(b.dueDate),
  );
  await cancelEntry(rows[1].id, uid(), f.db);
  await saveRule(
    { ...rule, status: "archived", revision: 2 },
    uid(),
    today,
    f.db,
  );
  await saveRule({ ...rule, revision: 3 }, uid(), today, f.db);
  const after = (await readFinance(f.db)).entries;
  expect(after.find((e) => e.id === rows[0].id)?.status).toBe("planned");
  expect(after.find((e) => e.id === rows[1].id)?.status).toBe("cancelled");
  expect(after.find((e) => e.id === rows[2].id)?.status).toBe("planned");
});

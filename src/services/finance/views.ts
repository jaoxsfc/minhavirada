import type { FinanceData } from "../../features/finance/models";
import {
  accountBalance,
  bankBalance,
  benefitBalance,
  commitments,
  untilSalary,
  projectMonths,
  cashFlow,
  allInvoices,
  entryRemaining,
  invoiceBalances,
  competenceExpenses,
  budgetUsage,
} from "./calculations";
import { monthRange, monthShift } from "../../lib/calendar";
export function overviewModel(data: FinanceData, today: string) {
  const month = monthRange(today.slice(0, 7));
  return {
    hasBank: data.accounts.some((a) => a.type !== "benefit"),
    hasBenefit: data.accounts.some((a) => a.type === "benefit"),
    bank: bankBalance(data, today),
    benefit: benefitBalance(data, today),
    pending: commitments(data, "0000-01-01", "9999-12-31"),
    salary: untilSalary(data, today),
    projected: projectMonths(data, today)[0],
    paid: cashFlow(data, month.from, today)
      .filter((p) => p.amount < 0)
      .reduce((n, p) => n - p.amount, 0),
    savings: data.accounts
      .filter((a) => a.type === "savings")
      .reduce((n, a) => n + accountBalance(data, a.id, today), 0),
    upcoming: dueRows(data)
      .filter(
        (r) =>
          r.kind === "expense" &&
          r.remaining > 0 &&
          (!("accountId" in r) ||
            data.accounts.find((a) => a.id === r.accountId)?.type !==
              "benefit"),
      )
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5),
  };
}
export function dueRows(data: FinanceData) {
  return [
    ...data.entries
      .filter((e) => e.status !== "cancelled")
      .map((e) => ({
        id: e.id,
        date: e.dueDate,
        title:
          (data.accounts.find((a) => a.id === e.accountId)?.type === "benefit"
            ? "Ticket · "
            : "") + e.description,
        accountId: e.accountId,
        remaining: entryRemaining(data, e),
        kind: e.kind,
        type: "entry" as const,
      })),
    ...allInvoices(data).map((i) => ({
      id: i.id,
      date: i.dueDate,
      title: `Fatura · ${data.cards.find((c) => c.id === i.cardId)?.name}`,
      remaining: i.remaining,
      kind: "expense" as const,
      type: "invoice" as const,
    })),
  ];
}
export function cardSummary(data: FinanceData, id: string) {
  const card = data.cards.find((c) => c.id === id)!;
  const invoices = invoiceBalances(data, id);
  const outstanding = invoices.reduce((n, i) => n + i.remaining, 0);
  return {
    outstanding,
    availableLimit: Math.max(0, card.limit - outstanding),
    credit: invoices.at(-1)?.creditBalance ?? 0,
  };
}
export function budgetSummary(
  data: FinanceData,
  month: string,
  categoryId: string,
  scope: "bank" | "benefit",
  budget: number,
) {
  const used = budgetUsage(data, month, categoryId, scope);
  return { used, margin: budget - used, over: Math.max(0, used - budget) };
}
export function categoryTotals(
  data: FinanceData,
  from: string,
  to: string,
  accountId = "all",
  categoryId = "all",
) {
  const rows = competenceExpenses(data, from, to).filter(
    (e) =>
      (accountId === "all" || e.accountId === accountId) &&
      (categoryId === "all" || e.categoryId === categoryId),
  );
  return {
    rows,
    categories: data.categories
      .map((c) => ({
        name: c.name,
        amount: rows
          .filter((e) => e.categoryId === c.id)
          .reduce((n, e) => n + e.amount, 0),
      }))
      .filter((c) => c.amount !== 0)
      .sort((a, b) => b.amount - a.amount),
  };
}
export function monthlyCashHistory(data: FinanceData, month: string) {
  return Array.from({ length: 12 }, (_, i) => {
    const label = monthShift(month, -i);
    const range = monthRange(label);
    const flows = cashFlow(data, range.from, range.to);
    return {
      month: label,
      income: flows
        .filter((f) => f.amount > 0)
        .reduce((n, f) => n + f.amount, 0),
      paid: flows.filter((f) => f.amount < 0).reduce((n, f) => n - f.amount, 0),
    };
  });
}

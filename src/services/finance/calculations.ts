import type { FinanceData, FinanceEntry } from "../../features/finance/models";
import { monthShift, monthRange } from "../../lib/calendar";
import { recurrenceDates } from "./dates";
import { nextPayday } from "./dates";
export function paidFor(
  data: FinanceData,
  type: "entry" | "invoice",
  id: string,
  asOf = "9999-12-31",
) {
  return data.payments
    .filter(
      (p) =>
        p.targetType === type &&
        p.targetId === id &&
        p.status === "active" &&
        p.date <= asOf,
    )
    .reduce((n, p) => n + p.amount, 0);
}
export function entryRemaining(
  data: FinanceData,
  entry: FinanceEntry,
  asOf = "9999-12-31",
) {
  return entry.status === "cancelled"
    ? 0
    : Math.max(0, entry.amount - paidFor(data, "entry", entry.id, asOf));
}
export function entryStatus(data: FinanceData, entry: FinanceEntry) {
  if (entry.status === "cancelled") return "cancelled";
  const paid = paidFor(data, "entry", entry.id);
  return paid >= entry.amount ? "paid" : paid > 0 ? "partial" : entry.status;
}
export function accountBalance(data: FinanceData, id: string, asOf: string) {
  const account = data.accounts.find((a) => a.id === id);
  if (!account || account.openingDate > asOf) return 0;
  const validDate = (date: string) =>
    date >= account.openingDate && date <= asOf;
  if (account.type === "benefit")
    return (
      account.openingBalance +
      data.benefits
        .filter(
          (b) =>
            b.accountId === id && b.status === "active" && validDate(b.date),
        )
        .reduce(
          (sum, b) => sum + (b.kind === "consume" ? -b.amount : b.amount),
          0,
        )
    );
  let balance = account.openingBalance;
  for (const payment of data.payments.filter(
    (p) => p.accountId === id && p.status === "active" && validDate(p.date),
  )) {
    if (payment.targetType === "invoice") balance -= payment.amount;
    else {
      const entry = data.entries.find((e) => e.id === payment.targetId);
      if (entry)
        balance += entry.kind === "income" ? payment.amount : -payment.amount;
    }
  }
  for (const transfer of data.transfers.filter(
    (t) => t.status === "active" && validDate(t.date),
  )) {
    if (transfer.fromId === id) balance -= transfer.amount;
    if (transfer.toId === id) balance += transfer.amount;
  }
  return balance;
}
export function bankBalance(data: FinanceData, asOf: string) {
  return data.accounts
    .filter((a) => a.type !== "benefit")
    .reduce((n, a) => n + accountBalance(data, a.id, asOf), 0);
}
export function benefitBalance(data: FinanceData, asOf: string) {
  return data.accounts
    .filter((a) => a.type === "benefit")
    .reduce((n, a) => n + accountBalance(data, a.id, asOf), 0);
}
export function invoiceBalances(
  data: FinanceData,
  cardId: string,
  asOf = "9999-12-31",
) {
  let carry = 0;
  return data.invoices
    .filter((i) => i.cardId === cardId)
    .sort((a, b) => a.cycleMonth.localeCompare(b.cycleMonth))
    .map((invoice) => {
      const installments = data.installments.filter(
        (i) =>
          i.invoiceId === invoice.id &&
          data.purchases.some((p) => p.id === i.purchaseId && p.date <= asOf),
      );
      const charges = installments.reduce((n, i) => n + i.amount, 0);
      const credits = data.credits
        .filter((c) => c.invoiceId === invoice.id && c.date <= asOf)
        .reduce((n, c) => n + c.amount, 0);
      const paid = paidFor(data, "invoice", invoice.id, asOf);
      const raw = charges - credits - paid;
      const appliedCredit = Math.min(carry, Math.max(0, raw));
      const remaining = Math.max(0, raw - carry);
      carry = Math.max(0, carry - raw);
      return {
        ...invoice,
        charges,
        credits,
        paid,
        appliedCredit,
        remaining,
        creditBalance: carry,
      };
    });
}
export function allInvoices(data: FinanceData, asOf = "9999-12-31") {
  return data.cards.flatMap((c) => invoiceBalances(data, c.id, asOf));
}
export function commitments(
  data: FinanceData,
  from: string,
  to: string,
  bankOnly = true,
) {
  const bankIds = new Set(
    data.accounts
      .filter((a) => !bankOnly || a.type !== "benefit")
      .map((a) => a.id),
  );
  return (
    data.entries
      .filter(
        (e) =>
          e.kind === "expense" &&
          e.status !== "cancelled" &&
          e.dueDate >= from &&
          e.dueDate <= to &&
          bankIds.has(e.accountId),
      )
      .reduce((n, e) => n + entryRemaining(data, e), 0) +
    (bankOnly
      ? allInvoices(data)
          .filter((i) => i.dueDate >= from && i.dueDate <= to)
          .reduce((n, i) => n + i.remaining, 0)
      : 0)
  );
}
export function untilSalary(data: FinanceData, today: string) {
  const payday = nextPayday(today, data.settings?.payday ?? 5);
  const earliest = data.rules.reduce(
    (min, r) => (r.startDate < min ? r.startDate : min),
    today,
  );
  const forecast = forecastData(data, earliest, payday);
  const pending = commitments(forecast, "0000-01-01", payday);
  return {
    payday,
    pending,
    afterKnownBills: bankBalance(data, today) - pending,
  };
}
export interface ExpenseRow {
  id: string;
  date: string;
  description: string;
  categoryId: string;
  amount: number;
  source: string;
  accountId?: string;
}
export function competenceExpenses(
  data: FinanceData,
  from: string,
  to: string,
  scope: "bank" | "benefit" = "bank",
): ExpenseRow[] {
  if (scope === "benefit")
    return data.benefits
      .filter(
        (b) =>
          b.kind === "consume" &&
          b.status === "active" &&
          b.date >= from &&
          b.date <= to,
      )
      .map((b) => ({
        id: b.id,
        date: b.date,
        description: b.description,
        categoryId: b.categoryId ?? "",
        amount: b.amount,
        source: "Ticket",
        accountId: b.accountId,
      }));
  const rows: ExpenseRow[] = data.entries
    .filter(
      (e) =>
        e.kind === "expense" &&
        e.status !== "cancelled" &&
        e.competence >= from &&
        e.competence <= to &&
        data.accounts.some((a) => a.id === e.accountId && a.type !== "benefit"),
    )
    .map((e) => ({
      id: e.id,
      date: e.competence,
      description: e.description,
      categoryId: e.categoryId,
      amount: e.amount,
      source: "Conta (competência)",
      accountId: e.accountId,
    }));
  for (const p of data.purchases.filter((p) => p.date >= from && p.date <= to))
    rows.push({
      id: p.id,
      date: p.date,
      description: p.description,
      categoryId: p.categoryId,
      amount: p.amount,
      source: "Compra no cartão",
      accountId: data.cards.find((c) => c.id === p.cardId)?.accountId,
    });
  for (const credit of data.credits.filter(
    (c) => c.date >= from && c.date <= to,
  )) {
    const purchase = data.purchases.find((p) => p.id === credit.purchaseId);
    if (purchase)
      rows.push({
        id: credit.id,
        date: credit.date,
        description: `Estorno · ${purchase.description}`,
        categoryId: purchase.categoryId,
        amount: -credit.amount,
        source: "Estorno no cartão",
        accountId: data.cards.find((c) => c.id === purchase.cardId)?.accountId,
      });
  }
  return rows;
}
export function cashFlow(data: FinanceData, from: string, to: string) {
  return data.payments
    .filter(
      (p) =>
        p.status === "active" &&
        p.date >= from &&
        p.date <= to &&
        data.accounts.some((a) => a.id === p.accountId && a.type !== "benefit"),
    )
    .map((p) => {
      const entry =
        p.targetType === "entry"
          ? data.entries.find((e) => e.id === p.targetId)
          : undefined;
      return {
        id: p.id,
        date: p.date,
        accountId: p.accountId,
        description: entry?.description ?? "Pagamento de fatura",
        amount: entry?.kind === "income" ? p.amount : -p.amount,
        categoryId: entry?.categoryId ?? "",
      };
    });
}
export function budgetUsage(
  data: FinanceData,
  month: string,
  categoryId: string,
  scope: "bank" | "benefit",
) {
  const { from, to } = monthRange(month);
  return competenceExpenses(data, from, to, scope)
    .filter((r) => r.categoryId === categoryId)
    .reduce((n, r) => n + r.amount, 0);
}
export function forecastData(
  data: FinanceData,
  from: string,
  to: string,
): FinanceData {
  const virtual: FinanceEntry[] = [];
  for (const rule of data.rules.filter((r) => r.status === "active"))
    for (const date of recurrenceDates(rule, from, to)) {
      if (
        data.occurrences.some(
          (o) => o.ruleId === rule.id && o.scheduledDate === date,
        )
      )
        continue;
      virtual.push({
        id: `${rule.id}:${date}`,
        kind: rule.kind,
        accountId: rule.accountId,
        categoryId: rule.categoryId,
        description: rule.description,
        amount: rule.amount,
        competence: date,
        dueDate: date,
        status: rule.entryStatus,
        revision: 1,
      });
    }
  return { ...data, entries: [...data.entries, ...virtual] };
}
export function projectMonths(
  data: FinanceData,
  today: string,
  scenario: "conservative" | "base" | "optimistic" = "base",
  months = 12,
) {
  const end = monthRange(monthShift(today.slice(0, 7), months - 1)).to;
  const start = data.rules.reduce(
    (min, r) => (r.startDate < min ? r.startDate : min),
    today,
  );
  data = forecastData(data, start, end);
  const settings = data.settings;
  const assumptions = settings?.scenarios[scenario] ?? {
    incomePercent: 100,
    variablePercent: 100,
    extraExpense: 0,
  };
  let balance = bankBalance(data, today);
  let benefit = benefitBalance(data, today);
  const invoices = allInvoices(data, today);
  const output = [];
  for (let index = 0; index < months; index++) {
    const month = monthShift(today.slice(0, 7), index);
    const { from, to } = monthRange(month);
    const inMonth = (date: string) =>
      index === 0 ? date <= to : date >= from && date <= to;
    let income = 0,
      expenses = 0,
      benefitIn = 0,
      benefitOut = 0;
    for (const entry of data.entries.filter(
      (e) => e.status !== "cancelled" && inMonth(e.dueDate),
    )) {
      const amount = entryRemaining(data, entry, today);
      const isBenefit = data.accounts.some(
        (a) => a.id === entry.accountId && a.type === "benefit",
      );
      if (isBenefit) {
        if (entry.kind === "income") benefitIn += amount;
        else benefitOut += amount;
      } else if (entry.kind === "income")
        income += Math.round((amount * assumptions.incomePercent) / 100);
      else expenses += amount;
    }
    expenses += invoices
      .filter((i) => inMonth(i.dueDate))
      .reduce((n, i) => n + i.remaining, 0);
    const opening = data.accounts.filter(
      (a) =>
        a.openingDate > today && a.openingDate >= from && a.openingDate <= to,
    );
    balance += opening
      .filter((a) => a.type !== "benefit")
      .reduce((n, a) => n + a.openingBalance, 0);
    benefit += opening
      .filter((a) => a.type === "benefit")
      .reduce((n, a) => n + a.openingBalance, 0);
    let benefitBudgetEstimate = 0;
    for (const budget of data.budgets.filter(
      (b) => b.scope === "benefit" && b.month === month,
    )) {
      const used = budgetUsage(data, month, budget.categoryId, "benefit");
      const pending = data.entries
        .filter(
          (e) =>
            e.kind === "expense" &&
            e.categoryId === budget.categoryId &&
            e.status !== "cancelled" &&
            inMonth(e.dueDate) &&
            data.accounts.some(
              (a) => a.id === e.accountId && a.type === "benefit",
            ),
        )
        .reduce((n, e) => n + entryRemaining(data, e, today), 0);
      benefitBudgetEstimate += Math.max(0, budget.amount - used - pending);
    }
    benefitOut += benefitBudgetEstimate;
    const variable =
      Math.round(
        ((settings?.variableEstimate ?? 0) * assumptions.variablePercent) / 100,
      ) + assumptions.extraExpense;
    const alreadyPaid = cashFlow(data, from, to)
      .filter((p) => p.amount < 0)
      .reduce((n, p) => n - p.amount, 0);
    const openingBalance = balance;
    balance += income - expenses - variable;
    benefit += benefitIn - benefitOut;
    const lastInstallments = data.installments.filter((i) => {
      const purchase = data.purchases.find((p) => p.id === i.purchaseId);
      const invoice = data.invoices.find((v) => v.id === i.invoiceId);
      return (
        purchase?.status === "active" &&
        purchase.installments === i.number &&
        invoice &&
        invoice.dueDate >= from &&
        invoice.dueDate <= to
      );
    }).length;
    output.push({
      month,
      opening: openingBalance,
      income,
      expenses,
      variable,
      alreadyPaid,
      closing: balance,
      benefitClosing: benefit,
      benefitBudgetEstimate,
      potentialSaving: Math.max(0, income - expenses - variable),
      negative: balance < 0,
      incomplete: settings?.variableEstimate == null,
      lastInstallments,
    });
  }
  return output;
}

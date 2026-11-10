import type { Goal, GoalMovement, FutureData } from "../features/future/models";
import type { FinanceData } from "../features/finance/models";
import { localDate } from "../lib/date";
import { monthShift, parseLocal, shiftDate } from "../lib/calendar";
export function allocated(
  movements: GoalMovement[],
  goalId?: string,
  accountId?: string,
  asOf = localDate(),
) {
  return movements
    .filter(
      (m) =>
        (!goalId || m.goalId === goalId) &&
        (!accountId || m.accountId === accountId) &&
        m.date <= asOf,
    )
    .reduce((n, m) => n + (m.kind === "allocate" ? m.amount : -m.amount), 0);
}
// Validate every dated boundary, including backdated payments and reversals.
export function assertAllocationCoverage(
  finance: FinanceData,
  movements: GoalMovement[],
) {
  if (!movements.length) return;
  const today = localDate();
  type Delta = {
    date: string;
    accountId: string;
    cash: number;
    reserved: number;
    pair?: string;
  };
  const events: Delta[] = [];
  const accounts = new Map(finance.accounts.map((a) => [a.id, a]));
  const entries = new Map(finance.entries.map((e) => [e.id, e]));
  for (const a of finance.accounts)
    if (a.type !== "benefit")
      events.push({
        date: a.openingDate,
        accountId: a.id,
        cash: a.openingBalance,
        reserved: 0,
      });
  for (const p of finance.payments) {
    const a = accounts.get(p.accountId);
    if (
      p.status !== "active" ||
      !a ||
      a.type === "benefit" ||
      p.date < a.openingDate
    )
      continue;
    const e = entries.get(p.targetId);
    if (p.targetType === "entry" && !e) continue;
    events.push({
      date: p.date,
      accountId: a.id,
      cash:
        p.targetType === "entry" && e?.kind === "income" ? p.amount : -p.amount,
      reserved: 0,
    });
  }
  for (const t of finance.transfers)
    if (t.status === "active") {
      for (const [accountId, cash] of [
        [t.fromId, -t.amount],
        [t.toId, t.amount],
      ] as [string, number][]) {
        const a = accounts.get(accountId);
        if (a && a.type !== "benefit" && t.date >= a.openingDate)
          events.push({ date: t.date, accountId, cash, reserved: 0 });
      }
    }
  for (const m of movements) {
    const account = accounts.get(m.accountId);
    if (!account || account.type === "benefit")
      throw new Error(
        "A reserva exige uma conta bancária existente; ticket permanece separado.",
      );
    events.push({
      date: m.date,
      accountId: m.accountId,
      cash: 0,
      reserved: m.kind === "allocate" ? m.amount : -m.amount,
      pair: m.goalId + ":" + m.accountId,
    });
  }
  events.sort((a, b) => a.date.localeCompare(b.date));
  const cash = new Map<string, number>(),
    reserved = new Map<string, number>(),
    pairs = new Map<string, number>();
  // Sweep each dated boundary once; same-day records represent an end-of-day position.
  for (let i = 0; i < events.length;) {
    const date = events[i].date;
    if (date > today) break;
    const touchedAccounts = new Set<string>(),
      touchedPairs = new Set<string>();
    while (i < events.length && events[i].date === date) {
      const e = events[i++];
      cash.set(e.accountId, (cash.get(e.accountId) ?? 0) + e.cash);
      reserved.set(e.accountId, (reserved.get(e.accountId) ?? 0) + e.reserved);
      touchedAccounts.add(e.accountId);
      if (e.pair) {
        pairs.set(e.pair, (pairs.get(e.pair) ?? 0) + e.reserved);
        touchedPairs.add(e.pair);
      }
    }
    for (const pair of touchedPairs)
      if ((pairs.get(pair) ?? 0) < 0)
        throw new Error(
          "A retirada supera o valor reservado nesta conta e data.",
        );
    for (const accountId of touchedAccounts) {
      const amount = reserved.get(accountId) ?? 0;
      if (amount > 0 && amount > (cash.get(accountId) ?? 0))
        throw new Error(
          "Saldo insuficiente para as reservas. Libere a alocação antes de movimentar esse dinheiro.",
        );
    }
  }
}
export function goalProgress(
  goal: Goal,
  data: FutureData,
  today = localDate(),
) {
  const reserved = allocated(data.movements, goal.id, undefined, today);
  const steps = data.milestones.filter((m) => m.goalId === goal.id);
  const completed = steps.filter((m) => m.completed).length;
  const remaining =
    goal.target === null ? null : Math.max(0, goal.target - reserved);
  const percent =
    goal.type === "financial"
      ? goal.target !== null
        ? goal.target === 0
          ? 100
          : Math.min(100, (reserved * 100) / goal.target)
        : null
      : steps.length
        ? (completed * 100) / steps.length
        : null;
  // Only a full observed 90-day window; opening allocations are not a recurring income.
  const from = shiftDate(today, -89);
  const observedDays =
    Math.floor(
      (parseLocal(today).getTime() - parseLocal(goal.startDate).getTime()) /
        86400000,
    ) + 1;
  const firstAllocation = data.movements
    .filter((m) => m.goalId === goal.id && m.kind === "allocate")
    .map((m) => m.date)
    .sort()[0];
  const net90 = allocated(
    data.movements.filter(
      (m) =>
        m.date >= from &&
        !(m.kind === "allocate" && m.date === firstAllocation),
    ),
    goal.id,
    undefined,
    today,
  );
  const months =
    observedDays >= 90 && net90 > 0 && remaining !== null
      ? Math.ceil(remaining / (net90 / 3))
      : null;
  const projection =
    remaining === 0
      ? today
      : months !== null && months <= 1200
        ? monthShift(today.slice(0, 7), months)
        : null;
  const monthly = Array.from({ length: 6 }, (_, i) => {
    const month = monthShift(today.slice(0, 7), i - 5);
    const rows = data.movements.filter(
      (m) => m.goalId === goal.id && m.date.slice(0, 7) === month,
    );
    return {
      month,
      net: allocated(rows, goal.id, undefined, today),
      total: allocated(
        data.movements,
        goal.id,
        undefined,
        month < today.slice(0, 7) ? month + "-31" : today,
      ),
    };
  });
  return {
    reserved,
    remaining,
    percent,
    completed,
    steps: steps.length,
    projection,
    monthly,
  };
}
export function projectMetrics(
  projectId: string,
  future: FutureData,
  finance: FinanceData,
) {
  const project = future.projects.find((p) => p.id === projectId);
  const linked = future.receipts.filter((r) => r.projectId === projectId);
  const active = linked.flatMap((r) => {
    const p = finance.payments.find(
      (p) => p.id === r.paymentId && p.status === "active",
    );
    return p ? [{ kind: r.kind, amount: p.amount }] : [];
  });
  const received = active
    .filter((r) => r.kind === "income")
    .reduce((n, r) => n + r.amount, 0);
  const costs = active
    .filter((r) => r.kind === "expense")
    .reduce((n, r) => n + r.amount, 0);
  const minutes = future.timeEntries
    .filter((t) => t.projectId === projectId)
    .reduce((n, t) => n + t.minutes, 0);
  return {
    received,
    costs,
    minutes,
    net: project?.costsComplete ? received - costs : null,
    hourly:
      project?.hoursComplete && minutes > 0
        ? Math.round((received * 60) / minutes)
        : null,
  };
}
export function opportunitySummary(future: FutureData, finance: FinanceData) {
  const active = future.projects.filter(
    (p) => !p.archived && !["lost", "cancelled"].includes(p.stage),
  );
  const values = active.map((p) => ({
    p,
    m: projectMetrics(p.id, future, finance),
  }));
  const allMetrics = future.projects.map((p) =>
    projectMetrics(p.id, future, finance),
  );
  const totalMinutes = allMetrics.reduce((n, m) => n + m.minutes, 0);
  const totalReceived = allMetrics.reduce((n, m) => n + m.received, 0);
  return {
    minutes: totalMinutes,
    net:
      future.projects.length > 0 &&
      future.projects.every((p) => p.costsComplete)
        ? allMetrics.reduce((n, m) => n + m.received - m.costs, 0)
        : null,
    hourly:
      totalMinutes > 0 && future.projects.every((p) => p.hoursComplete)
        ? Math.round((totalReceived * 60) / totalMinutes)
        : null,
    open: active.filter((p) => !["completed"].includes(p.stage)).length,
    proposals: active.filter((p) => p.stage === "proposal").length,
    contracted: active.filter((p) =>
      ["contracted", "executing"].includes(p.stage),
    ).length,
    forecast: values.reduce(
      (n, { p, m }) =>
        n + Math.max(0, (p.contracted ?? p.estimated ?? 0) - m.received),
      0,
    ),
    unknownForecast: active.some(
      (p) => p.contracted === null && p.estimated === null,
    ),
    received: future.projects.reduce(
      (n, p) => n + projectMetrics(p.id, future, finance).received,
      0,
    ),
    costs: future.projects.reduce(
      (n, p) => n + projectMetrics(p.id, future, finance).costs,
      0,
    ),
  };
}

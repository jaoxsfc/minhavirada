import type { FutureData } from "../features/future/models";
import type { FinanceData } from "../features/finance/models";
import { assertAllocationCoverage } from "./future-calculations";
export function validateFutureReferences(
  future: FutureData,
  finance: FinanceData,
  taskIds: Set<string>,
) {
  const assert = (value: unknown) => {
    if (!value)
      throw new Error(
        "Referências ou reservas de metas/projetos inconsistentes.",
      );
  };
  const keys = future.goals
    .filter((g) => g.suggestionKey)
    .map((g) => g.suggestionKey);
  assert(new Set(keys).size === keys.length);
  for (const g of future.goals)
    if (g.accountId)
      assert(
        finance.accounts.some(
          (a) => a.id === g.accountId && a.type !== "benefit",
        ),
      );
  for (const m of future.milestones) {
    const g = future.goals.find((g) => g.id === m.goalId);
    assert(g && (!m.deadline || m.deadline >= g.startDate));
  }
  const transferIds = new Set<string>();
  for (const m of future.movements) {
    const goal = future.goals.find((g) => g.id === m.goalId);
    assert(goal?.type === "financial" && m.date >= goal.startDate);
    if (m.transferId) {
      const t = finance.transfers.find((t) => t.id === m.transferId);
      assert(
        m.kind === "allocate" &&
          t &&
          t.toId === m.accountId &&
          t.amount === m.amount &&
          t.date === m.date &&
          !transferIds.has(t.id),
      );
      transferIds.add(m.transferId);
    }
  }
  assertAllocationCoverage(finance, future.movements);
  const payments = new Set<string>(),
    entries = new Set<string>();
  for (const r of future.receipts) {
    const p = finance.payments.find((p) => p.id === r.paymentId),
      e = finance.entries.find((e) => e.id === r.entryId);
    assert(
      future.projects.some((pr) => pr.id === r.projectId) &&
        p &&
        e &&
        p.targetType === "entry" &&
        p.targetId === e.id &&
        (p.status === "reversed" || e.kind === r.kind) &&
        finance.accounts.some(
          (a) => a.id === p.accountId && a.type !== "benefit",
        ) &&
        !payments.has(p.id) &&
        !entries.has(e.id),
    );
    payments.add(r.paymentId);
    entries.add(r.entryId);
  }
  for (const t of future.timeEntries)
    assert(future.projects.some((p) => p.id === t.projectId));
  for (const l of future.taskLinks)
    assert(
      taskIds.has(l.id) &&
        (l.targetType === "goal" ? future.goals : future.projects).some(
          (x) => x.id === l.targetId,
        ),
    );
}

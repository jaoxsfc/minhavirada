import { parseRecord, backupTables } from "../db/backup-registry";
export interface IntegrityIssue {
  code: string;
  severity: "error" | "warning";
  entity: string;
  count: number;
  guidance: string;
}
type Row = Record<string, unknown>;
export function structuralIssues(data: Record<string, unknown[]>) {
  const issues: IntegrityIssue[] = [];
  const add = (
    code: string,
    entity: string,
    count: number,
    guidance = "Guarde uma cópia externa. Compare o histórico e restaure uma cópia validada; nenhum ajuste foi feito.",
  ) => {
    if (count)
      issues.push({ code, severity: "error", entity, count, guidance });
  };
  const parsed: Record<string, Row[]> = {};
  for (const table of backupTables) {
    parsed[table] = [];
    let invalid = 0;
    for (const row of data[table] ?? [])
      try {
        parsed[table].push(parseRecord(table, row) as Row);
      } catch {
        invalid++;
      }
    add("estrutura", table, invalid);
    const key = (r: Row) =>
      table === "checkIns"
        ? r.date
        : table === "habitLogs"
          ? JSON.stringify([r.habitId, r.date])
          : table === "taskRecords"
            ? JSON.stringify([r.taskId, r.scheduledDate])
            : r.id;
    const keys = parsed[table].map(key);
    add("identificadores-duplicados", table, keys.length - new Set(keys).size);
  }
  const idSets = new Map(
    Object.entries(parsed).map(([name, rows]) => [
      name,
      new Set(rows.map((r) => r.id)),
    ]),
  );
  const ids = (table: string) => idSets.get(table) ?? new Set<unknown>();
  const refs: (readonly [string, string, string, boolean?])[] = [
    ["habitLogs", "habitId", "habits"],
    ["taskRecords", "taskId", "tasks"],
    ["financeEntries", "accountId", "financeAccounts"],
    ["financeEntries", "categoryId", "financeCategories"],
    ["financeEntries", "occurrenceId", "financeOccurrences", true],
    ["financeRules", "accountId", "financeAccounts"],
    ["financeRules", "categoryId", "financeCategories"],
    ["financeOccurrences", "ruleId", "financeRules"],
    ["financeOccurrences", "entryId", "financeEntries"],
    ["financeCards", "accountId", "financeAccounts"],
    ["financePurchases", "cardId", "financeCards"],
    ["financePurchases", "categoryId", "financeCategories"],
    ["financeInstallments", "purchaseId", "financePurchases"],
    ["financeInstallments", "invoiceId", "financeInvoices"],
    ["financeInvoices", "cardId", "financeCards"],
    ["financePayments", "accountId", "financeAccounts"],
    ["financeTransfers", "fromId", "financeAccounts"],
    ["financeTransfers", "toId", "financeAccounts"],
    ["benefitLedger", "accountId", "financeAccounts"],
    ["benefitLedger", "categoryId", "financeCategories", true],
    ["benefitLedger", "paymentId", "financePayments", true],
    ["financeCredits", "purchaseId", "financePurchases"],
    ["financeCredits", "installmentId", "financeInstallments"],
    ["financeCredits", "invoiceId", "financeInvoices"],
    ["financeBudgets", "categoryId", "financeCategories"],
    ["financeChanges", "operationId", "financeOperations"],
    ["goals", "accountId", "financeAccounts", true],
    ["goalMilestones", "goalId", "goals"],
    ["goalMovements", "goalId", "goals"],
    ["goalMovements", "accountId", "financeAccounts"],
    ["goalMovements", "transferId", "financeTransfers", true],
    ["projectReceipts", "projectId", "projects"],
    ["projectReceipts", "paymentId", "financePayments"],
    ["projectReceipts", "entryId", "financeEntries"],
    ["projectTimeEntries", "projectId", "projects"],
    ["futureTaskLinks", "id", "tasks"],
  ];
  for (const [table, key, target, optional] of refs) {
    const values = ids(target);
    add(
      "referência-inválida:" + key,
      table,
      parsed[table].filter(
        (r) =>
          !(optional && (r[key] === undefined || r[key] === null)) &&
          !values.has(r[key]),
      ).length,
    );
  }
  for (const [table, a, b] of [
    ["financeOccurrences", "ruleId", "scheduledDate"],
    ["financeInstallments", "purchaseId", "number"],
    ["financeInvoices", "cardId", "cycleMonth"],
    ["financeBudgets", "month", "categoryId"],
  ]) {
    const values = parsed[table].map((r) =>
      JSON.stringify([r[a], r[b], table === "financeBudgets" ? r.scope : ""]),
    );
    add(
      "chave-composta-duplicada",
      table,
      values.length - new Set(values).size,
    );
  }
  for (const [table, key] of [
    ["financeCategories", "systemKey"],
    ["goals", "suggestionKey"],
    ["projectReceipts", "paymentId"],
    ["projectReceipts", "entryId"],
    ["goalMovements", "transferId"],
    ["benefitLedger", "paymentId"],
    ["financeCredits", "installmentId"],
  ]) {
    const values = parsed[table]
      .filter((r) => r[key] !== undefined)
      .map((r) => r[key]);
    add(
      "vínculo-duplicado:" + key,
      table,
      values.length - new Set(values).size,
    );
  }
  add(
    "destino-inválido",
    "financePayments",
    parsed.financePayments.filter(
      (p) =>
        !ids(
          p.targetType === "entry" ? "financeEntries" : "financeInvoices",
        ).has(p.targetId),
    ).length,
  );
  add(
    "destino-inválido",
    "futureTaskLinks",
    parsed.futureTaskLinks.filter(
      (p) =>
        !ids(p.targetType === "goal" ? "goals" : "projects").has(p.targetId),
    ).length,
  );
  for (const purchase of parsed.financePurchases) {
    const parts = parsed.financeInstallments.filter(
      (i) => i.purchaseId === purchase.id,
    );
    add(
      "parcelamento-inconsistente",
      "financePurchases",
      Number(
        parts.length !== purchase.installments ||
          parts.reduce((n, i) => n + Number(i.amount), 0) !== purchase.amount,
      ),
    );
  }
  for (const entry of parsed.financeEntries) {
    const paid = parsed.financePayments
      .filter(
        (p) =>
          p.targetType === "entry" &&
          p.targetId === entry.id &&
          p.status === "active",
      )
      .reduce((n, p) => n + Number(p.amount), 0);
    add(
      "pagamentos-inconsistentes",
      "financeEntries",
      Number(
        paid > Number(entry.amount) ||
          (entry.status === "cancelled" && paid !== 0),
      ),
    );
  }
  for (const m of parsed.benefitLedger.filter((m) => m.paymentId)) {
    const p = parsed.financePayments.find((p) => p.id === m.paymentId);
    add(
      "ticket-vinculado-inconsistente",
      "benefitLedger",
      Number(
        !p ||
          p.accountId !== m.accountId ||
          p.date !== m.date ||
          p.amount !== m.amount ||
          p.status !== m.status,
      ),
    );
  }
  // Aggregate counts for a compact report without row IDs, descriptions or private text.
  const grouped = new Map<string, IntegrityIssue>();
  for (const i of issues) {
    const k = i.code + ":" + i.entity,
      old = grouped.get(k);
    grouped.set(k, { ...i, count: i.count + (old?.count ?? 0) });
  }
  return [...grouped.values()];
}

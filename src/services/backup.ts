import { structuralIssues } from "./integrity-checks";
import { futureTableNames, type FutureData } from "../features/future/models";
import type { FinanceData } from "../features/finance/models";
import { validateFutureReferences } from "./future-backup";
import { invoiceCycle, dateAtDay } from "./finance/dates";
import { monthShift } from "../lib/calendar";
import Dexie from "dexie";
import { z } from "zod";
import { db, type AppDatabase } from "../db/database";
import { financialRecordSchemas } from "../features/finance/models";
import { readFinance } from "../repositories/finance-data";
export { backupTables } from "../db/backup-registry";
import {
  backupTables,
  legacyTables,
  parseRecord,
  assertBackupCoverage,
} from "../db/backup-registry";
import { recoverySchema } from "../db/security-state";
export const APP_VERSION = "1.0.0-rc.1";
const envelopeSchema = z
  .object({
    format: z.literal("minha-virada"),
    formatVersion: z.literal(1).optional(),
    appVersion: z.string().min(1).max(30).optional(),
    backupId: z.string().uuid().optional(),
    recordCounts: z
      .record(z.string(), z.number().int().min(0).max(100000))
      .optional(),
    schemaVersion: z.union([z.literal(3), z.literal(4)]),
    createdAt: z.string().datetime(),
    data: z.record(z.string(), z.array(z.unknown())),
    checksum: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict();
export type Backup = z.infer<typeof envelopeSchema>;
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [
          key,
          canonical((value as Record<string, unknown>)[key]),
        ]),
    );
  return value;
}
export async function backupChecksum(value: unknown) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(canonical(value))),
  );
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function rawSnapshot(database: AppDatabase) {
  assertBackupCoverage(database);
  const data: Record<string, unknown[]> = {};
  for (const name of backupTables)
    data[name] = await database.table(name).toArray();
  return JSON.parse(JSON.stringify(data)) as Record<string, unknown[]>;
}
async function envelope(data: Record<string, unknown[]>): Promise<Backup> {
  const body = {
    format: "minha-virada" as const,
    formatVersion: 1 as const,
    appVersion: APP_VERSION,
    backupId: crypto.randomUUID(),
    recordCounts: Object.fromEntries(
      Object.entries(data).map(([name, rows]) => [name, rows.length]),
    ),
    schemaVersion: 4 as const,
    createdAt: new Date().toISOString(),
    data,
  };
  return { ...body, checksum: await backupChecksum(body) };
}
export async function exportBackup(database: AppDatabase = db) {
  const data = await database.transaction(
    "r",
    backupTables.map((n) => database.table(n)),
    () => rawSnapshot(database),
  );
  const file = await envelope(data);
  await validateBackup(file);
  return file;
}
export async function validateBackup(input: unknown) {
  if (input && typeof input === "object") {
    const header = input as {
      format?: unknown;
      formatVersion?: unknown;
      schemaVersion?: unknown;
    };
    if (header.format !== "minha-virada")
      throw new Error("Formato de backup não suportado.");
    if (
      (header.formatVersion !== undefined && header.formatVersion !== 1) ||
      ![3, 4].includes(Number(header.schemaVersion))
    )
      throw new Error(
        "Versão de backup não suportada. Use uma versão compatível do aplicativo.",
      );
  }
  const file = envelopeSchema.parse(input);
  if (
    new TextEncoder().encode(JSON.stringify(file, null, 2)).byteLength >
    MAX_BACKUP_BYTES
  )
    throw new Error("O arquivo excede o limite de 20 MB.");
  const { checksum: expected, ...body } = file;
  if ((await backupChecksum(body)) !== expected)
    throw new Error("O arquivo foi alterado ou está corrompido (checksum).");
  const current = file.formatVersion === 1;
  if (
    current &&
    (file.schemaVersion !== 4 ||
      !file.appVersion ||
      !file.backupId ||
      !file.recordCounts)
  )
    throw new Error("Metadados incompletos ou versão incompatível.");
  if (!current && (file.appVersion || file.backupId || file.recordCounts))
    throw new Error("Versão do formato ausente.");
  const expectedTables =
    file.schemaVersion === 3
      ? legacyTables.filter(
          (n) =>
            !futureTableNames.includes(n as (typeof futureTableNames)[number]),
        )
      : current
        ? backupTables
        : legacyTables;
  if (
    Object.keys(file.data).sort().join("|") !==
    [...expectedTables].sort().join("|")
  )
    throw new Error("Lista de tabelas incompatível.");
  const parsed: Record<string, unknown[]> = {};
  for (const name of backupTables) {
    const rows = file.data[name] ?? [];
    if (rows.length > 100000)
      throw new Error("O arquivo ultrapassa o limite por tabela.");
    parsed[name] = rows.map((row) => parseRecord(name, row));
    if (current && file.recordCounts?.[name] !== rows.length)
      throw new Error("Contagem de registros incompatível.");
  }
  if (
    current &&
    Object.keys(file.recordCounts!).sort().join("|") !==
      [...backupTables].sort().join("|")
  )
    throw new Error("Contagem de entidades incompatível.");
  for (const copy of parsed.recoverySnapshots)
    await validateRecoverySnapshot(copy);
  const idSets = new Map<string, Set<string | number | undefined>>();
  const ids = (name: string) => {
    if (!idSets.has(name))
      idSets.set(
        name,
        new Set(
          (parsed[name] as { id?: string | number }[]).map((row) => row.id),
        ),
      );
    return idSets.get(name)!;
  };
  for (const name of backupTables) {
    if (name === "habitLogs" || name === "taskRecords") continue;
    const values = (
      parsed[name] as { id?: string | number; date?: string }[]
    ).map((row) => (name === "checkIns" ? row.date : row.id));
    if (new Set(values).size !== values.length)
      throw new Error("Há identificadores duplicados no arquivo.");
  }
  const assert = (
    test: unknown,
    message = "O arquivo contém referências ou totais financeiros inconsistentes.",
  ) => {
    if (!test) throw new Error(message);
  };
  const accounts = parsed.financeAccounts as z.infer<
    typeof financialRecordSchemas.financeAccounts
  >[];
  const entries = parsed.financeEntries as z.infer<
    typeof financialRecordSchemas.financeEntries
  >[];
  const cards = parsed.financeCards as z.infer<
    typeof financialRecordSchemas.financeCards
  >[];
  const purchases = parsed.financePurchases as z.infer<
    typeof financialRecordSchemas.financePurchases
  >[];
  const installments = parsed.financeInstallments as z.infer<
    typeof financialRecordSchemas.financeInstallments
  >[];
  const invoices = parsed.financeInvoices as z.infer<
    typeof financialRecordSchemas.financeInvoices
  >[];
  const payments = parsed.financePayments as z.infer<
    typeof financialRecordSchemas.financePayments
  >[];
  const benefits = parsed.benefitLedger as z.infer<
    typeof financialRecordSchemas.benefitLedger
  >[];
  const reference = (name: string, id: string) => assert(ids(name).has(id));
  const categories = parsed.financeCategories as z.infer<
    typeof financialRecordSchemas.financeCategories
  >[];
  const categoryKeys = categories
    .filter((c) => c.systemKey !== undefined)
    .map((c) => c.systemKey);
  assert(new Set(categoryKeys).size === categoryKeys.length);
  const compatible = (id: string, kind: string) => {
    const c = categories.find((c) => c.id === id);
    assert(c && (c.kind === kind || c.kind === "both"));
  };

  for (const e of entries) {
    reference("financeAccounts", e.accountId);
    reference("financeCategories", e.categoryId);
    compatible(e.categoryId, e.kind);
    assert(
      e.dueDate >= accounts.find((a) => a.id === e.accountId)!.openingDate,
    );
    const paid = payments
      .filter(
        (p) =>
          p.targetType === "entry" &&
          p.targetId === e.id &&
          p.status === "active",
      )
      .reduce((n, p) => n + p.amount, 0);
    assert(paid <= e.amount && (e.status !== "cancelled" || paid === 0));
    if (e.occurrenceId) reference("financeOccurrences", e.occurrenceId);
  }
  for (const rule of parsed.financeRules as {
    accountId: string;
    categoryId: string;
  }[]) {
    reference("financeAccounts", rule.accountId);
    reference("financeCategories", rule.categoryId);
  }
  const occurrenceKeys = new Set<string>();
  for (const occurrence of parsed.financeOccurrences as {
    id: string;
    ruleId: string;
    scheduledDate: string;
    entryId: string;
  }[]) {
    reference("financeRules", occurrence.ruleId);
    reference("financeEntries", occurrence.entryId);
    assert(
      entries.find((e) => e.id === occurrence.entryId)?.occurrenceId ===
        occurrence.id,
    );
    const key = occurrence.ruleId + occurrence.scheduledDate;
    assert(!occurrenceKeys.has(key));
    occurrenceKeys.add(key);
  }
  for (const card of cards) {
    reference("financeAccounts", card.accountId);
    assert(accounts.find((a) => a.id === card.accountId)?.type !== "benefit");
  }
  for (const purchase of purchases) {
    reference("financeCards", purchase.cardId);
    reference("financeCategories", purchase.categoryId);
    compatible(purchase.categoryId, "expense");
    const parts = installments.filter((i) => i.purchaseId === purchase.id);
    assert(
      parts.length === purchase.installments &&
        parts.reduce((n, i) => n + i.amount, 0) === purchase.amount,
    );
    assert(
      new Set(parts.map((i) => i.number)).size === parts.length &&
        parts.every((i) => i.number <= purchase.installments),
    );
  }
  const cycleKeys = new Set<string>();
  for (const invoice of invoices) {
    reference("financeCards", invoice.cardId);
    const card = cards.find((c) => c.id === invoice.cardId)!;
    assert(
      invoice.closingDate === dateAtDay(invoice.cycleMonth, card.closingDay) &&
        invoice.dueDate ===
          dateAtDay(
            monthShift(
              invoice.cycleMonth,
              card.dueDay <= card.closingDay ? 1 : 0,
            ),
            card.dueDay,
          ),
    );
    const key = invoice.cardId + invoice.cycleMonth;
    assert(!cycleKeys.has(key));
    cycleKeys.add(key);
    const charged = installments
      .filter((i) => i.invoiceId === invoice.id)
      .reduce((n, i) => n + i.amount, 0);
    assert(
      payments
        .filter(
          (p) =>
            p.targetType === "invoice" &&
            p.targetId === invoice.id &&
            p.status === "active",
        )
        .reduce((n, p) => n + p.amount, 0) <= charged,
    );
  }
  for (const installment of installments) {
    reference("financePurchases", installment.purchaseId);
    reference("financeInvoices", installment.invoiceId);
    const originalPurchase = purchases.find(
      (p) => p.id === installment.purchaseId,
    )!;
    const originalCard = cards.find((c) => c.id === originalPurchase.cardId)!;
    assert(
      invoices.find((i) => i.id === installment.invoiceId)?.cycleMonth ===
        monthShift(
          invoiceCycle(
            originalPurchase.date,
            originalCard.closingDay,
            originalCard.dueDay,
          ).cycleMonth,
          installment.number - 1,
        ),
    );
    assert(
      invoices.find((i) => i.id === installment.invoiceId)?.cardId ===
        purchases.find((p) => p.id === installment.purchaseId)?.cardId,
    );
  }
  for (const payment of payments) {
    reference("financeAccounts", payment.accountId);
    reference(
      payment.targetType === "entry" ? "financeEntries" : "financeInvoices",
      payment.targetId,
    );
    const acc = accounts.find((a) => a.id === payment.accountId)!;
    assert(payment.date >= acc.openingDate);
    if (payment.targetType === "entry") {
      const entry = entries.find((e) => e.id === payment.targetId)!;
      if (payment.status === "active")
        assert(payment.accountId === entry.accountId);
      if (acc.type === "benefit") {
        const linked = benefits.filter((b) => b.paymentId === payment.id);
        assert(
          linked.length === 1 &&
            linked[0].accountId === acc.id &&
            linked[0].amount === payment.amount &&
            linked[0].date === payment.date &&
            (payment.status === "reversed" ||
              linked[0].kind ===
                (entry.kind === "income" ? "credit" : "consume")) &&
            linked[0].status ===
              (payment.status === "active" ? "active" : "reversed"),
        );
      }
    } else assert(acc.type !== "benefit");
  }
  for (const movement of benefits) {
    reference("financeAccounts", movement.accountId);
    const acc = accounts.find((a) => a.id === movement.accountId)!;
    assert(acc.type === "benefit" && movement.date >= acc.openingDate);
    if (movement.categoryId)
      reference("financeCategories", movement.categoryId);
    if (movement.paymentId) reference("financePayments", movement.paymentId);
    if (movement.kind === "consume") {
      reference("financeCategories", movement.categoryId ?? "");
      const category = (
        parsed.financeCategories as { id: string; benefitEligible: boolean }[]
      ).find((c) => c.id === movement.categoryId);
      assert(category?.benefitEligible || movement.eligibilityConfirmed);
    }
  }
  for (const t of parsed.financeTransfers as {
    fromId: string;
    toId: string;
    date: string;
  }[]) {
    reference("financeAccounts", t.fromId);
    reference("financeAccounts", t.toId);
    assert(
      accounts
        .filter((a) => a.id === t.fromId || a.id === t.toId)
        .every((a) => a.type !== "benefit" && a.openingDate <= t.date),
    );
  }
  const creditKeys = new Set<string>();
  for (const credit of parsed.financeCredits as {
    installmentId: string;
    purchaseId: string;
    invoiceId: string;
    amount: number;
  }[]) {
    reference("financeInstallments", credit.installmentId);
    reference("financePurchases", credit.purchaseId);
    reference("financeInvoices", credit.invoiceId);
    const part = installments.find((i) => i.id === credit.installmentId)!;
    assert(
      part.purchaseId === credit.purchaseId &&
        part.invoiceId === credit.invoiceId &&
        part.amount === credit.amount &&
        !creditKeys.has(credit.installmentId),
    );
    creditKeys.add(credit.installmentId);
  }
  for (const p of purchases) {
    const creditCount = (
      parsed.financeCredits as { purchaseId: string }[]
    ).filter((c) => c.purchaseId === p.id).length;
    assert(
      p.status === "refunded"
        ? creditCount === p.installments
        : creditCount === 0,
    );
  }
  const budgetKeys = new Set<string>();
  for (const budget of parsed.financeBudgets as {
    categoryId: string;
    month: string;
    scope: string;
  }[]) {
    reference("financeCategories", budget.categoryId);
    const key = budget.categoryId + budget.month + budget.scope;
    assert(!budgetKeys.has(key));
    budgetKeys.add(key);
  }
  const uniqueCompound = (table: string, a: string, b: string) => {
    const values = (parsed[table] as Record<string, unknown>[]).map(
      (row) => `${row[a]}:${row[b]}`,
    );
    assert(
      values.length === new Set(values).size,
      "Há registros diários duplicados.",
    );
  };
  uniqueCompound("habitLogs", "habitId", "date");
  uniqueCompound("taskRecords", "taskId", "scheduledDate");
  for (const row of parsed.habitLogs as { habitId: string }[])
    reference("habits", row.habitId);
  for (const row of parsed.taskRecords as { taskId: string }[])
    reference("tasks", row.taskId);
  const finance = {
    accounts: parsed.financeAccounts,
    categories: parsed.financeCategories,
    entries: parsed.financeEntries,
    rules: parsed.financeRules,
    occurrences: parsed.financeOccurrences,
    cards: parsed.financeCards,
    purchases: parsed.financePurchases,
    installments: parsed.financeInstallments,
    invoices: parsed.financeInvoices,
    payments: parsed.financePayments,
    transfers: parsed.financeTransfers,
    benefits: parsed.benefitLedger,
    credits: parsed.financeCredits,
    budgets: parsed.financeBudgets,
    settings: parsed.financeSettings[0],
  } as FinanceData;
  const future = {
    goals: parsed.goals,
    milestones: parsed.goalMilestones,
    movements: parsed.goalMovements,
    projects: parsed.projects,
    receipts: parsed.projectReceipts,
    timeEntries: parsed.projectTimeEntries,
    taskLinks: parsed.futureTaskLinks,
  } as FutureData;
  validateFutureReferences(
    future,
    finance,
    new Set((parsed.tasks as { id: string }[]).map((t) => t.id)),
  );
  const supplement = structuralIssues(parsed);
  if (supplement.length)
    throw new Error(
      "O arquivo contém referências ou totais financeiros inconsistentes.",
    );
  const normalized = {
    ...body,
    formatVersion: 1 as const,
    appVersion: file.appVersion ?? "anterior",
    backupId: file.backupId ?? legacyBackupId(expected),
    recordCounts: Object.fromEntries(
      Object.entries(parsed).map(([name, rows]) => [name, rows.length]),
    ),
    schemaVersion: 4 as const,
    data: parsed,
  };
  return { ...normalized, checksum: await backupChecksum(normalized) };
}
// Recovery points are flat, lossless copies. Their source may be damaged; full data
// validation happens when the user selects that copy for restoration, never by execution.
async function validateRecoverySnapshot(input: unknown) {
  const copy = recoverySchema.parse(input);
  let raw: unknown;
  try {
    raw = JSON.parse(copy.json);
  } catch {
    throw new Error("Ponto de recuperação inválido.");
  }
  const file = envelopeSchema.parse(raw);
  const { checksum, ...body } = file;
  if ((await backupChecksum(body)) !== checksum)
    throw new Error("Ponto de recuperação com checksum inválido.");
  if ((file.data.recoverySnapshots?.length ?? 0) > 0)
    throw new Error("Pontos de recuperação recursivos não são suportados.");
}
function legacyBackupId(checksum: string) {
  const chars = checksum.slice(0, 32).split("");
  chars[12] = "4";
  chars[16] = "8";
  const s = chars.join("");
  return [
    s.slice(0, 8),
    s.slice(8, 12),
    s.slice(12, 16),
    s.slice(16, 20),
    s.slice(20),
  ].join("-");
}
export async function contentHash(data: Record<string, unknown[]>) {
  return backupChecksum(
    Object.fromEntries(
      Object.entries(data).filter(([name]) => name !== "backupState"),
    ),
  );
}
export async function restoreBackup(
  input: unknown,
  confirmation: string,
  database: AppDatabase = db,
) {
  if (confirmation !== "RESTAURAR")
    throw new Error("Digite RESTAURAR para confirmar a substituição.");
  const file = await validateBackup(input);
  assertBackupCoverage(database);
  return database.transaction(
    "rw",
    backupTables.map((n) => database.table(n)),
    async () => {
      const state = await database.backupState.get("local");
      const previous = await rawSnapshot(database);
      if (
        state?.lastRestoreChecksum === file.checksum &&
        state.lastRestoreContentHash ===
          (await Dexie.waitFor(contentHash(previous)))
      )
        return file;
      // Existing points remain in their own table and are not nested inside another point.
      const safety = await Dexie.waitFor(
        envelope({ ...previous, recoverySnapshots: [] }),
      );
      const point = {
        id: crypto.randomUUID(),
        createdAt: safety.createdAt,
        json: JSON.stringify(safety),
      };
      try {
        await database.recoverySnapshots.add(point);
        const persisted = await database.recoverySnapshots.get(point.id);
        if (persisted?.json !== point.json)
          throw new Error("recovery-readback");
      } catch {
        throw new Error(
          "Não foi possível preservar o ponto de recuperação. Nada foi substituído. Exporte e guarde uma cópia externa antes de tentar novamente.",
        );
      }
      for (const copy of file.data.recoverySnapshots) {
        const row = recoverySchema.parse(copy),
          old = await database.recoverySnapshots.get(row.id);
        if (old && (old.json !== row.json || old.createdAt !== row.createdAt))
          throw new Error(
            "Identificador de recuperação em conflito. Nada foi substituído.",
          );
        if (!old) await database.recoverySnapshots.add(row);
      }
      for (const name of backupTables) {
        if (name === "recoverySnapshots") continue;
        await database.table(name).clear();
        if (file.data[name].length)
          await database.table(name).bulkAdd(file.data[name]);
      }
      const restoredHash = await Dexie.waitFor(
        contentHash(await rawSnapshot(database)),
      );
      await database.backupState.put({
        id: "local",
        lastRestoreChecksum: file.checksum,
        lastRestoreContentHash: restoredHash,
      });
      await readFinance(database);
      return file;
    },
  );
}
export async function confirmBackupSaved(
  database = db,
  evidence?: { backupId: string; contentHash: string },
) {
  return database.transaction(
    "rw",
    backupTables.map((n) => database.table(n)),
    async () => {
      const old = await database.backupState.get("local");
      const at = new Date().toISOString();
      if (evidence) {
        z.string().uuid().parse(evidence.backupId);
        const hash = await Dexie.waitFor(
          contentHash(await rawSnapshot(database)),
        );
        if (hash !== evidence.contentHash)
          throw new Error(
            "Os registros mudaram desde a exportação. Gere e guarde uma nova cópia.",
          );
      }
      await database.backupState.put({
        ...old,
        id: "local",
        lastConfirmedAt: at,
        lastExternal: evidence ? { ...evidence, confirmedAt: at } : undefined,
      });
    },
  );
}
export function needsBackup(lastConfirmedAt?: string) {
  return (
    !lastConfirmedAt || Date.now() - Date.parse(lastConfirmedAt) > 7 * 86400000
  );
}
export async function eraseLocalData(
  confirmation: string,
  database: AppDatabase = db,
) {
  if (confirmation !== "APAGAR")
    throw new Error("Digite APAGAR para confirmar.");
  assertBackupCoverage(database);
  return database.transaction(
    "rw",
    backupTables.map((n) => database.table(n)),
    async () => {
      const proof = (await database.backupState.get("local"))?.lastExternal;
      if (!proof || needsBackup(proof.confirmedAt))
        throw new Error(
          "Exporte e confirme que guardou uma cópia externa recente antes de apagar.",
        );
      const hash = await Dexie.waitFor(
        contentHash(await rawSnapshot(database)),
      );
      if (hash !== proof.contentHash)
        throw new Error(
          "Os dados mudaram. Exporte e confirme uma nova cópia antes de apagar.",
        );
      for (const table of backupTables) await database.table(table).clear();
    },
  );
}

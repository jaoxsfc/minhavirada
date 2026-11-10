import { db } from "../../db/database";
import {
  entrySchema,
  ruleSchema,
  type FinanceEntry,
  type FinanceRule,
} from "../../features/finance/models";
import { dateSchema } from "../../features/habits/models";
import { financeTableNames } from "../../repositories/finance-data";
import { paidFor } from "./calculations";
import { recurrenceDates, dateAtDay } from "./dates";
import { monthShift } from "../../lib/calendar";
import { localDate } from "../../lib/date";
import {
  uuid,
  mutate,
  change,
  account,
  category,
  revision,
} from "./transaction";
export async function saveEntry(
  input: FinanceEntry,
  operationId: string,
  database = db,
) {
  const value = entrySchema.parse(input);
  return mutate(
    operationId,
    "entry",
    value,
    async (data) => {
      account(data, value.accountId, value.dueDate);
      category(data, value.categoryId, value.kind);
      const old = data.entries.find((e) => e.id === value.id);
      revision(old, value);
      if (old && paidFor(data, "entry", old.id) > 0)
        throw new Error("Estorne os pagamentos antes de editar o lançamento.");
      if (old?.occurrenceId !== value.occurrenceId && old)
        throw new Error("Vínculo de recorrência protegido.");
      await database.financeEntries.put(value);
      await change(database, operationId, value.id, "entry", old, value);
      return value.id;
    },
    database,
  );
}

export async function cancelEntry(
  id: string,
  operationId: string,
  database = db,
) {
  return mutate(
    operationId,
    "cancel-entry",
    { id },
    async (data) => {
      const old = data.entries.find((e) => e.id === id);
      if (!old) throw new Error("Lançamento não encontrado.");
      if (paidFor(data, "entry", id) > 0)
        throw new Error("Estorne os pagamentos antes de cancelar.");
      const next = {
        ...old,
        status: "cancelled" as const,
        cancellationSource: "manual" as const,
        revision: old.revision + 1,
      };
      await database.financeEntries.put(next);
      await change(database, operationId, id, "cancel-entry", old, next);
      return id;
    },
    database,
  );
}

export async function saveRule(
  input: FinanceRule,
  operationId: string,
  effectiveFrom: string,
  database = db,
) {
  const value = ruleSchema.parse(input);
  dateSchema.parse(effectiveFrom);
  if (effectiveFrom < localDate())
    throw new Error(
      "Alterações de próximas ocorrências começam hoje ou depois.",
    );
  return mutate(
    operationId,
    "rule",
    { value, effectiveFrom },
    async (data) => {
      account(data, value.accountId, value.startDate);
      category(data, value.categoryId, value.kind);
      const old = data.rules.find((r) => r.id === value.id);
      revision(old, value);
      if (old && old.startDate !== value.startDate)
        throw new Error(
          "A data inicial da série é protegida. Encerre-a e crie outra série.",
        );
      await database.financeRules.put(value);
      if (old) {
        for (const occurrence of data.occurrences.filter(
          (o) => o.ruleId === value.id && o.scheduledDate >= effectiveFrom,
        )) {
          const entry = data.entries.find((e) => e.id === occurrence.entryId);
          if (
            !entry ||
            paidFor(data, "entry", entry.id) > 0 ||
            (entry.status === "cancelled" &&
              entry.cancellationSource !== "rule")
          )
            continue;
          const dates = recurrenceDates(
            value,
            occurrence.scheduledDate,
            occurrence.scheduledDate,
          );
          const next = {
            ...entry,
            kind: value.kind,
            accountId: value.accountId,
            categoryId: value.categoryId,
            description: value.description,
            amount: value.amount,
            status:
              value.status === "archived" || !dates.length
                ? ("cancelled" as const)
                : value.entryStatus,
            cancellationSource:
              value.status === "archived" || !dates.length
                ? ("rule" as const)
                : undefined,
            revision: entry.revision + 1,
          };
          await database.financeEntries.put(next);
          await change(
            database,
            operationId,
            entry.id,
            "rule-next",
            entry,
            next,
          );
        }
      }
      await change(database, operationId, value.id, "rule", old, value);
      return value.id;
    },
    database,
  );
}

export async function ensureOccurrences(
  from: string,
  to: string,
  database = db,
) {
  dateSchema.parse(from);
  dateSchema.parse(to);
  if (to < from || (Date.parse(to) - Date.parse(from)) / 86400000 > 740)
    throw new Error("Gere até 24 meses por vez.");
  return database.transaction(
    "rw",
    financeTableNames.map((n) => database.table(n)),
    async () => {
      const rules = await database.financeRules
        .where("status")
        .equals("active")
        .toArray();
      for (const rule of rules) {
        for (const date of recurrenceDates(rule, from, to)) {
          if (
            await database.financeOccurrences
              .where("[ruleId+scheduledDate]")
              .equals([rule.id, date])
              .first()
          )
            continue;
          const occurrenceId = uuid(),
            entryId = uuid();
          await database.financeOccurrences.add({
            id: occurrenceId,
            ruleId: rule.id,
            scheduledDate: date,
            entryId,
          });
          await database.financeEntries.add({
            id: entryId,
            kind: rule.kind,
            accountId: rule.accountId,
            categoryId: rule.categoryId,
            description: rule.description,
            amount: rule.amount,
            competence: date,
            dueDate: date,
            status: rule.entryStatus,
            occurrenceId,
            revision: 1,
          });
        }
      }
    },
  );
}

export async function synchronizeFinance(today: string, database = db) {
  const rules = await database.financeRules
    .where("status")
    .equals("active")
    .toArray();
  if (!rules.length) return;
  let from = rules.reduce(
    (min, r) => (r.startDate < min ? r.startDate : min),
    today,
  );
  const to = dateAtDay(monthShift(today.slice(0, 7), 11), 31);
  for (let n = 0; from <= to && n < 200; n++) {
    const end = dateAtDay(monthShift(from.slice(0, 7), 23), 31);
    await ensureOccurrences(from, end < to ? end : to, database);
    from = dateAtDay(monthShift(end.slice(0, 7), 1), 1);
  }
  if (from <= to)
    throw new Error(
      "Histórico de recorrência muito extenso. Limite o período da regra.",
    );
}

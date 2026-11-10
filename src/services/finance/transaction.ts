import Dexie from "dexie";
import { futureTableNames } from "../../features/future/models";
import { assertAllocationCoverage } from "../future-calculations";
import { z } from "zod";
import type { AppDatabase } from "../../db/database";
import type { FinanceData } from "../../features/finance/models";
import {
  financeTableNames,
  readFinance,
} from "../../repositories/finance-data";
export const uuid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
async function digest(value: unknown) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function mutate(
  operationId: string,
  action: string,
  payload: unknown,
  run: (data: FinanceData) => Promise<string>,
  database: AppDatabase,
) {
  z.string().uuid().parse(operationId);
  const fingerprint = await Dexie.waitFor(digest({ action, payload }));
  return database.transaction(
    "rw",
    [...financeTableNames, ...futureTableNames].map((n) => database.table(n)),
    async () => {
      const old = await database.financeOperations.get(operationId);
      if (old) {
        if (old.action !== action || old.fingerprint !== fingerprint)
          throw new Error(
            "Este identificador já pertence a outra operação. Reabra o formulário.",
          );
        return old.resultId;
      }
      const resultId = await run(await readFinance(database));
      const movements = await database.goalMovements.toArray();
      if (movements.length)
        assertAllocationCoverage(await readFinance(database), movements);
      await database.financeOperations.add({
        id: operationId,
        action,
        fingerprint,
        resultId,
        at: now(),
      });
      return resultId;
    },
  );
}
export async function change(
  database: AppDatabase,
  operationId: string,
  entityId: string,
  action: string,
  before?: unknown,
  after?: unknown,
) {
  await database.financeChanges.add({
    id: uuid(),
    operationId,
    entityId,
    action,
    before: before === undefined ? undefined : JSON.stringify(before),
    after: after === undefined ? undefined : JSON.stringify(after),
    at: now(),
  });
}
export function account(data: FinanceData, id: string, date?: string) {
  const value = data.accounts.find((a) => a.id === id);
  if (!value || value.status !== "active")
    throw new Error("Selecione uma conta ativa.");
  if (date && date < value.openingDate)
    throw new Error("A data é anterior ao saldo inicial da conta.");
  return value;
}
export function category(
  data: FinanceData,
  id: string,
  kind: "income" | "expense",
) {
  const value = data.categories.find((c) => c.id === id);
  if (
    !value ||
    value.status !== "active" ||
    (value.kind !== "both" && value.kind !== kind)
  )
    throw new Error("Selecione uma categoria compatível e ativa.");
  return value;
}
export function revision(
  old: { revision: number } | undefined,
  value: { revision: number },
) {
  if (old ? value.revision !== old.revision + 1 : value.revision !== 1)
    throw new Error("Registro alterado em outra tela. Reabra antes de salvar.");
}

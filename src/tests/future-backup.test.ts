import Dexie from "dexie";
import { beforeEach, afterEach, it, expect } from "vitest";
import { financeFixture, uid, refDate, type Fixture } from "./finance-fixtures";
import {
  newGoal,
  newProject,
  saveGoal,
  saveProject,
  contribute,
  postProject,
  saveTime,
  saveMilestone,
  saveLinkedTask,
} from "../repositories/future";
import { now } from "../services/finance/transaction";
import { futureTableNames } from "../features/future/models";
import {
  exportBackup,
  restoreBackup,
  validateBackup,
  backupChecksum,
} from "../services/backup";
import { AppDatabase } from "../db/database";
import {
  saveEntry,
  payTarget,
  reversePayment,
} from "../services/finance/commands";
import { readFinance } from "../repositories/finance-data";
import { bankBalance } from "../services/finance/calculations";
import { projectMetrics } from "../services/future-calculations";
import { readFuture } from "../repositories/future-data";
let f: Fixture;
beforeEach(async () => {
  f = await financeFixture();
});
afterEach(async () => {
  await f.db.delete();
});
async function seed() {
  const goal = {
    ...newGoal(),
    title: "Reserva",
    type: "financial" as const,
    startDate: "2024-01-01",
    target: 100000,
  };
  const project = { ...newProject(), service: "Projeto" };
  await saveGoal(goal, uid(), f.db);
  await saveProject(project, uid(), f.db);
  await contribute(
    {
      id: uid(),
      goalId: goal.id,
      accountId: f.bank.id,
      kind: "allocate",
      amount: 10000,
      date: refDate,
      notes: "",
      fromAccountId: null,
      transferId: uid(),
    },
    uid(),
    f.db,
  );
  await saveMilestone(
    {
      id: uid(),
      goalId: goal.id,
      title: "Primeiro passo",
      deadline: "",
      budget: null,
      completed: false,
      notes: "",
      revision: 1,
      createdAt: now(),
      updatedAt: now(),
    },
    uid(),
    f.db,
  );
  await postProject(
    {
      id: uid(),
      projectId: project.id,
      kind: "income",
      accountId: f.bank.id,
      categoryId: f.income.id,
      amount: 30000,
      date: refDate,
      description: "Parcial",
      entryId: uid(),
      paymentId: uid(),
    },
    uid(),
    f.db,
  );
  await saveTime(
    {
      id: uid(),
      projectId: project.id,
      date: refDate,
      minutes: 60,
      notes: "",
      revision: 1,
      createdAt: now(),
      updatedAt: now(),
    },
    uid(),
    f.db,
  );
  const task = {
    id: uid(),
    title: "Passo",
    description: "",
    startDate: refDate,
    endDate: "",
    time: "",
    priority: "medium" as const,
    duration: 30,
    recurrence: "once" as const,
    weekdays: [],
    status: "active" as const,
  };
  await saveLinkedTask(
    task,
    null,
    { id: task.id, targetType: "goal", targetId: goal.id },
    f.db,
  );
  return { goal, project };
}
async function resign(file: Awaited<ReturnType<typeof exportBackup>>) {
  if (file.formatVersion === 1)
    file.recordCounts = Object.fromEntries(
      Object.entries(file.data).map(([n, r]) => [n, r.length]),
    );
  const { checksum, ...body } = file;
  void checksum;
  return { ...body, checksum: await backupChecksum(body) };
}
it("exporta e restaura todas as entidades v4, mantendo pagamentos e cópia anterior", async () => {
  const { project } = await seed(),
    file = await exportBackup(f.db);
  expect(file.schemaVersion).toBe(4);
  for (const table of futureTableNames)
    expect(file.data[table]).toHaveLength(1);
  await restoreBackup(
    await validateBackup(JSON.parse(JSON.stringify(file))),
    "RESTAURAR",
    f.db,
  );
  expect(await f.db.recoverySnapshots.count()).toBe(1);
  expect(
    projectMetrics(project.id, await readFuture(f.db), await readFinance(f.db))
      .received,
  ).toBe(30000);
  expect(bankBalance(await readFinance(f.db), refDate)).toBe(130000);
});
it("backup v3 é convertido sem inventar metas, reservas ou recebimentos", async () => {
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
  const file = await exportBackup(f.db);
  file.schemaVersion = 3;
  delete file.formatVersion;
  delete file.appVersion;
  delete file.backupId;
  delete file.recordCounts;
  delete file.data.recoverySnapshots;
  for (const table of futureTableNames) delete file.data[table];
  const legacy = await resign(file);
  const normalized = await validateBackup(legacy);
  expect(normalized.schemaVersion).toBe(4);
  await seed();
  await restoreBackup(normalized, "RESTAURAR", f.db);
  expect(await f.db.goals.count()).toBe(0);
  expect(await f.db.goalMovements.count()).toBe(0);
  expect(await f.db.financePayments.count()).toBe(1);
  expect(bankBalance(await readFinance(f.db), refDate)).toBe(90000);
});
it("restaura snapshot v3 anterior e gera segurança v4 antes de substituir", async () => {
  const file = await exportBackup(f.db);
  file.schemaVersion = 3;
  delete file.formatVersion;
  delete file.appVersion;
  delete file.backupId;
  delete file.recordCounts;
  delete file.data.recoverySnapshots;
  for (const table of futureTableNames) delete file.data[table];
  const old = await resign(file);
  await seed();
  await restoreBackup(old, "RESTAURAR", f.db);
  const safety = await f.db.recoverySnapshots.toArray();
  expect(
    (await validateBackup(JSON.parse(safety[0].json))).data.goals,
  ).toHaveLength(1);
});
it("rejeita reservas sem lastro e preserva todos os dados atuais", async () => {
  await seed();
  const file = await exportBackup(f.db);
  (file.data.goalMovements[0] as { amount: number }).amount = 999999;
  await expect(
    restoreBackup(await resign(file), "RESTAURAR", f.db),
  ).rejects.toThrow("Saldo insuficiente");
  expect(await f.db.goalMovements.count()).toBe(1);
  expect(await f.db.recoverySnapshots.count()).toBe(0);
});
it("rejeita movimento sem meta, tarefa órfã e referência de recebimento duplicada", async () => {
  await seed();
  const missing = await exportBackup(f.db);
  missing.data.goals = [];
  await expect(validateBackup(await resign(missing))).rejects.toThrow(
    "Referências",
  );
  const duplicate = await exportBackup(f.db);
  duplicate.data.projectReceipts.push({
    ...(duplicate.data.projectReceipts[0] as object),
    id: uid(),
  });
  await expect(validateBackup(await resign(duplicate))).rejects.toThrow(
    "Referências",
  );
  const orphan = await exportBackup(f.db);
  orphan.data.tasks = [];
  await expect(validateBackup(await resign(orphan))).rejects.toThrow(
    "Referências",
  );
});
it("backup não aceita retirada negativa, ticket reservado nem contribuição duplicada", async () => {
  await seed();
  const negative = await exportBackup(f.db);
  (negative.data.goalMovements[0] as { kind: string }).kind = "withdraw";
  await expect(validateBackup(await resign(negative))).rejects.toThrow(
    "retirada",
  );
  const ticket = await exportBackup(f.db);
  (ticket.data.goalMovements[0] as { accountId: string }).accountId =
    f.benefit.id;
  await expect(validateBackup(await resign(ticket))).rejects.toThrow("ticket");
  const duplicate = await exportBackup(f.db);
  duplicate.data.goalMovements.push(duplicate.data.goalMovements[0]);
  await expect(validateBackup(await resign(duplicate))).rejects.toThrow(
    "duplicados",
  );
});
it("migração v3 → v4 preserva byte a byte todas as tabelas anteriores", async () => {
  // Build a genuine native version-30 database from the previous store definitions.
  await seed();
  const file = await exportBackup(f.db),
    name = uid(),
    legacy = new Dexie(name);
  const stores = Object.fromEntries(
    f.db.tables
      .filter(
        (t) =>
          !futureTableNames.includes(
            t.name as (typeof futureTableNames)[number],
          ),
      )
      .map((t) => [
        t.name,
        [t.schema.primKey.src, ...t.schema.indexes.map((i) => i.src)].join(","),
      ]),
  );
  legacy.version(3).stores(stores);
  await legacy.open();
  const before: Record<string, unknown[]> = {};
  for (const table of legacy.tables) {
    const rows = file.data[table.name] ?? [];
    if (rows.length) await table.bulkAdd(rows);
    before[table.name] = await table.toArray();
  }
  legacy.close();
  const upgraded = new AppDatabase(name);
  try {
    await upgraded.open();
    expect(upgraded.verno).toBe(4);
    for (const [table, rows] of Object.entries(before))
      expect(await upgraded.table(table).toArray(), table).toEqual(rows);
    for (const table of futureTableNames)
      expect(await upgraded.table(table).count()).toBe(0);
  } finally {
    await upgraded.delete();
  }
});

it("backup mantém recebimento estornado mesmo após corrigir lançamento financeiro", async () => {
  await seed();
  const receipt = (await f.db.projectReceipts.toArray())[0];
  await reversePayment(receipt.paymentId, uid(), f.db);
  const entry = await f.db.financeEntries.get(receipt.entryId);
  await saveEntry(
    { ...entry!, kind: "expense", categoryId: f.expense.id, revision: 2 },
    uid(),
    f.db,
  );
  const file = await exportBackup(f.db);
  await expect(validateBackup(file)).resolves.toHaveProperty(
    "schemaVersion",
    4,
  );
});

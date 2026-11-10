import Dexie from "dexie";
import { afterEach, beforeEach, expect, it } from "vitest";
import { AppDatabase, defaults } from "../db/database";
import { financeFixture, uid, refDate, type Fixture } from "./finance-fixtures";
import {
  saveEntry,
  cancelEntry,
  reversePayment,
  payTarget,
  saveCard,
  addPurchase,
} from "../services/finance/commands";
import {
  exportBackup,
  backupChecksum,
  validateBackup,
  restoreBackup,
  confirmBackupSaved,
  needsBackup,
} from "../services/backup";
import { readFinance } from "../repositories/finance-data";
import { bankBalance } from "../services/finance/calculations";
import { saveSettings } from "../repositories/settings";
import { saveCheckIn } from "../repositories/routines";
let f: Fixture;
beforeEach(async () => {
  f = await financeFixture();
});
afterEach(async () => {
  await f.db.delete();
});
it("exporta arquivo validado com finanças e dados pessoais, sem cópias recursivas", async () => {
  await saveSettings({ ...defaults, name: "Perfil de teste" }, f.db);
  await saveCheckIn(
    {
      date: refDate,
      mood: 3,
      energy: 4,
      consumed: false,
      craving: 1,
      triggers: "Texto local",
      exercise: false,
      activityMinutes: 0,
      projectMinutes: 20,
      notes: "",
    },
    null,
    f.db,
  );
  await saveEntry(f.entry, uid(), f.db);
  await saveCard(f.card, uid(), f.db);
  await addPurchase(f.purchase, uid(), f.db);
  const file = await exportBackup(f.db);
  expect(file.schemaVersion).toBe(4);
  expect(file.data.settings).toHaveLength(1);
  expect(file.data.checkIns).toHaveLength(1);
  expect(file.data.financeInstallments).toHaveLength(3);
  expect(file.data.recoverySnapshots).toEqual([]);
  expect(
    (await validateBackup(JSON.parse(JSON.stringify(file)))).checksum,
  ).toBe(file.checksum);
});
it("restaura atomicamente e guarda o estado anterior em uma cópia exportável", async () => {
  await saveEntry(f.entry, uid(), f.db);
  const file = await exportBackup(f.db);
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
  await restoreBackup(file, "RESTAURAR", f.db);
  expect(bankBalance(await readFinance(f.db), refDate)).toBe(100000);
  expect(await f.db.recoverySnapshots.count()).toBe(1);
  const saved = await f.db.recoverySnapshots.toArray();
  const safety = await validateBackup(JSON.parse(saved[0].json));
  expect(safety.data.financePayments).toHaveLength(1);
});
it("não substitui dados sem confirmação literal", async () => {
  const file = await exportBackup(f.db);
  await expect(restoreBackup(file, "sim", f.db)).rejects.toThrow("RESTAURAR");
  expect(await f.db.financeAccounts.count()).toBe(3);
  expect(await f.db.recoverySnapshots.count()).toBe(0);
});
it("rejeita checksum alterado e versão desconhecida sem mudar o banco", async () => {
  const file = await exportBackup(f.db);
  await expect(
    validateBackup({ ...file, checksum: "0".repeat(64) }),
  ).rejects.toThrow("checksum");
  await expect(
    validateBackup({ ...file, schemaVersion: 99 }),
  ).rejects.toThrow();
  expect(await f.db.financeAccounts.count()).toBe(3);
});
it("rejeita referências inválidas mesmo com checksum consistente", async () => {
  await saveEntry(f.entry, uid(), f.db);
  const file = await exportBackup(f.db);
  (file.data.financeEntries[0] as { accountId: string }).accountId = uid();
  const { checksum: unused, ...body } = file;
  void unused;
  file.checksum = await backupChecksum(body);
  await expect(restoreBackup(file, "RESTAURAR", f.db)).rejects.toThrow(
    "inconsistentes",
  );
  expect(await f.db.financeEntries.count()).toBe(1);
});
it("rollback protege o estado atual se a escrita da restauração falhar", async () => {
  const file = await exportBackup(f.db);
  await saveEntry(f.entry, uid(), f.db);
  f.db.financeAccounts.hook("creating", () => {
    throw new Error("restore-write-failed");
  });
  await expect(restoreBackup(file, "RESTAURAR", f.db)).rejects.toThrow(
    "restore-write-failed",
  );
  expect(await f.db.financeEntries.count()).toBe(1);
  expect(await f.db.financeAccounts.count()).toBe(3);
  expect(await f.db.recoverySnapshots.count()).toBe(0);
});
it("avisa falta de backup recente e exige nova confirmação após restaurar", async () => {
  expect(needsBackup()).toBe(true);
  expect(needsBackup(new Date(Date.now() - 8 * 86400000).toISOString())).toBe(
    true,
  );
  await confirmBackupSaved(f.db);
  expect(
    needsBackup((await f.db.backupState.get("local"))?.lastConfirmedAt),
  ).toBe(false);
  const file = await exportBackup(f.db);
  await restoreBackup(file, "RESTAURAR", f.db);
  expect(
    needsBackup((await f.db.backupState.get("local"))?.lastConfirmedAt),
  ).toBe(true);
});
it("migra v2 → v3 preservando todas as tabelas e preferências de privacidade", async () => {
  const name = uid();
  const old = new Dexie(name);
  old.version(1).stores({ settings: "id", audit: "++id,entity,at" });
  old.version(2).stores({
    checkIns: "date",
    habits: "id,status,startDate",
    habitLogs: "[habitId+date],habitId,date",
    attempts: "id,&startDate",
    tasks: "id,status,startDate",
    taskRecords: "[taskId+scheduledDate],taskId,dueDate,status",
    routineEvents: "++id,entity,entityId,date,at",
  });
  const at = new Date().toISOString();
  const records: Record<string, unknown[]> = {
    settings: [
      {
        ...defaults,
        name: "Preservado",
        hideSensitive: false,
        theme: "dark",
        updatedAt: at,
      },
    ],
    audit: [{ id: 1, entity: "settings", action: "saved", at }],
    checkIns: [
      {
        date: refDate,
        mood: 3,
        energy: 4,
        consumed: true,
        craving: 3,
        triggers: "Privado",
        exercise: true,
        activityMinutes: 20,
        projectMinutes: 30,
        notes: "Registro preservado",
        revision: 1,
        createdAt: at,
        updatedAt: at,
      },
    ],
    habits: [
      {
        id: "h",
        name: "Hábito",
        description: "",
        category: "Movimento",
        frequency: 3,
        preferredDays: [1, 3, 5],
        duration: 20,
        startDate: refDate,
        status: "active",
        revision: 1,
        createdAt: at,
        updatedAt: at,
      },
    ],
    habitLogs: [
      {
        habitId: "h",
        date: refDate,
        completed: true,
        minutes: 20,
        updatedAt: at,
      },
    ],
    attempts: [{ id: "a", startDate: refDate, createdAt: at }],
    tasks: [
      {
        id: "t",
        title: "Tarefa",
        description: "",
        startDate: refDate,
        endDate: "",
        time: "",
        priority: "medium",
        duration: 30,
        recurrence: "once",
        weekdays: [],
        status: "active",
        revision: 1,
        createdAt: at,
        updatedAt: at,
      },
    ],
    taskRecords: [
      {
        taskId: "t",
        scheduledDate: refDate,
        dueDate: refDate,
        status: "done",
        completedAt: at,
        updatedAt: at,
      },
    ],
    routineEvents: [
      {
        id: 1,
        entity: "task",
        entityId: "t",
        action: "done",
        date: refDate,
        at,
      },
    ],
  };
  for (const [table, rows] of Object.entries(records))
    await old.table(table).bulkAdd(rows);
  old.close();
  const upgraded = new AppDatabase(name);
  try {
    await upgraded.open();
    expect(upgraded.verno).toBe(4);
    for (const [table, rows] of Object.entries(records))
      expect(await upgraded.table(table).toArray()).toEqual(rows);
    expect(await upgraded.financeAccounts.count()).toBe(0);
    expect(await upgraded.financePayments.count()).toBe(0);
    expect(await upgraded.financeEntries.count()).toBe(0);
    expect(await upgraded.benefitLedger.count()).toBe(0);
  } finally {
    await upgraded.delete();
  }
});

it("backup preserva pagamentos estornados após corrigir a conta e o tipo de um lançamento", async () => {
  const e = { ...f.entry, accountId: f.benefit.id, categoryId: f.food.id };
  await saveEntry(e, uid(), f.db);
  const paymentId = await payTarget(
    {
      id: uid(),
      targetType: "entry",
      targetId: e.id,
      accountId: f.benefit.id,
      amount: e.amount,
      date: refDate,
      eligibilityConfirmed: false,
    },
    uid(),
    f.db,
  );
  await reversePayment(paymentId, uid(), f.db);
  await saveEntry(
    {
      ...e,
      accountId: f.bank.id,
      categoryId: f.income.id,
      kind: "income",
      revision: 2,
    },
    uid(),
    f.db,
  );
  const copy = await exportBackup(f.db);
  await expect(validateBackup(copy)).resolves.toHaveProperty(
    "schemaVersion",
    4,
  );
});

it("restaura a pré-visualização normalizada com auditoria antiga e cancelamento", async () => {
  await saveSettings({ ...defaults, name: "Preferências preservadas" }, f.db);
  await saveEntry(f.entry, uid(), f.db);
  await cancelEntry(f.entry.id, uid(), f.db);
  const file = await exportBackup(f.db);
  const preview = await validateBackup(JSON.parse(JSON.stringify(file)));
  await expect(
    restoreBackup(preview, "RESTAURAR", f.db),
  ).resolves.toHaveProperty("schemaVersion", 4);
  expect((await f.db.settings.get("profile"))?.name).toBe(
    "Preferências preservadas",
  );
  expect(await f.db.audit.count()).toBe(1);
  expect((await f.db.financeEntries.get(f.entry.id))?.cancellationSource).toBe(
    "manual",
  );
});

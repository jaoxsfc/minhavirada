import { phaseTwoRecordSchemas } from "../db/backup-contract";
import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { AppDatabase, defaults } from "../db/database";
import {
  saveCheckIn,
  saveHabit,
  setHabitStatus,
  logHabit,
  confirmSuggestions,
  habitSuggestions,
  addAttempt,
  saveTask,
  updateOccurrence,
  setTaskStatus,
} from "../repositories/routines";
import {
  checkInSchema,
  dateSchema,
  type CheckInInput,
  type HabitInput,
} from "../features/habits/models";
import type { TaskInput } from "../features/tasks/models";
import { localDate } from "../lib/date";
import { shiftDate, dayOfWeek } from "../lib/calendar";
import { taskOccurrences } from "../services/routines";
const databases: AppDatabase[] = [];
function create() {
  const database = new AppDatabase(crypto.randomUUID());
  databases.push(database);
  return database;
}
afterEach(async () => {
  for (const database of databases) await database.delete();
  databases.length = 0;
});
const today = localDate();
const input: CheckInInput = {
  date: today,
  mood: 3,
  energy: 4,
  consumed: false,
  craving: 2,
  triggers: "",
  exercise: false,
  activityMinutes: 0,
  projectMinutes: 30,
  notes: "",
};
const habit: HabitInput = {
  id: "walk",
  name: "Caminhar",
  description: "Ao ar livre",
  category: "Movimento",
  frequency: 3,
  preferredDays: [1, 3, 5],
  duration: 20,
  startDate: shiftDate(today, -7),
  status: "active",
};
const task: TaskInput = {
  id: "project",
  title: "Revisar projeto",
  description: "",
  startDate: today,
  endDate: "",
  time: "19:30",
  priority: "high",
  duration: 30,
  recurrence: "daily",
  weekdays: [],
  status: "active",
};
describe("Check-ins", () => {
  it("cria e edita um dia sem duplicar a data", async () => {
    const db = create();
    const saved = await saveCheckIn(input, null, db);
    await saveCheckIn({ ...input, mood: 5 }, saved.revision, db);
    expect(await db.checkIns.count()).toBe(1);
    expect((await db.checkIns.get(today))?.mood).toBe(5);
    expect(await db.routineEvents.count()).toBe(2);
  });
  it("rejeita criação duplicada e edição desatualizada", async () => {
    const db = create();
    await saveCheckIn(input, null, db);
    await expect(saveCheckIn(input, null, db)).rejects.toThrow(
      "já foi alterado",
    );
    await saveCheckIn({ ...input, energy: 1 }, 1, db);
    await expect(saveCheckIn(input, 1, db)).rejects.toThrow("já foi alterado");
    expect((await db.checkIns.get(today))?.energy).toBe(1);
  });
  it("serializa duas gravações simultâneas na mesma data", async () => {
    const db = create();
    const results = await Promise.allSettled([
      saveCheckIn(input, null, db),
      saveCheckIn(input, null, db),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.checkIns.count()).toBe(1);
    expect(await db.routineEvents.count()).toBe(1);
  });
  it("valida datas reais, consumo explícito e minutos", () => {
    expect(dateSchema.safeParse("2026-02-30").success).toBe(false);
    expect(
      checkInSchema.safeParse({ ...input, consumed: undefined }).success,
    ).toBe(false);
    expect(checkInSchema.safeParse({ ...input, energy: 6 }).success).toBe(
      false,
    );
    expect(
      checkInSchema.safeParse({ ...input, exercise: true, activityMinutes: 0 })
        .success,
    ).toBe(false);
    expect(
      checkInSchema.safeParse({
        ...input,
        exercise: false,
        activityMinutes: 20,
      }).success,
    ).toBe(false);
    expect(
      checkInSchema.safeParse({ ...input, date: shiftDate(today, 1) }).success,
    ).toBe(false);
  });
  it("preserva dias anteriores ao registrar um dia com consumo", async () => {
    const db = create();
    await saveCheckIn({ ...input, date: shiftDate(today, -1) }, null, db);
    await saveCheckIn({ ...input, consumed: true }, null, db);
    expect(await db.checkIns.count()).toBe(2);
    expect((await db.checkIns.get(shiftDate(today, -1)))?.consumed).toBe(false);
  });
  it("reverte o check-in se a gravação de histórico falhar", async () => {
    const db = create();
    db.routineEvents.hook("creating", () => {
      throw new Error("history failure");
    });
    await expect(saveCheckIn(input, null, db)).rejects.toThrow(
      "history failure",
    );
    expect(await db.checkIns.count()).toBe(0);
  });
  it("reabre mantendo check-ins, hábitos, tarefas e histórico", async () => {
    const db = create();
    await saveCheckIn(input, null, db);
    await saveHabit(habit, null, db);
    await saveTask(task, null, db);
    await updateOccurrence(task.id, today, "done", undefined, db);
    db.close();
    await db.open();
    expect(await db.checkIns.count()).toBe(1);
    expect(await db.habits.count()).toBe(1);
    expect(await db.tasks.count()).toBe(1);
    expect(await db.taskRecords.count()).toBe(1);
    expect(await db.routineEvents.count()).toBe(4);
  });
});
describe("Hábitos e acompanhamento", () => {
  it("cria, edita, arquiva e reativa preservando conclusões", async () => {
    const db = create();
    const saved = await saveHabit(habit, null, db);
    await saveHabit({ ...habit, name: "Caminhada leve" }, saved.revision, db);
    await logHabit(habit.id, today, true, 20, db);
    await setHabitStatus(habit.id, "archived", db);
    expect((await db.habits.get(habit.id))?.status).toBe("archived");
    expect(await db.habitLogs.count()).toBe(1);
    await setHabitStatus(habit.id, "active", db);
    expect((await db.habits.get(habit.id))?.name).toBe("Caminhada leve");
  });
  it("conclusões são únicas por hábito e data, com histórico de desfazer", async () => {
    const db = create();
    await saveHabit(habit, null, db);
    await logHabit(habit.id, today, true, 20, db);
    await logHabit(habit.id, today, true, 20, db);
    expect(await db.habitLogs.count()).toBe(1);
    expect(await db.routineEvents.count()).toBe(2);
    await logHabit(habit.id, today, false, 0, db);
    expect((await db.habitLogs.get([habit.id, today]))?.completed).toBe(false);
    expect(await db.routineEvents.count()).toBe(3);
  });
  it("sugestões exigem seleção e não duplicam ao reabrir nem após arquivar", async () => {
    const db = create();
    await confirmSuggestions([], db);
    expect(await db.habits.count()).toBe(0);
    const ids = habitSuggestions.map((h) => h.id);
    await confirmSuggestions(ids, db);
    await setHabitStatus(ids[0], "archived", db);
    await confirmSuggestions(ids, db);
    expect(await db.habits.count()).toBe(4);
    expect((await db.habits.get(ids[0]))?.status).toBe("archived");
  });
  it("nova etapa não apaga dados nem duplica a mesma data inicial", async () => {
    const db = create();
    await saveCheckIn(input, null, db);
    await addAttempt(shiftDate(today, -10), db);
    await addAttempt(today, db);
    await addAttempt(today, db);
    expect(await db.attempts.count()).toBe(2);
    expect(await db.checkIns.count()).toBe(1);
  });
  it("rejeita conclusão no futuro ou antes do início do hábito", async () => {
    const db = create();
    await saveHabit(habit, null, db);
    await expect(
      logHabit(habit.id, shiftDate(today, 1), true, 20, db),
    ).rejects.toThrow();
    await expect(
      logHabit(habit.id, shiftDate(today, -8), true, 20, db),
    ).rejects.toThrow();
    expect(await db.habitLogs.count()).toBe(0);
  });
});
describe("Tarefas", () => {
  it("não materializa recorrências ou duplica conclusões ao consultar novamente", async () => {
    const db = create();
    const saved = await saveTask(task, null, db);
    const end = shiftDate(today, 6);
    expect(taskOccurrences([saved], [], today, end)).toHaveLength(7);
    expect(taskOccurrences([saved], [], today, end)).toHaveLength(7);
    expect(await db.taskRecords.count()).toBe(0);
    await updateOccurrence(task.id, today, "done", undefined, db);
    await updateOccurrence(task.id, today, "done", undefined, db);
    expect(await db.taskRecords.count()).toBe(1);
    expect(await db.routineEvents.count()).toBe(2);
  });
  it("adiamento preserva identidade e não duplica no período de destino", async () => {
    const db = create();
    const saved = await saveTask({ ...task, recurrence: "once" }, null, db);
    const destination = shiftDate(today, 3);
    await updateOccurrence(task.id, today, "postpone", destination, db);
    const records = await db.taskRecords.toArray();
    expect(taskOccurrences([saved], records, today, today)).toHaveLength(0);
    const moved = taskOccurrences([saved], records, destination, destination);
    expect(moved).toHaveLength(1);
    expect(moved[0].scheduledDate).toBe(today);
    expect(await db.taskRecords.count()).toBe(1);
  });
  it("mantém conclusão após editar a agenda e arquivar", async () => {
    const db = create();
    const saved = await saveTask(task, null, db);
    await updateOccurrence(task.id, today, "done", undefined, db);
    await saveTask(
      { ...task, startDate: shiftDate(today, 2), recurrence: "once" },
      saved.revision,
      db,
    );
    await setTaskStatus(task.id, "archived", db);
    const tasks = await db.tasks.toArray();
    const records = await db.taskRecords.toArray();
    expect(
      taskOccurrences(tasks, records, today, shiftDate(today, 5), "done"),
    ).toHaveLength(1);
    await updateOccurrence(task.id, today, "reopen", undefined, db);
    expect((await db.taskRecords.get([task.id, today]))?.status).toBe(
      "pending",
    );
  });
  it("valida recorrência semanal, data impossível e conclusão futura", async () => {
    const db = create();
    await expect(
      saveTask({ ...task, recurrence: "weekly", weekdays: [] }, null, db),
    ).rejects.toThrow();
    await saveTask(task, null, db);
    await expect(
      updateOccurrence(task.id, "2026-99-99", "done", undefined, db),
    ).rejects.toThrow();
    await expect(
      updateOccurrence(task.id, shiftDate(today, 1), "done", undefined, db),
    ).rejects.toThrow();
    await expect(
      updateOccurrence(task.id, today, "postpone", "2026-02-30", db),
    ).rejects.toThrow();
    expect(await db.taskRecords.count()).toBe(0);
  });
  it("calcula dias semanais sem criar ocorrências fora da agenda", async () => {
    const db = create();
    const saved = await saveTask(
      { ...task, recurrence: "weekly", weekdays: [dayOfWeek(today)] },
      null,
      db,
    );
    expect(
      taskOccurrences([saved], [], today, shiftDate(today, 13)),
    ).toHaveLength(2);
    await expect(
      updateOccurrence(task.id, shiftDate(today, 1), "done", undefined, db),
    ).rejects.toThrow();
  });
});
it("registros persistidos mantêm contratos serializáveis para o backup futuro", async () => {
  const db = create();
  await saveCheckIn(input, null, db);
  await saveHabit(habit, null, db);
  await logHabit(habit.id, today, true, 20, db);
  await addAttempt(today, db);
  await saveTask(task, null, db);
  await updateOccurrence(task.id, today, "done", undefined, db);
  for (const [name, schema] of Object.entries(phaseTwoRecordSchemas)) {
    const records = await db.table(name).toArray();
    expect(records.length).toBeGreaterThan(0);
    for (const record of records)
      expect(schema.safeParse(JSON.parse(JSON.stringify(record))).success).toBe(
        true,
      );
  }
});
describe("Migração v1 → versão atual", () => {
  it("preserva integralmente preferências e auditoria sem criar dados de domínio", async () => {
    const name = crypto.randomUUID();
    const old = new Dexie(name);
    old.version(1).stores({ settings: "id", audit: "++id,entity,at" });
    const profile = {
      ...defaults,
      name: "Nome preservado",
      theme: "dark" as const,
      hideSensitive: false,
      updatedAt: "2026-01-01T12:00:00Z",
    };
    await old.table("settings").put(profile);
    await old.table("audit").add({
      id: 1,
      entity: "settings",
      action: "saved",
      at: profile.updatedAt,
    });
    old.close();
    const db = new AppDatabase(name);
    databases.push(db);
    await db.open();
    expect(db.verno).toBe(4);
    expect(await db.settings.get("profile")).toEqual(profile);
    expect(await db.audit.count()).toBe(1);
    for (const table of [
      db.checkIns,
      db.habits,
      db.habitLogs,
      db.tasks,
      db.taskRecords,
      db.attempts,
      db.routineEvents,
    ])
      expect(await table.count()).toBe(0);
    db.close();
    await db.open();
    expect(await db.settings.get("profile")).toEqual(profile);
  });
});

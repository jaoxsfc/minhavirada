import { db, type AppDatabase } from "../db/database";
import {
  checkInSchema,
  habitSchema,
  attemptSchema,
  pastDateSchema,
  dateSchema,
  type CheckInInput,
  type HabitInput,
  type RoutineEvent,
} from "../features/habits/models";
import { taskSchema, type TaskInput } from "../features/tasks/models";
import { isTaskScheduled } from "../services/routines";
import { localDate } from "../lib/date";
export class ConflictError extends Error {
  constructor() {
    super("Este registro já foi alterado. Reabra-o antes de salvar novamente.");
  }
}
const stamp = () => new Date().toISOString();
function event(
  database: AppDatabase,
  entity: RoutineEvent["entity"],
  entityId: string,
  action: string,
  date = localDate(),
  extra: Partial<RoutineEvent> = {},
) {
  return database.routineEvents.add({
    entity,
    entityId,
    action,
    date,
    at: stamp(),
    ...extra,
  });
}
export async function saveCheckIn(
  input: CheckInInput,
  expectedRevision: number | null,
  database = db,
) {
  const value = checkInSchema.parse(input);
  return database.transaction(
    "rw",
    database.checkIns,
    database.routineEvents,
    async () => {
      const existing = await database.checkIns.get(value.date);
      if ((existing?.revision ?? null) !== expectedRevision)
        throw new ConflictError();
      const next = {
        ...value,
        revision: (existing?.revision ?? 0) + 1,
        createdAt: existing?.createdAt ?? stamp(),
        updatedAt: stamp(),
      };
      await database.checkIns.put(next);
      await event(
        database,
        "checkIn",
        value.date,
        existing ? "edited" : "created",
        value.date,
      );
      return next;
    },
  );
}
export async function saveHabit(
  input: HabitInput,
  expectedRevision: number | null,
  database = db,
) {
  const value = habitSchema.parse(input);
  return database.transaction(
    "rw",
    database.habits,
    database.routineEvents,
    async () => {
      const old = await database.habits.get(value.id);
      if ((old?.revision ?? null) !== expectedRevision)
        throw new ConflictError();
      const next = {
        ...value,
        revision: (old?.revision ?? 0) + 1,
        createdAt: old?.createdAt ?? stamp(),
        updatedAt: stamp(),
      };
      await database.habits.put(next);
      await event(database, "habit", value.id, old ? "edited" : "created");
      return next;
    },
  );
}
export async function setHabitStatus(
  id: string,
  status: "active" | "archived",
  database = db,
) {
  return database.transaction(
    "rw",
    database.habits,
    database.routineEvents,
    async () => {
      const old = await database.habits.get(id);
      if (!old) throw new Error("Hábito não encontrado.");
      if (old.status === status) return;
      await database.habits.update(id, {
        status,
        revision: old.revision + 1,
        updatedAt: stamp(),
      });
      await event(database, "habit", id, status);
    },
  );
}
export async function logHabit(
  id: string,
  date: string,
  completed: boolean,
  minutes: number,
  database = db,
) {
  pastDateSchema.parse(date);
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1440)
    throw new Error("Minutos inválidos.");
  return database.transaction(
    "rw",
    database.habits,
    database.habitLogs,
    database.routineEvents,
    async () => {
      const habit = await database.habits.get(id);
      if (!habit || date < habit.startDate)
        throw new Error("Data anterior ao início do hábito.");
      const old = await database.habitLogs.get([id, date]);
      if (old?.completed === completed && old.minutes === minutes) return;
      await database.habitLogs.put({
        habitId: id,
        date,
        completed,
        minutes,
        updatedAt: stamp(),
      });
      await event(
        database,
        "habit",
        id,
        completed ? "completed" : "reopened",
        date,
      );
    },
  );
}
export async function addAttempt(startDate: string, database = db) {
  const value = attemptSchema.parse({
    id: crypto.randomUUID(),
    startDate,
    createdAt: stamp(),
  });
  return database.transaction(
    "rw",
    database.attempts,
    database.routineEvents,
    async () => {
      const old = await database.attempts
        .where("startDate")
        .equals(startDate)
        .first();
      if (old) return old;
      await database.attempts.add(value);
      await event(database, "attempt", value.id, "started", startDate);
      return value;
    },
  );
}
export async function saveTask(
  input: TaskInput,
  expectedRevision: number | null,
  database = db,
) {
  const value = taskSchema.parse(input);
  return database.transaction(
    "rw",
    database.tasks,
    database.routineEvents,
    async () => {
      const old = await database.tasks.get(value.id);
      if ((old?.revision ?? null) !== expectedRevision)
        throw new ConflictError();
      const next = {
        ...value,
        revision: (old?.revision ?? 0) + 1,
        createdAt: old?.createdAt ?? stamp(),
        updatedAt: stamp(),
      };
      await database.tasks.put(next);
      await event(database, "task", value.id, old ? "edited" : "created");
      return next;
    },
  );
}
export async function setTaskStatus(
  id: string,
  status: "active" | "archived",
  database = db,
) {
  return database.transaction(
    "rw",
    database.tasks,
    database.routineEvents,
    async () => {
      const old = await database.tasks.get(id);
      if (!old) throw new Error("Tarefa não encontrada.");
      if (old.status === status) return;
      await database.tasks.update(id, {
        status,
        revision: old.revision + 1,
        updatedAt: stamp(),
      });
      await event(database, "task", id, status);
    },
  );
}
export async function updateOccurrence(
  taskId: string,
  scheduledDate: string,
  action: "done" | "reopen" | "postpone",
  toDate?: string,
  database = db,
) {
  dateSchema.parse(scheduledDate);
  return database.transaction(
    "rw",
    database.tasks,
    database.taskRecords,
    database.routineEvents,
    async () => {
      const task = await database.tasks.get(taskId);
      if (!task) throw new Error("Tarefa não encontrada.");
      const old = await database.taskRecords.get([taskId, scheduledDate]);
      if (!old && !isTaskScheduled(task, scheduledDate))
        throw new Error("Ocorrência inválida.");
      const dueDate = old?.dueDate ?? scheduledDate;
      if (action === "done" && dueDate > localDate())
        throw new Error("Conclua apenas tarefas de hoje ou anteriores.");
      if (action === "postpone") dateSchema.parse(toDate);
      if (
        action === "postpone" &&
        (!toDate || !/^\d{4}-\d{2}-\d{2}$/.test(toDate) || toDate <= dueDate)
      )
        throw new Error("Escolha uma data posterior ao vencimento atual.");
      if (action === "postpone" && old?.status === "done")
        throw new Error("Reabra a tarefa antes de adiar.");
      const status = action === "done" ? "done" : "pending";
      if (action !== "postpone" && (old?.status ?? "pending") === status)
        return;
      await database.taskRecords.put({
        taskId,
        scheduledDate,
        dueDate: action === "postpone" ? toDate! : dueDate,
        status,
        completedAt: action === "done" ? stamp() : undefined,
        updatedAt: stamp(),
      });
      await event(
        database,
        "task",
        taskId,
        action,
        scheduledDate,
        action === "postpone" ? { fromDate: dueDate, toDate } : {},
      );
    },
  );
}
const suggestions: HabitInput[] = [
  {
    id: "suggestion-walk",
    name: "Caminhar",
    description: "Um momento para movimentar o corpo.",
    category: "Movimento",
    frequency: 3,
    preferredDays: [1, 3, 5],
    duration: 20,
    startDate: "",
    status: "active",
  },
  {
    id: "suggestion-projects",
    name: "Dedicar tempo aos projetos",
    description: "Dois blocos para construir suas ideias.",
    category: "Projetos",
    frequency: 2,
    preferredDays: [2, 4],
    duration: 30,
    startDate: "",
    status: "active",
  },
  {
    id: "suggestion-finance",
    name: "Revisar as finanças",
    description: "Uma pausa semanal para organizar o planejamento.",
    category: "Organização",
    frequency: 1,
    preferredDays: [0],
    duration: 15,
    startDate: "",
    status: "active",
  },
  {
    id: "suggestion-checkin",
    name: "Fazer check-in diário",
    description: "Perceber como você está, sem julgamentos.",
    category: "Cuidado pessoal",
    frequency: 7,
    preferredDays: [0, 1, 2, 3, 4, 5, 6],
    duration: 5,
    startDate: "",
    status: "active",
  },
];
export const habitSuggestions = suggestions;
export async function confirmSuggestions(ids: string[], database = db) {
  return database.transaction(
    "rw",
    database.habits,
    database.routineEvents,
    async () => {
      for (const suggestion of suggestions.filter((s) => ids.includes(s.id))) {
        if (await database.habits.get(suggestion.id)) continue;
        const value = habitSchema.parse({
          ...suggestion,
          startDate: localDate(),
        });
        await database.habits.add({
          ...value,
          revision: 1,
          createdAt: stamp(),
          updatedAt: stamp(),
        });
        await event(database, "habit", value.id, "suggestion-confirmed");
      }
    },
  );
}

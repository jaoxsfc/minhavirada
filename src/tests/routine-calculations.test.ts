import { describe, expect, it } from "vitest";
import {
  consumptionSummary,
  trackingWeeks,
  calendarDays,
  chartDays,
  isHabitScheduled,
  habitWeekProgress,
  taskOccurrences,
} from "../services/routines";
import type { CheckIn, Habit } from "../features/habits/models";
import type { Task } from "../features/tasks/models";
const entry = (date: string, consumed = false): CheckIn => ({
  date,
  consumed,
  mood: 3,
  energy: 4,
  craving: 1,
  triggers: "",
  exercise: false,
  activityMinutes: 0,
  projectMinutes: 10,
  notes: "",
  revision: 1,
  createdAt: "",
  updatedAt: "",
});
describe("Sequências confirmadas", () => {
  it("não transforma ausência de registro em dia sem consumo", () => {
    const result = consumptionSummary(
      [entry("2026-11-08"), entry("2026-11-10")],
      "2026-11-07",
      "2026-11-10",
    );
    expect(result).toMatchObject({ streak: 1, confirmed: 2, missing: 2 });
  });
  it("usa ontem como último dia confirmado quando hoje está pendente", () => {
    expect(
      consumptionSummary(
        [entry("2026-11-08"), entry("2026-11-09")],
        "2026-11-08",
        "2026-11-10",
      ),
    ).toMatchObject({
      streak: 2,
      confirmed: 2,
      missing: 1,
      through: "2026-11-09",
    });
  });
  it("um dia com consumo interrompe a sequência sem apagar o total", () => {
    expect(
      consumptionSummary(
        [
          entry("2026-11-07"),
          entry("2026-11-08", true),
          entry("2026-11-09"),
          entry("2026-11-10"),
        ],
        "2026-11-07",
        "2026-11-10",
      ),
    ).toMatchObject({
      streak: 2,
      confirmed: 3,
      withConsumption: 1,
      missing: 0,
    });
  });
  it("nenhum registro resulta em sequência zero e lacunas explícitas", () => {
    expect(consumptionSummary([], "2026-11-01", "2026-11-10")).toMatchObject({
      streak: 0,
      confirmed: 0,
      missing: 10,
    });
  });
  it("respeita a data inicial de nova etapa e não considera dias anteriores", () => {
    expect(
      consumptionSummary(
        [entry("2026-11-08"), entry("2026-11-09"), entry("2026-11-10")],
        "2026-11-10",
        "2026-11-10",
      ),
    ).toMatchObject({ streak: 1, confirmed: 1, missing: 0 });
  });
  it("um registro antigo não prolonga a sequência através de lacunas", () => {
    expect(
      consumptionSummary([entry("2026-11-08")], "2026-11-01", "2026-11-10")
        .streak,
    ).toBe(0);
  });
  it("um dia com consumo hoje não reaproveita a sequência de ontem", () => {
    expect(
      consumptionSummary(
        [entry("2026-11-09"), entry("2026-11-10", true)],
        "2026-11-09",
        "2026-11-10",
      ).streak,
    ).toBe(0);
  });
});
describe("Calendário e relatórios", () => {
  it("distingue vazio, registro sem atividade e registro com atividade", () => {
    const rows = calendarDays("2026-11", [
      entry("2026-11-01"),
      { ...entry("2026-11-03"), exercise: true, activityMinutes: 20 },
    ]);
    expect(rows).toHaveLength(30);
    expect(rows[0]).toMatchObject({ registered: true, active: false });
    expect(rows[1]).toMatchObject({ registered: false, active: false });
    expect(rows[2]).toMatchObject({ registered: true, active: true });
  });
  it("suporta fevereiro bissexto e mudança de ano", () => {
    expect(calendarDays("2028-02", [])).toHaveLength(29);
    expect(calendarDays("2026-12", []).at(-1)?.date).toBe("2026-12-31");
  });
  it("mantém null para lacunas dos gráficos e zero apenas quando registrado", () => {
    const chart = chartDays([entry("2026-11-02")], "2026-11-01", "2026-11-03");
    expect(chart[0]).toMatchObject({
      mood: null,
      energy: null,
      activity: null,
    });
    expect(chart[1]).toMatchObject({ mood: 3, energy: 4, activity: 0 });
    expect(chart[2].activity).toBeNull();
  });
});
describe("Agenda de hábitos e filtros de tarefas", () => {
  const habit: Habit = {
    id: "h",
    name: "Caminhar",
    description: "",
    category: "Movimento",
    frequency: 3,
    preferredDays: [1, 3, 5],
    duration: 20,
    startDate: "2026-11-01",
    status: "active",
    revision: 1,
    createdAt: "",
    updatedAt: "",
  };
  it("agenda apenas a partir do início e nos dias preferenciais", () => {
    expect(isHabitScheduled(habit, "2026-11-02")).toBe(true);
    expect(isHabitScheduled(habit, "2026-11-03")).toBe(false);
    expect(isHabitScheduled(habit, "2026-10-30")).toBe(false);
    expect(
      isHabitScheduled({ ...habit, status: "archived" }, "2026-11-02"),
    ).toBe(false);
  });
  it("compara meta semanal somente com conclusões confirmadas", () => {
    expect(
      habitWeekProgress(
        habit,
        [
          {
            habitId: "h",
            date: "2026-11-02",
            completed: true,
            minutes: 20,
            updatedAt: "",
          },
          {
            habitId: "h",
            date: "2026-11-03",
            completed: false,
            minutes: 0,
            updatedAt: "",
          },
        ],
        "2026-11-02",
        "2026-11-08",
      ),
    ).toEqual({ completed: 1, target: 3 });
  });
  const task: Task = {
    id: "t",
    title: "Projetar",
    description: "",
    startDate: "2026-11-02",
    endDate: "2026-11-04",
    time: "",
    duration: 30,
    priority: "medium",
    recurrence: "daily",
    weekdays: [],
    status: "active",
    revision: 1,
    createdAt: "",
    updatedAt: "",
  };
  it("filtra período e estado sem repetir a tarefa recorrente concluída", () => {
    const records = [
      {
        taskId: "t",
        scheduledDate: "2026-11-02",
        dueDate: "2026-11-02",
        status: "done" as const,
        updatedAt: "",
      },
    ];
    expect(
      taskOccurrences([task], records, "2026-11-01", "2026-11-10"),
    ).toHaveLength(3);
    expect(
      taskOccurrences([task], records, "2026-11-01", "2026-11-10", "done"),
    ).toHaveLength(1);
    expect(
      taskOccurrences([task], records, "2026-11-03", "2026-11-04", "pending"),
    ).toHaveLength(2);
  });
});

it("evolução semanal inclui domingo e segunda em semanas distintas", () => {
  expect(trackingWeeks("2026-11-08", "2026-11-09")).toEqual([
    "2026-11-09",
    "2026-11-02",
  ]);
  expect(trackingWeeks("2025-12-31", "2026-01-01")).toEqual(["2025-12-29"]);
  expect(trackingWeeks("2020-01-01", "2026-11-10")).toHaveLength(8);
});

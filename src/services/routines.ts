import type { CheckIn, Habit, HabitLog } from "../features/habits/models";
import type { Task, TaskRecord, Occurrence } from "../features/tasks/models";
import { dateRange, dayOfWeek, shiftDate, weekStart } from "../lib/calendar";
export function consumptionSummary(
  checkIns: CheckIn[],
  start: string,
  today: string,
) {
  const map = new Map(
    checkIns
      .filter((c) => c.date >= start && c.date <= today)
      .map((c) => [c.date, c]),
  );
  let anchor = today;
  if (!map.has(anchor)) anchor = shiftDate(anchor, -1);
  let streak = 0;
  for (let d = anchor; d >= start; d = shiftDate(d, -1)) {
    const entry = map.get(d);
    if (!entry || entry.consumed) break;
    streak++;
  }
  return {
    streak,
    confirmed: [...map.values()].filter((c) => !c.consumed).length,
    withConsumption: [...map.values()].filter((c) => c.consumed).length,
    missing:
      Math.max(
        0,
        Math.round((Date.parse(today) - Date.parse(start)) / 86400000) + 1,
      ) - map.size,
    through: streak ? anchor : undefined,
  };
}
const defaults: Record<number, number[]> = {
  1: [1],
  2: [2, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6],
  7: [0, 1, 2, 3, 4, 5, 6],
};
export function isHabitScheduled(habit: Habit, date: string) {
  return (
    habit.status === "active" &&
    date >= habit.startDate &&
    (habit.preferredDays.length
      ? habit.preferredDays
      : defaults[habit.frequency]
    ).includes(dayOfWeek(date))
  );
}
export function habitWeekProgress(
  habit: Habit,
  logs: HabitLog[],
  from: string,
  to: string,
) {
  return {
    completed: logs.filter(
      (l) =>
        l.habitId === habit.id && l.completed && l.date >= from && l.date <= to,
    ).length,
    target: habit.frequency,
  };
}
export function isTaskScheduled(task: Task, date: string) {
  return (
    date >= task.startDate &&
    (!task.endDate || date <= task.endDate) &&
    (task.recurrence === "once"
      ? date === task.startDate
      : task.recurrence === "daily" || task.weekdays.includes(dayOfWeek(date)))
  );
}
export function taskOccurrences(
  tasks: Task[],
  records: TaskRecord[],
  from: string,
  to: string,
  state = "all",
): Occurrence[] {
  const result = new Map<string, Occurrence>();
  const lookup = new Map(
    records.map((r) => [`${r.taskId}:${r.scheduledDate}`, r]),
  );
  for (const task of tasks) {
    if (task.status === "active") {
      for (const date of dateRange(from, to)) {
        if (!isTaskScheduled(task, date)) continue;
        const record = lookup.get(`${task.id}:${date}`);
        if (record) continue;
        result.set(`${task.id}:${date}`, {
          task,
          scheduledDate: date,
          dueDate: date,
          status: "pending",
        });
      }
    }
  }
  for (const record of records) {
    const task = tasks.find((t) => t.id === record.taskId);
    if (
      !task ||
      record.dueDate < from ||
      record.dueDate > to ||
      (task.status === "archived" && record.status === "pending")
    )
      continue;
    result.set(`${task.id}:${record.scheduledDate}`, { task, ...record });
  }
  return [...result.values()]
    .filter((o) => state === "all" || o.status === state)
    .sort(
      (a, b) =>
        a.dueDate.localeCompare(b.dueDate) ||
        (a.task.time || "23:59").localeCompare(b.task.time || "23:59") ||
        { high: 0, medium: 1, low: 2 }[a.task.priority] -
          { high: 0, medium: 1, low: 2 }[b.task.priority],
    );
}
export function calendarDays(month: string, entries: CheckIn[]) {
  const [y, m] = month.split("-").map(Number);
  const first = `${month}-01`;
  const last = new Date(y, m, 0).getDate();
  const lookup = new Map(entries.map((e) => [e.date, e]));
  return Array.from({ length: last }, (_, i) => {
    const date = shiftDate(first, i);
    const entry = lookup.get(date);
    return { date, registered: !!entry, active: !!entry?.exercise, entry };
  });
}
export function chartDays(entries: CheckIn[], from: string, to: string) {
  const lookup = new Map(entries.map((e) => [e.date, e]));
  return dateRange(from, to).map((date) => {
    const c = lookup.get(date);
    return {
      date,
      mood: c?.mood ?? null,
      energy: c?.energy ?? null,
      activity: c?.activityMinutes ?? null,
      projects: c?.projectMinutes ?? null,
    };
  });
}

export function trackingWeeks(start: string, today: string, limit = 8) {
  const count = Math.max(
    0,
    Math.round(
      (Date.parse(weekStart(today)) - Date.parse(weekStart(start))) / 604800000,
    ) + 1,
  );
  return Array.from({ length: Math.min(limit, count) }, (_, i) =>
    shiftDate(weekStart(today), -7 * i),
  );
}

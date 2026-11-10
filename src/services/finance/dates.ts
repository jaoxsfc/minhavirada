import {
  monthShift,
  monthRange,
  shiftDate,
  parseLocal,
} from "../../lib/calendar";
export function dateAtDay(month: string, day: number) {
  return `${month}-${String(Math.min(day, Number(monthRange(month).to.slice(-2)))).padStart(2, "0")}`;
}
export function addMonths(date: string, amount: number) {
  return dateAtDay(
    monthShift(date.slice(0, 7), amount),
    Number(date.slice(-2)),
  );
}
export function invoiceCycle(date: string, closingDay: number, dueDay: number) {
  const month =
    date > dateAtDay(date.slice(0, 7), closingDay)
      ? monthShift(date.slice(0, 7), 1)
      : date.slice(0, 7);
  return {
    cycleMonth: month,
    closingDate: dateAtDay(month, closingDay),
    dueDate: dateAtDay(monthShift(month, dueDay <= closingDay ? 1 : 0), dueDay),
  };
}
export function nextPayday(today: string, day: number) {
  const thisMonth = dateAtDay(today.slice(0, 7), day);
  return thisMonth > today
    ? thisMonth
    : dateAtDay(monthShift(today.slice(0, 7), 1), day);
}
export function recurrenceDates(
  rule: {
    startDate: string;
    endDate: string;
    frequency: string;
    intervalDays: number;
  },
  from: string,
  to: string,
) {
  const result: string[] = [];
  const end = rule.endDate && rule.endDate < to ? rule.endDate : to;
  if (rule.startDate > end) return result;
  if (rule.frequency === "monthly" || rule.frequency === "yearly") {
    const interval = rule.frequency === "yearly" ? 12 : 1;
    const a = parseLocal(rule.startDate),
      b = parseLocal(from);
    let n = Math.max(
      0,
      Math.floor(
        ((b.getFullYear() - a.getFullYear()) * 12 +
          b.getMonth() -
          a.getMonth()) /
          interval,
      ),
    );
    for (let count = 0; count <= 20000; count++, n++) {
      const date = addMonths(rule.startDate, n * interval);
      if (date > end) break;
      if (count === 20000)
        throw new Error(
          "O período excede 20.000 ocorrências. Reduza as datas da regra.",
        );
      if (date >= from) result.push(date);
    }
  } else {
    const interval = rule.frequency === "weekly" ? 7 : rule.intervalDays;
    let n = Math.max(
      0,
      Math.floor(
        (Date.parse(from) - Date.parse(rule.startDate)) / 86400000 / interval,
      ),
    );
    for (let count = 0; count <= 20000; count++, n++) {
      const date = shiftDate(rule.startDate, n * interval);
      if (date > end) break;
      if (count === 20000)
        throw new Error(
          "O período excede 20.000 ocorrências. Reduza as datas da regra.",
        );
      if (date >= from) result.push(date);
    }
  }
  return result;
}

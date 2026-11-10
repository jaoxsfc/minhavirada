import { localDate } from "./date";
export function parseLocal(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}
export function shiftDate(date: string, days: number) {
  const value = parseLocal(date);
  value.setDate(value.getDate() + days);
  return localDate(value);
}
export function dayOfWeek(date: string) {
  return parseLocal(date).getDay();
}
export function dateRange(from: string, to: string) {
  const result: string[] = [];
  for (let date = from; date <= to; date = shiftDate(date, 1)) {
    result.push(date);
    if (result.length > 3660)
      throw new Error("Escolha um período de até dez anos.");
  }
  return result;
}
export function weekStart(date = localDate()) {
  return shiftDate(date, -((dayOfWeek(date) + 6) % 7));
}
export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  return {
    from: localDate(new Date(y, m - 1, 1)),
    to: localDate(new Date(y, m, 0)),
  };
}
export function monthShift(month: string, amount: number) {
  const [y, m] = month.split("-").map(Number);
  return localDate(new Date(y, m - 1 + amount, 1)).slice(0, 7);
}
export function dateLabel(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(parseLocal(date));
}
export const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

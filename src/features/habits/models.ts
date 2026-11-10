import { z } from "zod";
import { localDate } from "../../lib/date";
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.")
  .refine((value) => {
    const [y, m, d] = value.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return (
      date.getFullYear() === y &&
      date.getMonth() === m - 1 &&
      date.getDate() === d
    );
  }, "Informe uma data válida.");
export const pastDateSchema = dateSchema.refine(
  (value) => value <= localDate(),
  "Escolha hoje ou uma data anterior.",
);
const minutes = z.number().int().min(0).max(1440);
export const checkInSchema = z
  .object({
    date: pastDateSchema,
    mood: z.number().int().min(1).max(5),
    energy: z.number().int().min(1).max(5),
    consumed: z.boolean(),
    craving: z.number().int().min(0).max(5),
    triggers: z.string().trim().max(500),
    exercise: z.boolean(),
    activityMinutes: minutes,
    projectMinutes: minutes,
    notes: z.string().trim().max(3000),
  })
  .refine(
    (v) => (v.exercise ? v.activityMinutes > 0 : v.activityMinutes === 0),
    {
      path: ["activityMinutes"],
      message: "Informe minutos de atividade, ou zero se não realizou.",
    },
  );
export type CheckInInput = z.infer<typeof checkInSchema>;
export type CheckIn = CheckInInput & {
  revision: number;
  createdAt: string;
  updatedAt: string;
};
export const habitSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "Dê um nome ao hábito.").max(100),
  description: z.string().trim().max(1000),
  category: z.enum([
    "Movimento",
    "Projetos",
    "Organização",
    "Cuidado pessoal",
    "Outro",
  ]),
  frequency: z.number().int().min(1).max(7),
  preferredDays: z
    .array(z.number().int().min(0).max(6))
    .max(7)
    .refine((v) => new Set(v).size === v.length),
  duration: minutes,
  startDate: dateSchema,
  status: z.enum(["active", "archived"]),
});
export type HabitInput = z.infer<typeof habitSchema>;
export type Habit = HabitInput & {
  revision: number;
  createdAt: string;
  updatedAt: string;
};
export interface HabitLog {
  habitId: string;
  date: string;
  completed: boolean;
  minutes: number;
  updatedAt: string;
}
export const attemptSchema = z.object({
  id: z.string().min(1),
  startDate: pastDateSchema,
  createdAt: z.string(),
});
export type Attempt = z.infer<typeof attemptSchema>;
export interface RoutineEvent {
  id?: number;
  entity: "habit" | "task" | "checkIn" | "attempt";
  entityId: string;
  action: string;
  date: string;
  at: string;
  fromDate?: string;
  toDate?: string;
}
export const moodLabels = ["Muito ruim", "Ruim", "Normal", "Bom", "Muito bom"];

import { z } from "zod";
import { dateSchema } from "../habits/models";
export const taskSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().trim().min(1, "Dê um título à tarefa.").max(120),
    description: z.string().trim().max(1000),
    startDate: dateSchema,
    endDate: z.union([z.literal(""), dateSchema]),
    time: z.string().regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/),
    priority: z.enum(["low", "medium", "high"]),
    duration: z.number().int().min(0).max(1440),
    recurrence: z.enum(["once", "daily", "weekly"]),
    weekdays: z
      .array(z.number().int().min(0).max(6))
      .max(7)
      .refine((v) => new Set(v).size === v.length),
    status: z.enum(["active", "archived"]),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, {
    path: ["endDate"],
    message: "A data final deve vir após o início.",
  })
  .refine((v) => v.recurrence !== "weekly" || v.weekdays.length > 0, {
    path: ["weekdays"],
    message: "Escolha ao menos um dia da semana.",
  });
export type TaskInput = z.infer<typeof taskSchema>;
export type Task = TaskInput & {
  revision: number;
  createdAt: string;
  updatedAt: string;
};
export interface TaskRecord {
  taskId: string;
  scheduledDate: string;
  dueDate: string;
  status: "pending" | "done";
  completedAt?: string;
  updatedAt: string;
}
export interface Occurrence {
  task: Task;
  scheduledDate: string;
  dueDate: string;
  status: "pending" | "done";
  completedAt?: string;
}

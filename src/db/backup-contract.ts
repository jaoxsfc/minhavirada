import { z } from "zod";
import {
  checkInSchema,
  habitSchema,
  attemptSchema,
  dateSchema,
  pastDateSchema,
} from "../features/habits/models";
import { taskSchema } from "../features/tasks/models";
export const LOCAL_SCHEMA_VERSION = 4 as const;
const metadata = z.object({
  revision: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export const phaseTwoRecordSchemas = {
  checkIns: checkInSchema.and(metadata),
  habits: habitSchema.and(metadata),
  tasks: taskSchema.and(metadata),
  attempts: attemptSchema,
  habitLogs: z.object({
    habitId: z.string().min(1),
    date: pastDateSchema,
    completed: z.boolean(),
    minutes: z.number().int().min(0).max(1440),
    updatedAt: z.string().datetime(),
  }),
  taskRecords: z.object({
    taskId: z.string().min(1),
    scheduledDate: dateSchema,
    dueDate: dateSchema,
    status: z.enum(["pending", "done"]),
    completedAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime(),
  }),
  routineEvents: z.object({
    id: z.number().int().positive().optional(),
    entity: z.enum(["habit", "task", "checkIn", "attempt"]),
    entityId: z.string().min(1),
    action: z.string().min(1),
    date: dateSchema,
    at: z.string().datetime(),
    fromDate: dateSchema.optional(),
    toDate: dateSchema.optional(),
  }),
};
export const localDataTables = [
  "settings",
  "audit",
  "checkIns",
  "habits",
  "habitLogs",
  "attempts",
  "tasks",
  "taskRecords",
  "routineEvents",
] as const;

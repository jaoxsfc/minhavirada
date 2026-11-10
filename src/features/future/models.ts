import { z } from "zod";
import { dateSchema, pastDateSchema } from "../habits/models";
import { centsSchema as cents, positiveCents } from "../finance/models";
const id = z.string().uuid();
const text = z.string().trim().max(3000);
const optionalDate = z.union([z.literal(""), dateSchema]);
const amount = cents.refine((n) => n >= 0).nullable();
const meta = {
  revision: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
};
export const goalSchema = z
  .object({
    id,
    title: z.string().trim().min(1).max(120),
    description: text,
    category: z.string().trim().min(1).max(80),
    type: z.enum(["financial", "personal"]),
    target: amount,
    accountId: id.nullable(),
    startDate: dateSchema,
    deadline: optionalDate,
    priority: z.enum(["high", "medium", "low"]),
    status: z.enum(["active", "completed", "archived"]),
    notes: text,
    suggestionKey: z.string().max(40).optional(),
    ...meta,
  })
  .refine((g) => !g.deadline || g.deadline >= g.startDate, {
    message: "O prazo deve ser posterior ao início.",
    path: ["deadline"],
  })
  .refine(
    (g) =>
      g.type === "financial" || (g.target === null && g.accountId === null),
    {
      message: "Metas pessoais usam marcos, sem reserva financeira.",
      path: ["type"],
    },
  );
export type Goal = z.infer<typeof goalSchema>;
export const milestoneSchema = z.object({
  id,
  goalId: id,
  title: z.string().trim().min(1).max(120),
  deadline: optionalDate,
  budget: amount,
  completed: z.boolean(),
  notes: text,
  ...meta,
});
export type Milestone = z.infer<typeof milestoneSchema>;
export const movementSchema = z.object({
  id,
  goalId: id,
  accountId: id,
  kind: z.enum(["allocate", "withdraw"]),
  amount: positiveCents,
  date: pastDateSchema,
  notes: text,
  transferId: id.optional(),
  createdAt: z.string().datetime(),
});
export type GoalMovement = z.infer<typeof movementSchema>;
export const stageLabels = {
  idea: "Ideia",
  prospect: "Prospecção",
  contact: "Contato realizado",
  proposal: "Proposta enviada",
  negotiation: "Negociação",
  contracted: "Contratado",
  executing: "Em execução",
  completed: "Concluído",
  lost: "Perdido",
  cancelled: "Cancelado",
};
export const projectSchema = z.object({
  id,
  client: z.string().trim().max(120),
  service: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(80),
  description: text,
  estimated: amount,
  contracted: amount,
  forecastCosts: amount,
  stage: z.enum([
    "idea",
    "prospect",
    "contact",
    "proposal",
    "negotiation",
    "contracted",
    "executing",
    "completed",
    "lost",
    "cancelled",
  ]),
  deadline: optionalDate,
  nextAction: z.string().trim().max(500),
  notes: text,
  costsComplete: z.boolean(),
  hoursComplete: z.boolean(),
  archived: z.boolean(),
  ...meta,
});
export type Project = z.infer<typeof projectSchema>;
export const receiptSchema = z.object({
  id,
  projectId: id,
  kind: z.enum(["income", "expense"]),
  paymentId: id,
  entryId: id,
  createdAt: z.string().datetime(),
});
export type ProjectReceipt = z.infer<typeof receiptSchema>;
export const timeSchema = z.object({
  id,
  projectId: id,
  date: pastDateSchema,
  minutes: z.number().int().min(1).max(1440),
  notes: text,
  ...meta,
});
export type ProjectTime = z.infer<typeof timeSchema>;
export const taskLinkSchema = z.object({
  id: z.string().min(1),
  targetType: z.enum(["goal", "project"]),
  targetId: id,
});
export type TaskLink = z.infer<typeof taskLinkSchema>;
export const futureRecordSchemas = {
  goals: goalSchema,
  goalMilestones: milestoneSchema,
  goalMovements: movementSchema,
  projects: projectSchema,
  projectReceipts: receiptSchema,
  projectTimeEntries: timeSchema,
  futureTaskLinks: taskLinkSchema,
};
export const futureTableNames = Object.keys(
  futureRecordSchemas,
) as (keyof typeof futureRecordSchemas)[];
export interface FutureData {
  goals: Goal[];
  milestones: Milestone[];
  movements: GoalMovement[];
  projects: Project[];
  receipts: ProjectReceipt[];
  timeEntries: ProjectTime[];
  taskLinks: TaskLink[];
}

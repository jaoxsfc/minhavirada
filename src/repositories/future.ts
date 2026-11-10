import { accountBalance } from "../services/finance/calculations";
import { z } from "zod";
import { db } from "../db/database";
import {
  goalSchema,
  milestoneSchema,
  movementSchema,
  projectSchema,
  timeSchema,
  taskLinkSchema,
  type Goal,
  type Milestone,
  type Project,
  type ProjectTime,
  type TaskLink,
} from "../features/future/models";
import {
  mutate,
  revision,
  now,
  uuid,
  account,
  change,
} from "../services/finance/transaction";
import {
  addTransfer,
  saveEntry,
  payTarget,
} from "../services/finance/commands";
import { positiveCents } from "../features/finance/models";
import { pastDateSchema } from "../features/habits/models";
import { saveTask } from "./routines";
import type { TaskInput } from "../features/tasks/models";
import { localDate } from "../lib/date";
import { allocated } from "../services/future-calculations";
export async function saveGoal(
  input: Goal,
  operationId: string,
  database = db,
) {
  const value = goalSchema.parse(input);
  return mutate(
    operationId,
    "goal",
    value,
    async (finance) => {
      const old = await database.goals.get(value.id);
      revision(old, value);
      const movements = await database.goalMovements
        .where("goalId")
        .equals(value.id)
        .toArray();
      if (movements.length && old?.type !== value.type)
        throw new Error(
          "O tipo de uma meta com histórico financeiro é protegido.",
        );
      if (movements.some((m) => m.date < value.startDate))
        throw new Error(
          "O início não pode ultrapassar contribuições anteriores.",
        );
      if (
        value.accountId &&
        account(finance, value.accountId).type === "benefit"
      )
        throw new Error("Ticket não compõe reserva bancária.");
      if (old && old.suggestionKey !== value.suggestionKey)
        throw new Error("Identidade da sugestão protegida.");
      await database.goals.put(value);
      await change(database, operationId, value.id, "goal", old, value);
      return value.id;
    },
    database,
  );
}
export async function saveMilestone(
  input: Milestone,
  operationId: string,
  database = db,
) {
  const value = milestoneSchema.parse(input);
  return mutate(
    operationId,
    "milestone",
    value,
    async () => {
      const goal = await database.goals.get(value.goalId);
      if (!goal) throw new Error("Meta não encontrada.");
      const old = await database.goalMilestones.get(value.id);
      revision(old, value);
      if (old && old.goalId !== value.goalId)
        throw new Error("Vínculo protegido.");
      if (value.deadline && value.deadline < goal.startDate)
        throw new Error("O marco deve ser posterior ao início da meta.");
      await database.goalMilestones.put(value);
      return value.id;
    },
    database,
  );
}
export const contributionSchema = z.object({
  id: z.string().uuid(),
  goalId: z.string().uuid(),
  accountId: z.string().uuid(),
  kind: z.enum(["allocate", "withdraw"]),
  amount: positiveCents,
  date: pastDateSchema,
  notes: z.string().trim().max(3000),
  fromAccountId: z.string().uuid().nullable(),
  transferId: z.string().uuid(),
});
export type Contribution = z.infer<typeof contributionSchema>;
export async function contribute(
  input: Contribution,
  operationId: string,
  database = db,
) {
  const value = contributionSchema.parse(input);
  return mutate(
    operationId,
    "goal-contribution",
    value,
    async (finance) => {
      const goal = await database.goals.get(value.goalId);
      if (!goal || goal.type !== "financial" || goal.status !== "active")
        throw new Error("Escolha uma meta financeira ativa.");
      if (value.date < goal.startDate)
        throw new Error("A contribuição não pode anteceder a meta.");
      if (account(finance, value.accountId, value.date).type === "benefit")
        throw new Error("Ticket não compõe reserva bancária.");
      if (await database.goalMovements.get(value.id))
        throw new Error("Contribuição já registrada.");
      if (value.fromAccountId) {
        if (value.kind !== "allocate")
          throw new Error(
            "A retirada apenas libera a alocação; faça a transferência em Finanças.",
          );
        const source = account(finance, value.fromAccountId, value.date);
        if (source.type === "benefit")
          throw new Error("Ticket não pode ser transferido para reserva.");
        const movements = await database.goalMovements.toArray();
        if (
          value.amount >
          accountBalance(finance, source.id, value.date) -
            allocated(movements, undefined, source.id, value.date)
        )
          throw new Error(
            "Saldo insuficiente na conta de origem para transferir e reservar.",
          );
        await addTransfer(
          {
            id: value.transferId,
            fromId: source.id,
            toId: value.accountId,
            amount: value.amount,
            date: value.date,
            status: "active",
          },
          value.transferId,
          database,
        );
      }
      const movement = movementSchema.parse({
        ...value,
        transferId: value.fromAccountId ? value.transferId : undefined,
        createdAt: now(),
      });
      await database.goalMovements.add(movement);
      return value.id;
    },
    database,
  );
}
export async function saveProject(
  input: Project,
  operationId: string,
  database = db,
) {
  const value = projectSchema.parse(input);
  return mutate(
    operationId,
    "project",
    value,
    async () => {
      const old = await database.projects.get(value.id);
      revision(old, value);
      await database.projects.put(value);
      await change(database, operationId, value.id, "project", old, value);
      return value.id;
    },
    database,
  );
}
export const postingSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  kind: z.enum(["income", "expense"]),
  accountId: z.string().uuid(),
  categoryId: z.string().uuid(),
  amount: positiveCents,
  date: pastDateSchema,
  description: z.string().trim().min(1).max(120),
  entryId: z.string().uuid(),
  paymentId: z.string().uuid(),
});
export type ProjectPosting = z.infer<typeof postingSchema>;
export async function postProject(
  input: ProjectPosting,
  operationId: string,
  database = db,
) {
  const value = postingSchema.parse(input);
  return mutate(
    operationId,
    "project-posting",
    value,
    async (finance) => {
      const project = await database.projects.get(value.projectId);
      if (!project || project.archived)
        throw new Error("Escolha um projeto ativo.");
      if (account(finance, value.accountId, value.date).type === "benefit")
        throw new Error(
          "Projetos utilizam contas bancárias; ticket permanece separado.",
        );
      if (await database.projectReceipts.get(value.id))
        throw new Error("Recebimento ou custo já registrado.");
      await saveEntry(
        {
          id: value.entryId,
          kind: value.kind,
          accountId: value.accountId,
          categoryId: value.categoryId,
          amount: value.amount,
          description: value.description,
          competence: value.date,
          dueDate: value.date,
          status: "pending",
          revision: 1,
        },
        value.entryId,
        database,
      );
      await payTarget(
        {
          id: value.paymentId,
          targetType: "entry",
          targetId: value.entryId,
          accountId: value.accountId,
          amount: value.amount,
          date: value.date,
          eligibilityConfirmed: false,
        },
        value.paymentId,
        database,
      );
      await database.projectReceipts.add({
        id: value.id,
        projectId: value.projectId,
        kind: value.kind,
        paymentId: value.paymentId,
        entryId: value.entryId,
        createdAt: now(),
      });
      return value.id;
    },
    database,
  );
}
export async function saveTime(
  input: ProjectTime,
  operationId: string,
  database = db,
) {
  const value = timeSchema.parse(input);
  return mutate(
    operationId,
    "project-time",
    value,
    async () => {
      if (!(await database.projects.get(value.projectId)))
        throw new Error("Projeto não encontrado.");
      const old = await database.projectTimeEntries.get(value.id);
      revision(old, value);
      if (old && old.projectId !== value.projectId)
        throw new Error("Vínculo protegido.");
      await database.projectTimeEntries.put(value);
      return value.id;
    },
    database,
  );
}
export async function linkTask(input: TaskLink, database = db) {
  const value = taskLinkSchema.parse(input);
  return database.transaction(
    "rw",
    database.tasks,
    database.goals,
    database.projects,
    database.futureTaskLinks,
    async () => {
      if (
        !(await database.tasks.get(value.id)) ||
        !(await database
          .table(value.targetType === "goal" ? "goals" : "projects")
          .get(value.targetId))
      )
        throw new Error("Tarefa ou destino não encontrado.");
      await database.futureTaskLinks.put(value);
    },
  );
}
export async function saveLinkedTask(
  input: TaskInput,
  expectedRevision: number | null,
  link: TaskLink,
  database = db,
) {
  return database.transaction(
    "rw",
    database.tasks,
    database.routineEvents,
    database.goals,
    database.projects,
    database.futureTaskLinks,
    async () => {
      if (input.id !== link.id) throw new Error("Tarefa inválida.");
      const task = await saveTask(input, expectedRevision, database);
      await linkTask(link, database);
      return task;
    },
  );
}
export function newGoal(): Goal {
  return {
    id: uuid(),
    title: "",
    description: "",
    category: "Pessoal",
    type: "personal",
    target: null,
    accountId: null,
    startDate: localDate(),
    deadline: "",
    priority: "medium",
    status: "active",
    notes: "",
    revision: 1,
    createdAt: now(),
    updatedAt: now(),
  };
}
export function newProject(): Project {
  return {
    id: uuid(),
    client: "",
    service: "",
    category: "Serviço",
    description: "",
    estimated: null,
    contracted: null,
    forecastCosts: null,
    stage: "idea",
    deadline: "",
    nextAction: "",
    notes: "",
    costsComplete: false,
    hoursComplete: false,
    archived: false,
    revision: 1,
    createdAt: now(),
    updatedAt: now(),
  };
}
export const goalSuggestions = [
  {
    key: "reserve",
    title: "Reserva financeira",
    category: "Reserva",
    type: "financial" as const,
    target: 1000000,
    steps: [],
  },
  {
    key: "wedding",
    title: "Planejamento do casamento",
    category: "Casamento",
    type: "financial" as const,
    target: null,
    steps: [
      "Definir orçamento",
      "Organizar reserva",
      "Planejar pedido",
      "Acompanhar despesas",
    ],
  },
  {
    key: "housing",
    title: "Planejamento da moradia",
    category: "Moradia",
    type: "financial" as const,
    target: null,
    steps: [
      "Estimar custos",
      "Planejar entrada ou caução",
      "Organizar móveis",
      "Definir reserva necessária",
    ],
  },
  {
    key: "income",
    title: "Desenvolvimento de renda extra",
    category: "Projetos",
    type: "personal" as const,
    target: null,
    steps: [],
  },
  {
    key: "health",
    title: "Saúde e evolução pessoal",
    category: "Saúde",
    type: "personal" as const,
    target: null,
    steps: [],
  },
];
export async function confirmGoalSuggestion(key: string, database = db) {
  const suggestion = goalSuggestions.find((s) => s.key === key);
  if (!suggestion) throw new Error("Sugestão não encontrada.");
  return database.transaction(
    "rw",
    [database.goals, database.goalMilestones],
    async () => {
      const old = await database.goals
        .where("suggestionKey")
        .equals(key)
        .first();
      if (old) return old.id;
      const goal = goalSchema.parse({
        ...newGoal(),
        ...suggestion,
        suggestionKey: key,
      });
      await database.goals.add(goal);
      for (const title of suggestion.steps)
        await database.goalMilestones.add(
          milestoneSchema.parse({
            id: uuid(),
            goalId: goal.id,
            title,
            deadline: "",
            budget: null,
            completed: false,
            notes: "",
            revision: 1,
            createdAt: now(),
            updatedAt: now(),
          }),
        );
      return goal.id;
    },
  );
}
export { allocated };

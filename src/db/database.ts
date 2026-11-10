import type { BackupState } from "./security-state";
import type {
  Goal,
  Milestone,
  GoalMovement,
  Project,
  ProjectReceipt,
  ProjectTime,
  TaskLink,
} from "../features/future/models";
import Dexie, { type Table } from "dexie";
import { z } from "zod";
import type {
  CheckIn,
  Habit,
  HabitLog,
  Attempt,
  RoutineEvent,
} from "../features/habits/models";
import type { Task, TaskRecord } from "../features/tasks/models";
import type {
  Account,
  Category,
  FinanceEntry,
  FinanceRule,
  FinanceOccurrence,
  Card,
  Purchase,
  Installment,
  Invoice,
  Payment,
  Transfer,
  BenefitMovement,
  CardCredit,
  Budget,
  FinanceSettings,
  FinanceOperation,
  FinanceChange,
} from "../features/finance/models";
export const settingsSchema = z.object({
  id: z.literal("profile"),
  name: z.string().trim().min(1, "Informe seu nome.").max(50),
  salary: z.number().int().min(0).max(100000000),
  benefit: z.number().int().min(0).max(100000000),
  fuel: z.number().int().min(0).max(100000000),
  food: z.number().int().min(0).max(100000000),
  reserve: z.number().int().min(1).max(100000000),
  theme: z.enum(["light", "dark", "system"]),
  hideSensitive: z.boolean(),
  updatedAt: z.string(),
});
export type Settings = z.infer<typeof settingsSchema>;
export interface Audit {
  id?: number;
  entity: string;
  action: string;
  at: string;
}
export class AppDatabase extends Dexie {
  settings!: Table<Settings, string>;
  audit!: Table<Audit, number>;
  checkIns!: Table<CheckIn, string>;
  habits!: Table<Habit, string>;
  habitLogs!: Table<HabitLog, [string, string]>;
  attempts!: Table<Attempt, string>;
  tasks!: Table<Task, string>;
  taskRecords!: Table<TaskRecord, [string, string]>;
  routineEvents!: Table<RoutineEvent, number>;
  financeAccounts!: Table<Account, string>;
  financeCategories!: Table<Category, string>;
  financeEntries!: Table<FinanceEntry, string>;
  financeRules!: Table<FinanceRule, string>;
  financeOccurrences!: Table<FinanceOccurrence, string>;
  financeCards!: Table<Card, string>;
  financePurchases!: Table<Purchase, string>;
  financeInstallments!: Table<Installment, string>;
  financeInvoices!: Table<Invoice, string>;
  financePayments!: Table<Payment, string>;
  financeTransfers!: Table<Transfer, string>;
  benefitLedger!: Table<BenefitMovement, string>;
  financeCredits!: Table<CardCredit, string>;
  financeBudgets!: Table<Budget, string>;
  financeSettings!: Table<FinanceSettings, string>;
  financeOperations!: Table<FinanceOperation, string>;
  financeChanges!: Table<FinanceChange, string>;
  backupState!: Table<BackupState, string>;
  recoverySnapshots!: Table<
    { id: string; createdAt: string; json: string },
    string
  >;
  goals!: Table<Goal, string>;
  goalMilestones!: Table<Milestone, string>;
  goalMovements!: Table<GoalMovement, string>;
  projects!: Table<Project, string>;
  projectReceipts!: Table<ProjectReceipt, string>;
  projectTimeEntries!: Table<ProjectTime, string>;
  futureTaskLinks!: Table<TaskLink, string>;
  constructor(name = "minha-virada") {
    super(name);
    this.version(1).stores({ settings: "id", audit: "++id,entity,at" });
    // Additive migration: existing settings and audit are retained unchanged.
    this.version(2).stores({
      checkIns: "date",
      habits: "id,status,startDate",
      habitLogs: "[habitId+date],habitId,date",
      attempts: "id,&startDate",
      tasks: "id,status,startDate",
      taskRecords: "[taskId+scheduledDate],taskId,dueDate,status",
      routineEvents: "++id,entity,entityId,date,at",
    });
    this.version(3).stores({
      financeAccounts: "id,type,status",
      financeCategories: "id,kind,&systemKey",
      financeEntries:
        "id,accountId,categoryId,dueDate,competence,status,occurrenceId",
      financeRules: "id,accountId,status",
      financeOccurrences: "id,&[ruleId+scheduledDate],entryId",
      financeCards: "id,accountId,status",
      financePurchases: "id,cardId,categoryId,date,status",
      financeInstallments: "id,purchaseId,invoiceId,&[purchaseId+number]",
      financeInvoices: "id,cardId,dueDate,&[cardId+cycleMonth]",
      financePayments: "id,targetId,accountId,date,status",
      financeTransfers: "id,fromId,toId,date,status",
      benefitLedger: "id,accountId,date,categoryId,&paymentId,status",
      financeCredits: "id,purchaseId,invoiceId,&installmentId",
      financeBudgets: "id,&[month+categoryId+scope]",
      financeSettings: "id",
      financeOperations: "id,at",
      financeChanges: "id,entityId,operationId,at",
      backupState: "id",
      recoverySnapshots: "id,createdAt",
    });
    // Additive v4: no rewrites, generated balances or automatic suggestions.
    this.version(4).stores({
      goals: "id,status,priority,&suggestionKey",
      goalMilestones: "id,goalId,deadline",
      goalMovements: "id,goalId,accountId,date,&transferId",
      projects: "id,stage,archived",
      projectReceipts: "id,projectId,&paymentId,&entryId",
      projectTimeEntries: "id,projectId,date",
      futureTaskLinks: "id,[targetType+targetId]",
    });
  }
}
export const db = new AppDatabase();
export const defaults: Settings = {
  id: "profile",
  name: "",
  salary: 250000,
  benefit: 120000,
  fuel: 35000,
  food: 35000,
  reserve: 1000000,
  theme: "system",
  hideSensitive: true,
  updatedAt: "",
};

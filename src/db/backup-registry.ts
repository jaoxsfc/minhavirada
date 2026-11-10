import { z } from "zod";
import { settingsSchema, type AppDatabase } from "./database";
import { phaseTwoRecordSchemas, localDataTables } from "./backup-contract";
import { financialRecordSchemas } from "../features/finance/models";
import { financeTableNames } from "../repositories/finance-data";
import {
  futureRecordSchemas,
  futureTableNames,
} from "../features/future/models";
import { backupStateSchema, recoverySchema } from "./security-state";
export const recordSchemas: Record<string, z.ZodType> = {
  settings: settingsSchema,
  audit: z.object({
    id: z.number().int().positive().optional(),
    entity: z.string(),
    action: z.string(),
    at: z.string(),
  }),
  ...phaseTwoRecordSchemas,
  ...financialRecordSchemas,
  ...futureRecordSchemas,
  backupState: backupStateSchema,
  recoverySnapshots: recoverySchema,
};
export const backupTables = [
  ...localDataTables,
  ...financeTableNames,
  "backupState",
  ...futureTableNames,
  "recoverySnapshots",
] as const;
export const legacyTables = backupTables.filter(
  (n) => n !== "recoverySnapshots",
);
export function assertBackupCoverage(database: AppDatabase) {
  const expected = [...backupTables].sort().join("|");
  if (
    database.tables
      .map((t) => t.name)
      .sort()
      .join("|") !== expected ||
    Object.keys(recordSchemas).sort().join("|") !== expected
  )
    throw new Error(
      "Registro de backup incompleto. A operação foi bloqueada para proteger tabelas não reconhecidas.",
    );
}
export function assertNoUnknownFields(source: unknown, parsed: unknown) {
  if (Array.isArray(source) && Array.isArray(parsed)) {
    source.forEach((v, i) => assertNoUnknownFields(v, parsed[i]));
    return;
  }
  if (
    source !== null &&
    typeof source === "object" &&
    parsed !== null &&
    typeof parsed === "object"
  ) {
    for (const key of Object.keys(source)) {
      if (!Object.prototype.hasOwnProperty.call(parsed, key))
        throw new Error(
          "O arquivo contém campos desconhecidos. Nenhum campo será descartado; use uma versão compatível.",
        );
      assertNoUnknownFields(
        (source as Record<string, unknown>)[key],
        (parsed as Record<string, unknown>)[key],
      );
    }
  }
}
export function parseRecord(table: string, row: unknown) {
  const parsed = recordSchemas[table].parse(row);
  assertNoUnknownFields(row, parsed);
  return parsed;
}
export const tableLabels: Record<string, string> = {
  settings: "Preferências pessoais",
  audit: "Histórico das preferências",
  checkIns: "Check-ins",
  habits: "Hábitos",
  habitLogs: "Conclusões de hábitos",
  attempts: "Etapas de acompanhamento",
  tasks: "Tarefas",
  taskRecords: "Conclusões e adiamentos",
  routineEvents: "Histórico de rotina",
  financeAccounts: "Contas",
  financeCategories: "Categorias",
  financeEntries: "Lançamentos",
  financeRules: "Regras recorrentes",
  financeOccurrences: "Ocorrências",
  financeCards: "Cartões",
  financePurchases: "Compras",
  financeInstallments: "Parcelas",
  financeInvoices: "Faturas",
  financePayments: "Pagamentos",
  financeTransfers: "Transferências",
  benefitLedger: "Extrato do ticket",
  financeCredits: "Créditos de estorno",
  financeBudgets: "Orçamentos",
  financeSettings: "Planejamento financeiro",
  financeOperations: "Confirmações de operações",
  financeChanges: "Histórico financeiro",
  backupState: "Confirmações de segurança",
  recoverySnapshots: "Pontos de recuperação locais",
  goals: "Metas",
  goalMilestones: "Marcos das metas",
  goalMovements: "Alocações e retiradas",
  projects: "Oportunidades e projetos",
  projectReceipts: "Recebimentos e custos vinculados",
  projectTimeEntries: "Tempo dedicado",
  futureTaskLinks: "Tarefas vinculadas",
};

import { db, type AppDatabase } from "../db/database";
import type { FinanceData } from "../features/finance/models";
export const financeTableNames = [
  "financeAccounts",
  "financeCategories",
  "financeEntries",
  "financeRules",
  "financeOccurrences",
  "financeCards",
  "financePurchases",
  "financeInstallments",
  "financeInvoices",
  "financePayments",
  "financeTransfers",
  "benefitLedger",
  "financeCredits",
  "financeBudgets",
  "financeSettings",
  "financeOperations",
  "financeChanges",
] as const;
export async function readFinance(
  database: AppDatabase = db,
): Promise<FinanceData> {
  return {
    accounts: await database.financeAccounts.toArray(),
    categories: await database.financeCategories.toArray(),
    entries: await database.financeEntries.toArray(),
    rules: await database.financeRules.toArray(),
    occurrences: await database.financeOccurrences.toArray(),
    cards: await database.financeCards.toArray(),
    purchases: await database.financePurchases.toArray(),
    installments: await database.financeInstallments.toArray(),
    invoices: await database.financeInvoices.toArray(),
    payments: await database.financePayments.toArray(),
    transfers: await database.financeTransfers.toArray(),
    benefits: await database.benefitLedger.toArray(),
    credits: await database.financeCredits.toArray(),
    budgets: await database.financeBudgets.toArray(),
    settings: await database.financeSettings.get("finance"),
  };
}

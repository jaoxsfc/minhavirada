import { db } from "../../db/database";
import {
  accountSchema,
  categorySchema,
  budgetSchema,
  financeSettingsSchema,
  type Account,
  type Category,
  type Budget,
  type FinanceSettings,
} from "../../features/finance/models";
import { uuid, mutate, change, category, revision } from "./transaction";
export async function saveAccount(
  input: Account,
  operationId: string,
  database = db,
) {
  const value = accountSchema.parse(input);
  return mutate(
    operationId,
    "account",
    value,
    async (data) => {
      const old = data.accounts.find((a) => a.id === value.id);
      revision(old, value);
      if (
        old &&
        (old.openingBalance !== value.openingBalance ||
          old.openingDate !== value.openingDate ||
          old.type !== value.type) &&
        (data.payments.some((p) => p.accountId === old.id) ||
          data.transfers.some(
            (t) => t.fromId === old.id || t.toId === old.id,
          ) ||
          data.benefits.some((b) => b.accountId === old.id) ||
          data.entries.some((e) => e.accountId === old.id) ||
          data.cards.some((c) => c.accountId === old.id))
      )
        throw new Error(
          "Saldo inicial, data e tipo ficam protegidos após uso. Registre um ajuste ou estorno auditável.",
        );
      await database.financeAccounts.put(value);
      await change(database, operationId, value.id, "account", old, value);
      return value.id;
    },
    database,
  );
}

export async function saveCategory(
  input: Category,
  operationId: string,
  database = db,
) {
  const value = categorySchema.parse(input);
  return mutate(
    operationId,
    "category",
    value,
    async (data) => {
      const old = data.categories.find((c) => c.id === value.id);
      if (
        old &&
        old.kind !== value.kind &&
        (data.entries.some((e) => e.categoryId === old.id) ||
          data.purchases.some((p) => p.categoryId === old.id) ||
          data.rules.some((r) => r.categoryId === old.id) ||
          data.benefits.some((b) => b.categoryId === old.id) ||
          data.budgets.some((b) => b.categoryId === old.id))
      )
        throw new Error(
          "Não altere o tipo de categoria já utilizada. Arquive-a e crie outra.",
        );
      if (
        old &&
        old.benefitEligible !== value.benefitEligible &&
        data.benefits.some((b) => b.categoryId === old.id)
      )
        throw new Error(
          "A elegibilidade histórica está protegida. Crie uma categoria nova para outro enquadramento.",
        );
      await database.financeCategories.put(value);
      await change(database, operationId, value.id, "category", old, value);
      return value.id;
    },
    database,
  );
}

export async function saveBudget(
  input: Budget,
  operationId: string,
  database = db,
) {
  const value = budgetSchema.parse(input);
  return mutate(
    operationId,
    "budget",
    value,
    async (data) => {
      category(data, value.categoryId, "expense");
      const old = data.budgets.find(
        (b) =>
          b.month === value.month &&
          b.categoryId === value.categoryId &&
          b.scope === value.scope,
      );
      const next = { ...value, id: old?.id ?? value.id };
      await database.financeBudgets.put(next);
      await change(database, operationId, next.id, "budget", old, next);
      return next.id;
    },
    database,
  );
}

export async function saveFinanceSettings(
  input: FinanceSettings,
  operationId: string,
  withCategories: boolean,
  database = db,
) {
  const value = financeSettingsSchema.parse(input);
  return mutate(
    operationId,
    "finance-settings",
    { value, withCategories },
    async (data) => {
      await database.financeSettings.put(value);
      if (withCategories) {
        for (const [key, name, kind, eligible] of [
          ["salary", "Salário", "income", false],
          ["extra", "Outras receitas", "income", false],
          ["food", "Alimentação", "expense", true],
          ["fuel", "Combustível", "expense", true],
          ["car", "Financiamento do carro", "expense", false],
          ["insurance", "Seguro do carro", "expense", false],
          ["other", "Outras despesas", "expense", false],
        ] as const) {
          if (data.categories.some((c) => c.systemKey === key)) continue;
          await database.financeCategories.add({
            id: uuid(),
            name,
            kind,
            benefitEligible: eligible,
            status: "active",
            systemKey: key,
          });
        }
      }
      await change(
        database,
        operationId,
        "finance",
        "finance-settings",
        data.settings,
        value,
      );
      return "finance";
    },
    database,
  );
}

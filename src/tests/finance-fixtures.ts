import { AppDatabase } from "../db/database";
import { saveAccount, saveCategory } from "../services/finance/commands";
import type {
  Account,
  Category,
  FinanceEntry,
  Card,
  Purchase,
} from "../features/finance/models";
export const uid = () => crypto.randomUUID();
export const refDate = "2024-01-15";
export async function financeFixture() {
  const db = new AppDatabase(uid());
  const bank: Account = {
    id: uid(),
    name: "Banco de teste",
    type: "checking",
    openingBalance: 100000,
    openingDate: "2024-01-01",
    status: "active",
    color: "#173e34",
    revision: 1,
  };
  const savings: Account = {
    ...bank,
    id: uid(),
    name: "Poupança de teste",
    type: "savings",
    openingBalance: 0,
  };
  const benefit: Account = {
    ...bank,
    id: uid(),
    name: "Ticket de teste",
    type: "benefit",
    openingBalance: 120000,
  };
  const expense: Category = {
    id: uid(),
    name: "Despesa de teste",
    kind: "expense",
    benefitEligible: false,
    status: "active",
  };
  const food: Category = {
    ...expense,
    id: uid(),
    name: "Alimentação",
    benefitEligible: true,
  };
  const income: Category = {
    ...expense,
    id: uid(),
    name: "Receita de teste",
    kind: "income",
  };
  for (const a of [bank, savings, benefit]) await saveAccount(a, uid(), db);
  for (const c of [expense, food, income]) await saveCategory(c, uid(), db);
  const entry: FinanceEntry = {
    id: uid(),
    kind: "expense",
    accountId: bank.id,
    categoryId: expense.id,
    description: "Conta de teste",
    amount: 10000,
    competence: refDate,
    dueDate: refDate,
    status: "pending",
    revision: 1,
  };
  const card: Card = {
    id: uid(),
    name: "Cartão de teste",
    limit: 500000,
    closingDay: 20,
    dueDay: 5,
    accountId: bank.id,
    status: "active",
    revision: 1,
  };
  const purchase: Purchase = {
    id: uid(),
    cardId: card.id,
    categoryId: expense.id,
    description: "Compra de teste",
    amount: 10001,
    date: "2024-01-10",
    installments: 3,
    status: "active",
  };
  return {
    db,
    bank,
    savings,
    benefit,
    expense,
    food,
    income,
    entry,
    card,
    purchase,
  };
}
export type Fixture = Awaited<ReturnType<typeof financeFixture>>;

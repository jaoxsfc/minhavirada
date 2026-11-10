import { z } from "zod";
import { dateSchema, pastDateSchema } from "../habits/models";
const id = z.string().uuid();
export const centsSchema = z
  .number()
  .int()
  .safe()
  .min(-100000000000)
  .max(100000000000);
export const positiveCents = centsSchema.refine(
  (v) => v > 0,
  "Informe um valor maior que zero.",
);
const nonnegative = centsSchema.refine(
  (v) => v >= 0,
  "O valor não pode ser negativo.",
);
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const status = z.enum(["active", "archived"]);
export const accountSchema = z.object({
  id,
  name: z.string().trim().min(1).max(80),
  type: z.enum(["checking", "savings", "wallet", "cash", "other", "benefit"]),
  openingBalance: centsSchema,
  openingDate: dateSchema,
  status,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  revision: z.number().int().positive(),
});
export type Account = z.infer<typeof accountSchema>;
export const categorySchema = z.object({
  id,
  name: z.string().trim().min(1).max(80),
  kind: z.enum(["income", "expense", "both"]),
  benefitEligible: z.boolean(),
  status,
  systemKey: z.string().optional(),
});
export type Category = z.infer<typeof categorySchema>;
export const entrySchema = z.object({
  id,
  kind: z.enum(["income", "expense"]),
  accountId: id,
  categoryId: id,
  description: z.string().trim().min(1).max(200),
  amount: positiveCents,
  competence: dateSchema,
  dueDate: dateSchema,
  status: z.enum(["planned", "pending", "cancelled"]),
  occurrenceId: id.optional(),
  cancellationSource: z.enum(["manual", "rule"]).optional(),
  revision: z.number().int().positive(),
});
export type FinanceEntry = z.infer<typeof entrySchema>;
export const ruleSchema = z
  .object({
    id,
    kind: z.enum(["income", "expense"]),
    accountId: id,
    categoryId: id,
    description: z.string().trim().min(1).max(200),
    amount: positiveCents,
    startDate: dateSchema,
    endDate: z.union([z.literal(""), dateSchema]),
    frequency: z.enum(["weekly", "monthly", "yearly", "custom"]),
    intervalDays: z.number().int().min(1).max(365),
    status,
    entryStatus: z.enum(["planned", "pending"]),
    revision: z.number().int().positive(),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, {
    path: ["endDate"],
    message: "A data final deve vir após o início.",
  });
export type FinanceRule = z.infer<typeof ruleSchema>;
export const occurrenceSchema = z.object({
  id,
  ruleId: id,
  scheduledDate: dateSchema,
  entryId: id,
});
export type FinanceOccurrence = z.infer<typeof occurrenceSchema>;
export const cardSchema = z.object({
  id,
  name: z.string().trim().min(1).max(80),
  limit: nonnegative,
  closingDay: z.number().int().min(1).max(31),
  dueDay: z.number().int().min(1).max(31),
  accountId: id,
  status,
  revision: z.number().int().positive(),
});
export type Card = z.infer<typeof cardSchema>;
export const purchaseSchema = z
  .object({
    id,
    cardId: id,
    categoryId: id,
    description: z.string().trim().min(1).max(200),
    amount: positiveCents,
    date: pastDateSchema,
    installments: z.number().int().min(1).max(120),
    status: z.enum(["active", "refunded"]),
  })
  .refine(
    (v) => v.installments <= v.amount,
    "O número de parcelas não pode superar os centavos do total.",
  );
export type Purchase = z.infer<typeof purchaseSchema>;
export const installmentSchema = z.object({
  id,
  purchaseId: id,
  invoiceId: id,
  number: z.number().int().positive(),
  amount: positiveCents,
});
export type Installment = z.infer<typeof installmentSchema>;
export const invoiceSchema = z.object({
  id,
  cardId: id,
  cycleMonth: monthSchema,
  closingDate: dateSchema,
  dueDate: dateSchema,
});
export type Invoice = z.infer<typeof invoiceSchema>;
export const paymentSchema = z.object({
  id,
  targetType: z.enum(["entry", "invoice"]),
  targetId: id,
  accountId: id,
  amount: positiveCents,
  date: pastDateSchema,
  status: z.enum(["active", "reversed"]),
  reversedAt: z.string().datetime().optional(),
});
export const paymentRequestSchema = paymentSchema
  .omit({ status: true, reversedAt: true })
  .extend({ eligibilityConfirmed: z.boolean() });
export type Payment = z.infer<typeof paymentSchema>;
export const transferSchema = z
  .object({
    id,
    fromId: id,
    toId: id,
    amount: positiveCents,
    date: pastDateSchema,
    status: z.enum(["active", "reversed"]),
  })
  .refine((v) => v.fromId !== v.toId, "Escolha duas contas diferentes.");
export type Transfer = z.infer<typeof transferSchema>;
export const benefitSchema = z
  .object({
    id,
    accountId: id,
    kind: z.enum(["credit", "consume", "adjustment"]),
    amount: centsSchema,
    categoryId: id.optional(),
    description: z.string().trim().min(1).max(200),
    date: pastDateSchema,
    status: z.enum(["active", "reversed"]),
    paymentId: id.optional(),
    eligibilityConfirmed: z.boolean(),
  })
  .refine(
    (v) => (v.kind === "adjustment" ? v.amount !== 0 : v.amount > 0),
    "Informe um valor válido.",
  );
export type BenefitMovement = z.infer<typeof benefitSchema>;
export const creditSchema = z.object({
  id,
  purchaseId: id,
  installmentId: id,
  invoiceId: id,
  amount: positiveCents,
  date: pastDateSchema,
});
export type CardCredit = z.infer<typeof creditSchema>;
export const budgetSchema = z.object({
  id,
  month: monthSchema,
  categoryId: id,
  scope: z.enum(["bank", "benefit"]),
  amount: nonnegative,
});
export type Budget = z.infer<typeof budgetSchema>;
const scenario = z.object({
  incomePercent: z.number().int().min(0).max(200),
  variablePercent: z.number().int().min(0).max(200),
  extraExpense: nonnegative,
});
export const financeSettingsSchema = z.object({
  id: z.literal("finance"),
  salary: nonnegative,
  benefit: nonnegative,
  fuel: nonnegative,
  food: nonnegative,
  benefitPreserve: nonnegative,
  car: nonnegative,
  insurance: nonnegative,
  reserveTarget: positiveCents,
  payday: z.number().int().min(1).max(31),
  variableEstimate: nonnegative.nullable(),
  scenarios: z.object({
    conservative: scenario,
    base: scenario,
    optimistic: scenario,
  }),
  updatedAt: z.string().datetime(),
});
export type FinanceSettings = z.infer<typeof financeSettingsSchema>;
export const financeDefaults: FinanceSettings = {
  id: "finance",
  salary: 250000,
  benefit: 120000,
  fuel: 35000,
  food: 35000,
  benefitPreserve: 50000,
  car: 124700,
  insurance: 24642,
  reserveTarget: 1000000,
  payday: 5,
  variableEstimate: null,
  scenarios: {
    conservative: { incomePercent: 90, variablePercent: 110, extraExpense: 0 },
    base: { incomePercent: 100, variablePercent: 100, extraExpense: 0 },
    optimistic: { incomePercent: 110, variablePercent: 90, extraExpense: 0 },
  },
  updatedAt: new Date().toISOString(),
};
export const operationSchema = z.object({
  id,
  action: z.string(),
  fingerprint: z.string(),
  resultId: z.string(),
  at: z.string().datetime(),
});
export type FinanceOperation = z.infer<typeof operationSchema>;
export const changeSchema = z.object({
  id,
  operationId: id,
  entityId: z.string(),
  action: z.string(),
  before: z.string().optional(),
  after: z.string().optional(),
  at: z.string().datetime(),
});
export type FinanceChange = z.infer<typeof changeSchema>;
export interface FinanceData {
  accounts: Account[];
  categories: Category[];
  entries: FinanceEntry[];
  rules: FinanceRule[];
  occurrences: FinanceOccurrence[];
  cards: Card[];
  purchases: Purchase[];
  installments: Installment[];
  invoices: Invoice[];
  payments: Payment[];
  transfers: Transfer[];
  benefits: BenefitMovement[];
  credits: CardCredit[];
  budgets: Budget[];
  settings?: FinanceSettings;
}
export const emptyFinance: FinanceData = {
  accounts: [],
  categories: [],
  entries: [],
  rules: [],
  occurrences: [],
  cards: [],
  purchases: [],
  installments: [],
  invoices: [],
  payments: [],
  transfers: [],
  benefits: [],
  credits: [],
  budgets: [],
};
export const financialRecordSchemas = {
  financeAccounts: accountSchema,
  financeCategories: categorySchema,
  financeEntries: entrySchema,
  financeRules: ruleSchema,
  financeOccurrences: occurrenceSchema,
  financeCards: cardSchema,
  financePurchases: purchaseSchema,
  financeInstallments: installmentSchema,
  financeInvoices: invoiceSchema,
  financePayments: paymentSchema,
  financeTransfers: transferSchema,
  benefitLedger: benefitSchema,
  financeCredits: creditSchema,
  financeBudgets: budgetSchema,
  financeSettings: financeSettingsSchema,
  financeOperations: operationSchema,
  financeChanges: changeSchema,
};

import { db } from "../../db/database";
import {
  paymentRequestSchema,
  positiveCents,
} from "../../features/finance/models";
import { pastDateSchema } from "../../features/habits/models";
import { entryRemaining, invoiceBalances } from "./calculations";
import { uuid, now, mutate, change, account, category } from "./transaction";
export async function payTarget(
  input: {
    id: string;
    targetType: "entry" | "invoice";
    targetId: string;
    accountId: string;
    amount: number;
    date: string;
    eligibilityConfirmed: boolean;
  },
  operationId: string,
  database = db,
) {
  input = paymentRequestSchema.parse(input);
  positiveCents.parse(input.amount);
  pastDateSchema.parse(input.date);
  return mutate(
    operationId,
    "payment",
    input,
    async (data) => {
      const bank = account(data, input.accountId, input.date);
      if (data.payments.some((p) => p.id === input.id))
        throw new Error("Pagamento já registrado.");
      if (input.targetType === "entry") {
        const entry = data.entries.find((e) => e.id === input.targetId);
        if (!entry || entry.status === "cancelled")
          throw new Error("Lançamento indisponível.");
        if (entry.accountId !== input.accountId)
          throw new Error("Use a conta vinculada ao lançamento.");
        if (input.amount > entryRemaining(data, entry))
          throw new Error("O valor supera o saldo pendente.");
        if (bank.type === "benefit") {
          const cat = category(data, entry.categoryId, entry.kind);
          if (
            entry.kind === "expense" &&
            !cat.benefitEligible &&
            !input.eligibilityConfirmed
          )
            throw new Error(
              "Confirme explicitamente o uso do benefício nesta categoria não elegível.",
            );
          await database.benefitLedger.add({
            id: uuid(),
            accountId: bank.id,
            kind: entry.kind === "income" ? "credit" : "consume",
            amount: input.amount,
            categoryId: cat.id,
            description: entry.description,
            date: input.date,
            status: "active",
            paymentId: input.id,
            eligibilityConfirmed: input.eligibilityConfirmed,
          });
        }
      } else {
        if (bank.type === "benefit")
          throw new Error("Benefício não paga fatura bancária.");
        const invoice = data.invoices.find((i) => i.id === input.targetId);
        if (!invoice) throw new Error("Fatura não encontrada.");
        const remaining =
          invoiceBalances(data, invoice.cardId).find((i) => i.id === invoice.id)
            ?.remaining ?? 0;
        if (input.amount > remaining)
          throw new Error("O pagamento supera o saldo da fatura.");
      }
      const payment = {
        id: input.id,
        targetType: input.targetType,
        targetId: input.targetId,
        accountId: input.accountId,
        amount: input.amount,
        date: input.date,
        status: "active" as const,
      };
      await database.financePayments.add(payment);
      await change(
        database,
        operationId,
        payment.id,
        "payment",
        undefined,
        payment,
      );
      return payment.id;
    },
    database,
  );
}

export async function reversePayment(
  id: string,
  operationId: string,
  database = db,
) {
  return mutate(
    operationId,
    "reverse-payment",
    { id },
    async (data) => {
      const old = data.payments.find((p) => p.id === id);
      if (!old) throw new Error("Pagamento não encontrado.");
      if (old.status === "reversed") return id;
      await database.financePayments.update(id, {
        status: "reversed",
        reversedAt: now(),
      });
      for (const movement of data.benefits.filter((b) => b.paymentId === id))
        await database.benefitLedger.update(movement.id, {
          status: "reversed",
        });
      await change(database, operationId, id, "reverse-payment", old, {
        ...old,
        status: "reversed",
      });
      return id;
    },
    database,
  );
}

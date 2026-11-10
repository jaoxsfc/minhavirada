import { db } from "../../db/database";
import {
  cardSchema,
  purchaseSchema,
  type Card,
  type Purchase,
} from "../../features/finance/models";
import { pastDateSchema } from "../../features/habits/models";
import { splitInstallments } from "./money";
import { invoiceCycle, dateAtDay } from "./dates";
import { monthShift } from "../../lib/calendar";
import {
  uuid,
  mutate,
  change,
  account,
  category,
  revision,
} from "./transaction";
export async function saveCard(
  input: Card,
  operationId: string,
  database = db,
) {
  const value = cardSchema.parse(input);
  return mutate(
    operationId,
    "card",
    value,
    async (data) => {
      const paymentAccount = account(data, value.accountId);
      if (paymentAccount.type === "benefit")
        throw new Error("Faturas precisam de uma conta bancária ou carteira.");
      const old = data.cards.find((c) => c.id === value.id);
      revision(old, value);
      if (
        old &&
        (old.closingDay !== value.closingDay || old.dueDay !== value.dueDay) &&
        data.purchases.some((p) => p.cardId === old.id)
      )
        throw new Error(
          "Este cartão tem histórico. Crie um novo cadastro para outro ciclo; faturas antigas não serão reescritas.",
        );
      await database.financeCards.put(value);
      await change(database, operationId, value.id, "card", old, value);
      return value.id;
    },
    database,
  );
}

export async function addPurchase(
  input: Purchase,
  operationId: string,
  database = db,
) {
  const value = purchaseSchema.parse(input);
  if (value.status !== "active")
    throw new Error("Uma compra deve começar ativa.");
  return mutate(
    operationId,
    "purchase",
    value,
    async (data) => {
      const card = data.cards.find(
        (c) => c.id === value.cardId && c.status === "active",
      );
      if (!card) throw new Error("Selecione um cartão ativo.");
      category(data, value.categoryId, "expense");
      if (data.purchases.some((p) => p.id === value.id))
        throw new Error("Compra já registrada.");
      await database.financePurchases.add(value);
      const first = invoiceCycle(value.date, card.closingDay, card.dueDay);
      const amounts = splitInstallments(value.amount, value.installments);
      for (let i = 0; i < amounts.length; i++) {
        const month = monthShift(first.cycleMonth, i);
        let invoice = await database.financeInvoices
          .where("[cardId+cycleMonth]")
          .equals([card.id, month])
          .first();
        if (!invoice) {
          invoice = {
            id: uuid(),
            cardId: card.id,
            cycleMonth: month,
            closingDate: dateAtDay(month, card.closingDay),
            dueDate: dateAtDay(
              monthShift(month, card.dueDay <= card.closingDay ? 1 : 0),
              card.dueDay,
            ),
          };
          await database.financeInvoices.add(invoice);
        }
        await database.financeInstallments.add({
          id: uuid(),
          purchaseId: value.id,
          invoiceId: invoice.id,
          number: i + 1,
          amount: amounts[i],
        });
      }
      await change(
        database,
        operationId,
        value.id,
        "purchase",
        undefined,
        value,
      );
      return value.id;
    },
    database,
  );
}

export async function refundPurchase(
  id: string,
  date: string,
  operationId: string,
  database = db,
) {
  pastDateSchema.parse(date);
  return mutate(
    operationId,
    "refund",
    { id, date },
    async (data) => {
      const purchase = data.purchases.find((p) => p.id === id);
      if (!purchase) throw new Error("Compra não encontrada.");
      if (date < purchase.date)
        throw new Error("O estorno não pode anteceder a compra.");
      if (purchase.status === "refunded") return id;
      for (const installment of data.installments.filter(
        (i) => i.purchaseId === id,
      )) {
        await database.financeCredits.add({
          id: uuid(),
          purchaseId: id,
          installmentId: installment.id,
          invoiceId: installment.invoiceId,
          amount: installment.amount,
          date,
        });
      }
      await database.financePurchases.update(id, { status: "refunded" });
      await change(database, operationId, id, "refund", purchase, {
        ...purchase,
        status: "refunded",
      });
      return id;
    },
    database,
  );
}

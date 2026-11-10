import { db } from "../../db/database";
import {
  transferSchema,
  benefitSchema,
  type Transfer,
  type BenefitMovement,
} from "../../features/finance/models";
import { mutate, change, account, category } from "./transaction";
export async function addTransfer(
  input: Transfer,
  operationId: string,
  database = db,
) {
  const value = transferSchema.parse(input);
  if (value.status !== "active") throw new Error("Estado inválido.");
  return mutate(
    operationId,
    "transfer",
    value,
    async (data) => {
      const from = account(data, value.fromId, value.date),
        to = account(data, value.toId, value.date);
      if (from.type === "benefit" || to.type === "benefit")
        throw new Error(
          "O benefício não pode ser convertido em saldo bancário por transferência.",
        );
      if (data.transfers.some((t) => t.id === value.id))
        throw new Error("Transferência já registrada.");
      await database.financeTransfers.add(value);
      await change(
        database,
        operationId,
        value.id,
        "transfer",
        undefined,
        value,
      );
      return value.id;
    },
    database,
  );
}

export async function reverseTransfer(
  id: string,
  operationId: string,
  database = db,
) {
  return mutate(
    operationId,
    "reverse-transfer",
    { id },
    async (data) => {
      const old = data.transfers.find((t) => t.id === id);
      if (!old) throw new Error("Transferência não encontrada.");
      if (old.status === "reversed") return id;
      await database.financeTransfers.update(id, { status: "reversed" });
      await change(database, operationId, id, "reverse-transfer", old, {
        ...old,
        status: "reversed",
      });
      return id;
    },
    database,
  );
}

export async function addBenefit(
  input: BenefitMovement,
  operationId: string,
  database = db,
) {
  const value = benefitSchema.parse(input);
  if (value.paymentId || value.status !== "active")
    throw new Error("Use o fluxo de pagamento para lançamentos vinculados.");
  return mutate(
    operationId,
    "benefit",
    value,
    async (data) => {
      const acc = account(data, value.accountId, value.date);
      if (acc.type !== "benefit")
        throw new Error("Selecione uma conta de benefício.");
      if (value.kind === "consume") {
        const cat = category(data, value.categoryId ?? "", "expense");
        if (!cat.benefitEligible && !value.eligibilityConfirmed)
          throw new Error("Confirme explicitamente a categoria não elegível.");
      }
      if (data.benefits.some((b) => b.id === value.id))
        throw new Error("Movimento já registrado.");
      await database.benefitLedger.add(value);
      await change(
        database,
        operationId,
        value.id,
        "benefit",
        undefined,
        value,
      );
      return value.id;
    },
    database,
  );
}

export async function reverseBenefit(
  id: string,
  operationId: string,
  database = db,
) {
  return mutate(
    operationId,
    "reverse-benefit",
    { id },
    async (data) => {
      const old = data.benefits.find((b) => b.id === id);
      if (!old) throw new Error("Movimento não encontrado.");
      if (old.paymentId)
        throw new Error(
          "Estorne o pagamento vinculado, para preservar a consistência.",
        );
      if (old.status === "reversed") return id;
      await database.benefitLedger.update(id, { status: "reversed" });
      await change(database, operationId, id, "reverse-benefit", old, {
        ...old,
        status: "reversed",
      });
      return id;
    },
    database,
  );
}

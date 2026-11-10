import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { financeFixture, uid, refDate, type Fixture } from "./finance-fixtures";
import {
  saveEntry,
  payTarget,
  reversePayment,
  addTransfer,
  reverseTransfer,
  addBenefit,
  reverseBenefit,
  saveCard,
  addPurchase,
  refundPurchase,
  saveAccount,
  saveCategory,
  cancelEntry,
  saveBudget,
  saveFinanceSettings,
} from "../services/finance/commands";
import {
  bankBalance,
  benefitBalance,
  accountBalance,
  entryStatus,
  cashFlow,
  competenceExpenses,
  invoiceBalances,
  budgetUsage,
} from "../services/finance/calculations";
import { readFinance } from "../repositories/finance-data";
import { financeDefaults } from "../features/finance/models";
let f: Fixture;
beforeEach(async () => {
  f = await financeFixture();
});
afterEach(async () => {
  await f.db.delete();
});
async function pay(amount = 10000) {
  return payTarget(
    {
      id: uid(),
      targetType: "entry",
      targetId: f.entry.id,
      accountId: f.bank.id,
      amount,
      date: refDate,
      eligibilityConfirmed: false,
    },
    uid(),
    f.db,
  );
}
describe("Saldo bancário e pagamentos", () => {
  it("previsão e pendência não movimentam saldo real", async () => {
    await saveEntry(f.entry, uid(), f.db);
    await saveEntry(
      {
        ...f.entry,
        id: uid(),
        kind: "income",
        categoryId: f.income.id,
        amount: 250000,
        status: "planned",
      },
      uid(),
      f.db,
    );
    const data = await readFinance(f.db);
    expect(bankBalance(data, refDate)).toBe(100000);
    expect(benefitBalance(data, refDate)).toBe(120000);
    expect(cashFlow(data, "2024-01-01", "2024-12-31")).toHaveLength(0);
  });
  it("paga parcialmente, conclui e estorna recalculando o saldo", async () => {
    await saveEntry(f.entry, uid(), f.db);
    const first = await pay(4000);
    let data = await readFinance(f.db);
    expect(entryStatus(data, f.entry)).toBe("partial");
    expect(bankBalance(data, refDate)).toBe(96000);
    await pay(6000);
    data = await readFinance(f.db);
    expect(entryStatus(data, f.entry)).toBe("paid");
    await reversePayment(first, uid(), f.db);
    data = await readFinance(f.db);
    expect(bankBalance(data, refDate)).toBe(94000);
    expect(entryStatus(data, f.entry)).toBe("partial");
  });
  it("recebimento confirmado aumenta apenas a conta correta", async () => {
    const e = { ...f.entry, kind: "income" as const, categoryId: f.income.id };
    await saveEntry(e, uid(), f.db);
    await pay();
    expect(bankBalance(await readFinance(f.db), refDate)).toBe(110000);
  });
  it("previne pagamento duplicado por token e rejeita reutilização divergente", async () => {
    await saveEntry(f.entry, uid(), f.db);
    const input = {
      id: uid(),
      targetType: "entry" as const,
      targetId: f.entry.id,
      accountId: f.bank.id,
      amount: 4000,
      date: refDate,
      eligibilityConfirmed: false,
    };
    const token = uid();
    await payTarget(input, token, f.db);
    await payTarget(input, token, f.db);
    expect(await f.db.financePayments.count()).toBe(1);
    await expect(
      payTarget({ ...input, amount: 5000 }, token, f.db),
    ).rejects.toThrow("identificador");
  });
  it("serializa dois pagamentos que tentam quitar o mesmo saldo", async () => {
    await saveEntry(f.entry, uid(), f.db);
    const result = await Promise.allSettled([pay(), pay()]);
    expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await f.db.financePayments.count()).toBe(1);
  });
  it("preserva auditoria e impede edição/cancelamento de valor já pago", async () => {
    await saveEntry(f.entry, uid(), f.db);
    await pay(1000);
    await expect(
      saveEntry({ ...f.entry, amount: 9000, revision: 2 }, uid(), f.db),
    ).rejects.toThrow("Estorne");
    await expect(cancelEntry(f.entry.id, uid(), f.db)).rejects.toThrow(
      "Estorne",
    );
    expect((await f.db.financeEntries.get(f.entry.id))?.amount).toBe(10000);
  });
  it("cancela sem apagar o histórico e rejeita revisão antiga", async () => {
    await saveEntry(f.entry, uid(), f.db);
    await saveEntry(
      { ...f.entry, description: "Editada", revision: 2 },
      uid(),
      f.db,
    );
    await expect(
      saveEntry({ ...f.entry, revision: 2 }, uid(), f.db),
    ).rejects.toThrow("outra tela");
    await cancelEntry(f.entry.id, uid(), f.db);
    expect(await f.db.financeEntries.count()).toBe(1);
    expect((await f.db.financeEntries.get(f.entry.id))?.status).toBe(
      "cancelled",
    );
    expect(
      await f.db.financeChanges.where("entityId").equals(f.entry.id).count(),
    ).toBe(3);
  });
  it("impede redefinir o saldo inicial de conta utilizada", async () => {
    await saveEntry(f.entry, uid(), f.db);
    await expect(
      saveAccount(
        { ...f.bank, openingBalance: 200000, revision: 2 },
        uid(),
        f.db,
      ),
    ).rejects.toThrow("protegidos");
    expect((await f.db.financeAccounts.get(f.bank.id))?.openingBalance).toBe(
      100000,
    );
  });
  it("rejeita pagamento antes da referência e no futuro", async () => {
    await saveEntry(f.entry, uid(), f.db);
    const input = {
      id: uid(),
      targetType: "entry" as const,
      targetId: f.entry.id,
      accountId: f.bank.id,
      amount: 100,
      date: "2023-12-31",
      eligibilityConfirmed: false,
    };
    await expect(payTarget(input, uid(), f.db)).rejects.toThrow("anterior");
    await expect(
      payTarget({ ...input, date: "2099-01-01" }, uid(), f.db),
    ).rejects.toThrow();
  });
  it("operações compostas são revertidas se a auditoria falhar", async () => {
    await saveEntry(f.entry, uid(), f.db);
    f.db.financeChanges.hook("creating", () => {
      throw new Error("audit-failed");
    });
    await expect(pay()).rejects.toThrow("audit-failed");
    expect(await f.db.financePayments.count()).toBe(0);
    expect(bankBalance(await readFinance(f.db), refDate)).toBe(100000);
  });
});
describe("Transferências e ticket", () => {
  it("transferências não são receita nem despesa e mantêm o total bancário", async () => {
    const transfer = {
      id: uid(),
      fromId: f.bank.id,
      toId: f.savings.id,
      amount: 20000,
      date: refDate,
      status: "active" as const,
    };
    await addTransfer(transfer, uid(), f.db);
    let data = await readFinance(f.db);
    expect(accountBalance(data, f.bank.id, refDate)).toBe(80000);
    expect(accountBalance(data, f.savings.id, refDate)).toBe(20000);
    expect(bankBalance(data, refDate)).toBe(100000);
    expect(cashFlow(data, "2024-01-01", "2024-12-31")).toHaveLength(0);
    await reverseTransfer(transfer.id, uid(), f.db);
    data = await readFinance(f.db);
    expect(accountBalance(data, f.bank.id, refDate)).toBe(100000);
  });
  it("não permite transformar o benefício em dinheiro livre", async () => {
    await expect(
      addTransfer(
        {
          id: uid(),
          fromId: f.benefit.id,
          toId: f.bank.id,
          amount: 100,
          date: refDate,
          status: "active",
        },
        uid(),
        f.db,
      ),
    ).rejects.toThrow("benefício");
  });
  it("ticket acumula créditos e ajustes com consumo separado", async () => {
    const base = {
      accountId: f.benefit.id,
      description: "Ticket",
      date: refDate,
      status: "active" as const,
      eligibilityConfirmed: false,
    };
    await addBenefit(
      { ...base, id: uid(), kind: "credit", amount: 120000 },
      uid(),
      f.db,
    );
    const consume = {
      ...base,
      id: uid(),
      kind: "consume" as const,
      categoryId: f.food.id,
      amount: 35000,
    };
    await addBenefit(consume, uid(), f.db);
    await addBenefit(
      { ...base, id: uid(), kind: "adjustment", amount: -1000 },
      uid(),
      f.db,
    );
    let data = await readFinance(f.db);
    expect(benefitBalance(data, refDate)).toBe(204000);
    expect(bankBalance(data, refDate)).toBe(100000);
    await reverseBenefit(consume.id, uid(), f.db);
    data = await readFinance(f.db);
    expect(benefitBalance(data, refDate)).toBe(239000);
  });
  it("categoria incompatível exige consentimento explícito", async () => {
    const movement = {
      id: uid(),
      accountId: f.benefit.id,
      kind: "consume" as const,
      categoryId: f.expense.id,
      amount: 1000,
      description: "Exceção",
      date: refDate,
      status: "active" as const,
      eligibilityConfirmed: false,
    };
    await expect(addBenefit(movement, uid(), f.db)).rejects.toThrow(
      "explicitamente",
    );
    await addBenefit({ ...movement, eligibilityConfirmed: true }, uid(), f.db);
    expect(await f.db.benefitLedger.count()).toBe(1);
  });
  it("pagamento pelo ticket cria um único movimento vinculado e estorno consistente", async () => {
    const e = { ...f.entry, accountId: f.benefit.id, categoryId: f.food.id };
    await saveEntry(e, uid(), f.db);
    const id = await payTarget(
      {
        id: uid(),
        targetType: "entry",
        targetId: e.id,
        accountId: f.benefit.id,
        amount: 10000,
        date: refDate,
        eligibilityConfirmed: false,
      },
      uid(),
      f.db,
    );
    let data = await readFinance(f.db);
    expect(benefitBalance(data, refDate)).toBe(110000);
    expect(bankBalance(data, refDate)).toBe(100000);
    expect(await f.db.benefitLedger.count()).toBe(1);
    await reversePayment(id, uid(), f.db);
    data = await readFinance(f.db);
    expect(benefitBalance(data, refDate)).toBe(120000);
  });
});
describe("Cartões, faturas e relatórios", () => {
  it("parcelas somam o total e compra não reduz a conta bancária", async () => {
    await saveCard(f.card, uid(), f.db);
    await addPurchase(f.purchase, uid(), f.db);
    const data = await readFinance(f.db);
    expect(data.installments.map((i) => i.amount).sort()).toEqual([
      3333, 3334, 3334,
    ]);
    expect(data.invoices).toHaveLength(3);
    expect(bankBalance(data, refDate)).toBe(100000);
  });
  it("fatura parcial reduz caixa sem duplicar a despesa por competência", async () => {
    await saveCard(f.card, uid(), f.db);
    await addPurchase(f.purchase, uid(), f.db);
    const invoice = (await readFinance(f.db)).invoices.sort((a, b) =>
      a.cycleMonth.localeCompare(b.cycleMonth),
    )[0];
    await payTarget(
      {
        id: uid(),
        targetType: "invoice",
        targetId: invoice.id,
        accountId: f.bank.id,
        amount: 1000,
        date: refDate,
        eligibilityConfirmed: false,
      },
      uid(),
      f.db,
    );
    const data = await readFinance(f.db);
    expect(bankBalance(data, refDate)).toBe(99000);
    expect(
      invoiceBalances(data, f.card.id).find((i) => i.id === invoice.id)
        ?.remaining,
    ).toBe(2334);
    expect(
      competenceExpenses(data, "2024-01-01", "2024-12-31").reduce(
        (n, r) => n + r.amount,
        0,
      ),
    ).toBe(10001);
    expect(
      cashFlow(data, "2024-01-01", "2024-12-31").reduce(
        (n, p) => n + p.amount,
        0,
      ),
    ).toBe(-1000);
  });
  it("estorno após pagamento cria crédito no cartão e não devolve caixa fictício", async () => {
    await saveCard(f.card, uid(), f.db);
    await addPurchase(f.purchase, uid(), f.db);
    const invoice = (await readFinance(f.db)).invoices.sort((a, b) =>
      a.cycleMonth.localeCompare(b.cycleMonth),
    )[0];
    await payTarget(
      {
        id: uid(),
        targetType: "invoice",
        targetId: invoice.id,
        accountId: f.bank.id,
        amount: 1000,
        date: refDate,
        eligibilityConfirmed: false,
      },
      uid(),
      f.db,
    );
    await refundPurchase(f.purchase.id, "2024-01-16", uid(), f.db);
    await refundPurchase(f.purchase.id, "2024-01-16", uid(), f.db);
    const data = await readFinance(f.db);
    expect(data.credits).toHaveLength(3);
    expect(bankBalance(data, "2024-01-31")).toBe(99000);
    expect(invoiceBalances(data, f.card.id).at(-1)?.creditBalance).toBe(1000);
    expect(
      competenceExpenses(data, "2024-01-01", "2024-12-31").reduce(
        (n, r) => n + r.amount,
        0,
      ),
    ).toBe(0);
  });
  it("protege ciclos de cartão com histórico e pagamento com ticket", async () => {
    await saveCard(f.card, uid(), f.db);
    await addPurchase(f.purchase, uid(), f.db);
    await expect(
      saveCard({ ...f.card, closingDay: 10, revision: 2 }, uid(), f.db),
    ).rejects.toThrow("histórico");
    const invoice = (await readFinance(f.db)).invoices.sort((a, b) =>
      a.cycleMonth.localeCompare(b.cycleMonth),
    )[0];
    await expect(
      payTarget(
        {
          id: uid(),
          targetType: "invoice",
          targetId: invoice.id,
          accountId: f.benefit.id,
          amount: 100,
          date: refDate,
          eligibilityConfirmed: false,
        },
        uid(),
        f.db,
      ),
    ).rejects.toThrow("Benefício");
  });
  it("orçamento é único por mês/categoria/fonte e não altera saldo", async () => {
    await saveEntry(f.entry, uid(), f.db);
    const b = {
      id: uid(),
      month: "2024-01",
      categoryId: f.expense.id,
      scope: "bank" as const,
      amount: 9000,
    };
    await saveBudget(b, uid(), f.db);
    await saveBudget({ ...b, id: uid(), amount: 11000 }, uid(), f.db);
    const data = await readFinance(f.db);
    expect(data.budgets).toHaveLength(1);
    expect(budgetUsage(data, "2024-01", f.expense.id, "bank")).toBe(10000);
    expect(bankBalance(data, refDate)).toBe(100000);
  });
  it("onboarding salva só parâmetros e categorias confirmadas, sem dinheiro real", async () => {
    await saveFinanceSettings(
      { ...financeDefaults, updatedAt: new Date().toISOString() },
      uid(),
      true,
      f.db,
    );
    expect(await f.db.financeEntries.count()).toBe(0);
    expect(await f.db.financePayments.count()).toBe(0);
    expect(await f.db.benefitLedger.count()).toBe(0);
    expect(await f.db.financeRules.count()).toBe(0);
    const count = await f.db.financeCategories.count();
    await saveFinanceSettings(
      { ...financeDefaults, updatedAt: new Date().toISOString() },
      uid(),
      true,
      f.db,
    );
    expect(await f.db.financeCategories.count()).toBe(count);
  });
  it("preserva dados financeiros ao fechar e reabrir o banco", async () => {
    await saveEntry(f.entry, uid(), f.db);
    await pay();
    f.db.close();
    await f.db.open();
    expect(bankBalance(await readFinance(f.db), refDate)).toBe(90000);
  });
});

it("elegibilidade de categoria já utilizada não muda retroativamente", async () => {
  await addBenefit(
    {
      id: uid(),
      accountId: f.benefit.id,
      categoryId: f.food.id,
      kind: "consume",
      amount: 100,
      description: "Consumo confirmado",
      date: refDate,
      status: "active",
      eligibilityConfirmed: false,
    },
    uid(),
    f.db,
  );
  await expect(
    saveCategory({ ...f.food, benefitEligible: false }, uid(), f.db),
  ).rejects.toThrow("histórica");
});

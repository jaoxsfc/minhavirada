import { bankBalance, accountBalance } from "../services/finance/calculations";
import { beforeEach, afterEach, it, expect } from "vitest";
import { financeFixture, uid, refDate, type Fixture } from "./finance-fixtures";
import {
  newGoal,
  newProject,
  saveGoal,
  saveProject,
  saveMilestone,
  contribute,
  postProject,
  saveTime,
  confirmGoalSuggestion,
  saveLinkedTask,
  linkTask,
} from "../repositories/future";
import { readFuture } from "../repositories/future-data";
import { readFinance } from "../repositories/finance-data";
import {
  allocated,
  goalProgress,
  projectMetrics,
  opportunitySummary,
} from "../services/future-calculations";
import {
  saveEntry,
  payTarget,
  reversePayment,
  addTransfer,
  reverseTransfer,
  saveAccount,
} from "../services/finance/commands";
import { now } from "../services/finance/transaction";
import { localDate } from "../lib/date";
import { shiftDate } from "../lib/calendar";
import { taskOccurrences } from "../services/routines";
import type { Goal, Project } from "../features/future/models";
let f: Fixture, goal: Goal, project: Project;
beforeEach(async () => {
  f = await financeFixture();
  goal = {
    ...newGoal(),
    title: "Reserva real",
    type: "financial",
    category: "Reserva",
    target: 100000,
    startDate: "2024-01-01",
  };
  project = { ...newProject(), service: "Projeto real" };
  await saveGoal(goal, uid(), f.db);
  await saveProject(project, uid(), f.db);
});
afterEach(async () => {
  await f.db.delete();
});
const move = (amount = 10000, extra = {}) => ({
  id: uid(),
  goalId: goal.id,
  accountId: f.bank.id,
  kind: "allocate" as const,
  amount,
  date: refDate,
  notes: "",
  fromAccountId: null,
  transferId: uid(),
  ...extra,
});
const post = (amount = 10000, extra = {}) => ({
  id: uid(),
  projectId: project.id,
  kind: "income" as const,
  accountId: f.bank.id,
  categoryId: f.income.id,
  amount,
  date: refDate,
  description: "Recebimento parcial",
  entryId: uid(),
  paymentId: uid(),
  ...extra,
});
it("cria, edita e arquiva metas sem alterar saldos", async () => {
  await saveGoal(
    { ...goal, title: "Reserva editada", status: "archived", revision: 2 },
    uid(),
    f.db,
  );
  expect((await f.db.goals.get(goal.id))?.title).toBe("Reserva editada");
  expect(await f.db.financePayments.count()).toBe(0);
  expect(await f.db.goalMovements.count()).toBe(0);
});
it("protege edição concorrente e valida centavos inteiros", async () => {
  await expect(
    saveGoal({ ...goal, target: 12.5 }, uid(), f.db),
  ).rejects.toThrow();
  await expect(
    saveGoal({ ...goal, title: "Conflito" }, uid(), f.db),
  ).rejects.toThrow("outra tela");
});
it("preserva uma única sugestão confirmada, com marcos livremente editáveis", async () => {
  const [a, b] = await Promise.all([
    confirmGoalSuggestion("wedding", f.db),
    confirmGoalSuggestion("wedding", f.db),
  ]);
  expect(a).toBe(b);
  expect(await f.db.goalMilestones.where("goalId").equals(a).count()).toBe(4);
  expect((await f.db.goals.get(a))?.target).toBeNull();
  expect((await f.db.goals.get(a))?.deadline).toBe("");
});
it("moradia começa sem orçamento presumido e confirmação não movimenta banco", async () => {
  const id = await confirmGoalSuggestion("housing", f.db);
  expect(
    (await f.db.goalMilestones.where("goalId").equals(id).toArray()).every(
      (m) => m.budget === null,
    ),
  ).toBe(true);
  expect(await f.db.financeTransfers.count()).toBe(0);
});
it("aloca saldo existente sem aumentar patrimônio e permite retirada com histórico", async () => {
  await contribute(move(40000), uid(), f.db);
  await contribute(move(15000, { kind: "withdraw" }), uid(), f.db);
  const data = await readFuture(f.db),
    p = goalProgress(goal, data);
  expect(p.reserved).toBe(25000);
  expect(p.remaining).toBe(75000);
  expect(p.percent).toBe(25);
  expect(data.movements).toHaveLength(2);
  expect(
    (await readFinance(f.db)).accounts.find((a) => a.id === f.bank.id)
      ?.openingBalance,
  ).toBe(100000);
  expect(await f.db.financePayments.count()).toBe(0);
});
it("reenvio idempotente não duplica e mudança de payload é rejeitada", async () => {
  const m = move(),
    op = uid();
  await Promise.all([contribute(m, op, f.db), contribute(m, op, f.db)]);
  expect(await f.db.goalMovements.count()).toBe(1);
  await expect(contribute({ ...m, amount: 1 }, op, f.db)).rejects.toThrow(
    "identificador",
  );
  await expect(contribute(m, uid(), f.db)).rejects.toThrow("já registrada");
});
it("o mesmo saldo não pode sustentar duas metas", async () => {
  await contribute(move(70000), uid(), f.db);
  const second = { ...goal, id: uid() };
  await saveGoal(second, uid(), f.db);
  await expect(
    contribute(move(40000, { goalId: second.id }), uid(), f.db),
  ).rejects.toThrow("Saldo insuficiente");
  expect(await f.db.goalMovements.count()).toBe(1);
});
it("concorrência entre reservas é serializada atomicamente", async () => {
  const results = await Promise.allSettled([
    contribute(move(70000), uid(), f.db),
    contribute(move(70000), uid(), f.db),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(allocated(await f.db.goalMovements.toArray())).toBe(70000);
});
it("ticket e receita prevista não viram reserva", async () => {
  await expect(
    contribute(move(10000, { accountId: f.benefit.id }), uid(), f.db),
  ).rejects.toThrow("Ticket");
  await saveEntry(
    {
      ...f.entry,
      kind: "income",
      accountId: f.savings.id,
      categoryId: f.income.id,
    },
    uid(),
    f.db,
  );
  await expect(
    contribute(move(10000, { accountId: f.savings.id }), uid(), f.db),
  ).rejects.toThrow("Saldo insuficiente");
});
it("retirada acima da alocação, futura ou anterior ao início é rejeitada", async () => {
  await expect(
    contribute(move(1, { kind: "withdraw" }), uid(), f.db),
  ).rejects.toThrow("retirada");
  await expect(
    contribute(move(1, { date: shiftDate(localDate(), 1) }), uid(), f.db),
  ).rejects.toThrow();
  await expect(
    contribute(move(1, { date: "2023-12-31" }), uid(), f.db),
  ).rejects.toThrow("anteceder");
});
it("transferência real mais alocação usa serviço existente sem criar renda", async () => {
  const m = move(20000, { accountId: f.savings.id, fromAccountId: f.bank.id }),
    op = uid();
  await contribute(m, op, f.db);
  await contribute(m, op, f.db);
  const fin = await readFinance(f.db);
  expect(fin.transfers).toHaveLength(1);
  expect(fin.payments).toHaveLength(0);
  expect(
    fin.accounts.reduce(
      (n, a) => n + (a.type === "benefit" ? 0 : a.openingBalance),
      0,
    ),
  ).toBe(100000);
  expect(allocated((await readFuture(f.db)).movements, goal.id)).toBe(20000);
  expect(fin.transfers[0].amount).toBe(20000);
  expect(bankBalance(fin, refDate)).toBe(100000);
  expect(accountBalance(fin, f.bank.id, refDate)).toBe(80000);
  expect(accountBalance(fin, f.savings.id, refDate)).toBe(20000);
});
it("falha em transferência composta reverte tudo, inclusive operações internas", async () => {
  const before = await f.db.financeOperations.count();
  await expect(
    contribute(
      move(150000, { accountId: f.savings.id, fromAccountId: f.bank.id }),
      uid(),
      f.db,
    ),
  ).rejects.toThrow("Saldo insuficiente");
  expect(await f.db.financeTransfers.count()).toBe(0);
  expect(await f.db.goalMovements.count()).toBe(0);
  expect(await f.db.financeOperations.count()).toBe(before);
});
it("pagamento não consome saldo reservado; liberação mantém histórico e permite pagar", async () => {
  await contribute(move(100000), uid(), f.db);
  await saveEntry(f.entry, uid(), f.db);
  const p = {
    id: uid(),
    targetType: "entry" as const,
    targetId: f.entry.id,
    accountId: f.bank.id,
    amount: 10000,
    date: refDate,
    eligibilityConfirmed: false,
  };
  await expect(payTarget(p, uid(), f.db)).rejects.toThrow("Libere");
  await contribute(move(10000, { kind: "withdraw" }), uid(), f.db);
  await payTarget(p, uid(), f.db);
  expect(await f.db.financePayments.count()).toBe(1);
  expect(allocated(await f.db.goalMovements.toArray())).toBe(90000);
});
it("transferência avulsa não usa dinheiro reservado e edição de saldo também é protegida", async () => {
  await contribute(move(100000), uid(), f.db);
  await expect(
    addTransfer(
      {
        id: uid(),
        fromId: f.bank.id,
        toId: f.savings.id,
        amount: 1,
        date: refDate,
        status: "active",
      },
      uid(),
      f.db,
    ),
  ).rejects.toThrow("reservas");
  await expect(
    saveAccount({ ...f.bank, openingBalance: 100, revision: 2 }, uid(), f.db),
  ).rejects.toThrow();
});
it("estorno de receita não deixa reserva sem lastro", async () => {
  const p = post(30000, { accountId: f.savings.id });
  await postProject(p, uid(), f.db);
  await contribute(move(30000, { accountId: f.savings.id }), uid(), f.db);
  await expect(reversePayment(p.paymentId, uid(), f.db)).rejects.toThrow(
    "reservas",
  );
  expect((await f.db.financePayments.get(p.paymentId))?.status).toBe("active");
});
it("estorno da transferência vinculada sem lastro é bloqueado", async () => {
  const m = move(20000, { accountId: f.savings.id, fromAccountId: f.bank.id });
  await contribute(m, uid(), f.db);
  await expect(reverseTransfer(m.transferId, uid(), f.db)).rejects.toThrow(
    "reservas",
  );
});
it("pagamento retroativo não invalida alocações anteriores", async () => {
  await contribute(move(100000, { date: "2024-02-01" }), uid(), f.db);
  await saveEntry(f.entry, uid(), f.db);
  await expect(
    payTarget(
      {
        id: uid(),
        targetType: "entry",
        targetId: f.entry.id,
        accountId: f.bank.id,
        amount: 10000,
        date: refDate,
        eligibilityConfirmed: false,
      },
      uid(),
      f.db,
    ),
  ).rejects.toThrow("reservas");
});
it("marcos pessoais medem progresso e editam orçamento sem movimentação financeira", async () => {
  const g = {
    ...newGoal(),
    title: "Casamento pessoal",
    startDate: "2024-01-01",
  };
  await saveGoal(g, uid(), f.db);
  const m = {
    id: uid(),
    goalId: g.id,
    title: "Definir orçamento",
    deadline: "2024-03-01",
    budget: 50000,
    completed: false,
    notes: "",
    revision: 1,
    createdAt: now(),
    updatedAt: now(),
  };
  await saveMilestone(m, uid(), f.db);
  await saveMilestone({ ...m, completed: true, revision: 2 }, uid(), f.db);
  expect(goalProgress(g, await readFuture(f.db)).percent).toBe(100);
  expect(await f.db.financeEntries.count()).toBe(0);
});
it("meta sem alvo ou marcos não inventa percentual", async () => {
  expect(
    goalProgress({ ...goal, target: null }, await readFuture(f.db)).percent,
  ).toBeNull();
  expect(
    goalProgress(
      { ...goal, type: "personal", target: null },
      await readFuture(f.db),
    ).percent,
  ).toBeNull();
});
it("projeção exige janela completa e não extrapola alocação inicial", async () => {
  const today = localDate();
  const start = shiftDate(today, -120);
  const g = { ...goal, startDate: start };
  await saveGoal({ ...g, revision: 2 }, uid(), f.db);
  await contribute(move(10000, { date: start }), uid(), f.db);
  expect(goalProgress(g, await readFuture(f.db)).projection).toBeNull();
  await contribute(move(30000, { date: shiftDate(today, -30) }), uid(), f.db);
  expect(goalProgress(g, await readFuture(f.db)).projection).not.toBeNull();
  expect(
    goalProgress(
      { ...g, startDate: shiftDate(today, -10) },
      await readFuture(f.db),
    ).projection,
  ).toBeNull();
});
it("histórico mensal inclui retiradas, sem transformar previsão em contribuição", async () => {
  await contribute(move(10000, { date: localDate() }), uid(), f.db);
  await contribute(
    move(2500, { kind: "withdraw", date: localDate() }),
    uid(),
    f.db,
  );
  const p = goalProgress(goal, await readFuture(f.db));
  expect(p.monthly.at(-1)?.net).toBe(7500);
  expect(p.monthly.at(-1)?.total).toBe(7500);
});
it("oportunidade muda de etapa e previsão não altera banco", async () => {
  await saveProject(
    { ...project, stage: "proposal", estimated: 80000, revision: 2 },
    uid(),
    f.db,
  );
  const summary = opportunitySummary(
    await readFuture(f.db),
    await readFinance(f.db),
  );
  expect(summary.proposals).toBe(1);
  expect(summary.forecast).toBe(80000);
  expect(summary.received).toBe(0);
  expect(await f.db.financePayments.count()).toBe(0);
});
it("recebimentos parciais integram entrada e pagamento uma única vez", async () => {
  const p = post(10001),
    op = uid();
  await postProject(p, op, f.db);
  await postProject(p, op, f.db);
  await postProject(post(20000), uid(), f.db);
  const future = await readFuture(f.db),
    fin = await readFinance(f.db);
  expect(projectMetrics(project.id, future, fin).received).toBe(30001);
  expect(fin.entries).toHaveLength(2);
  expect(fin.payments).toHaveLength(2);
  expect(future.receipts).toHaveLength(2);
});
it("ID de recebimento repetido com outra operação não cria novo movimento", async () => {
  const p = post();
  await postProject(p, uid(), f.db);
  await expect(
    postProject({ ...p, entryId: uid(), paymentId: uid() }, uid(), f.db),
  ).rejects.toThrow("já registrado");
  expect(await f.db.financePayments.count()).toBe(1);
});
it("custo inválido reverte entrada, pagamento e vínculo na mesma transação", async () => {
  await contribute(move(100000), uid(), f.db);
  await expect(
    postProject(
      post(10000, { kind: "expense", categoryId: f.expense.id }),
      uid(),
      f.db,
    ),
  ).rejects.toThrow("reservas");
  expect(await f.db.financeEntries.count()).toBe(0);
  expect(await f.db.financePayments.count()).toBe(0);
  expect(await f.db.projectReceipts.count()).toBe(0);
});
it("receita líquida e valor por hora exigem cobertura confirmada", async () => {
  await postProject(post(60000), uid(), f.db);
  await postProject(
    post(10000, { kind: "expense", categoryId: f.expense.id }),
    uid(),
    f.db,
  );
  await saveTime(
    {
      id: uid(),
      projectId: project.id,
      date: refDate,
      minutes: 120,
      notes: "Trabalho",
      revision: 1,
      createdAt: now(),
      updatedAt: now(),
    },
    uid(),
    f.db,
  );
  let m = projectMetrics(
    project.id,
    await readFuture(f.db),
    await readFinance(f.db),
  );
  expect(m.net).toBeNull();
  expect(m.hourly).toBeNull();
  expect(m.minutes).toBe(120);
  await saveProject(
    { ...project, costsComplete: true, hoursComplete: true, revision: 2 },
    uid(),
    f.db,
  );
  m = projectMetrics(
    project.id,
    await readFuture(f.db),
    await readFinance(f.db),
  );
  expect(m.net).toBe(50000);
  expect(m.hourly).toBe(30000);
});
it("estorno atualiza recebido e mantém vínculo histórico", async () => {
  const p = post();
  await postProject(p, uid(), f.db);
  await reversePayment(p.paymentId, uid(), f.db);
  expect(
    projectMetrics(project.id, await readFuture(f.db), await readFinance(f.db))
      .received,
  ).toBe(0);
  expect(await f.db.projectReceipts.count()).toBe(1);
});
it("tempo é editável sem duplicação e zero horas não gera divisão", async () => {
  const t = {
    id: uid(),
    projectId: project.id,
    date: refDate,
    minutes: 30,
    notes: "",
    revision: 1,
    createdAt: now(),
    updatedAt: now(),
  };
  await saveTime(t, uid(), f.db);
  await saveTime({ ...t, minutes: 60, revision: 2 }, uid(), f.db);
  expect(await f.db.projectTimeEntries.count()).toBe(1);
  expect(
    projectMetrics(project.id, await readFuture(f.db), await readFinance(f.db))
      .minutes,
  ).toBe(60);
  await expect(
    saveTime({ ...t, id: uid(), minutes: 0 }, uid(), f.db),
  ).rejects.toThrow();
});
it("arquivo mantém histórico recebido e exclui previsão de oportunidades perdidas", async () => {
  await postProject(post(), uid(), f.db);
  await saveProject(
    { ...project, archived: true, estimated: 100000, revision: 2 },
    uid(),
    f.db,
  );
  const s = opportunitySummary(await readFuture(f.db), await readFinance(f.db));
  expect(s.forecast).toBe(0);
  expect(s.received).toBe(10000);
});
it("tarefas vinculadas reutilizam recorrência e preservam vínculos ao editar", async () => {
  const t = {
    id: uid(),
    title: "Próximo passo",
    description: "",
    startDate: refDate,
    endDate: "",
    time: "",
    priority: "medium" as const,
    duration: 30,
    recurrence: "daily" as const,
    weekdays: [],
    status: "active" as const,
  };
  await saveLinkedTask(
    t,
    null,
    { id: t.id, targetType: "goal", targetId: goal.id },
    f.db,
  );
  await saveLinkedTask(
    { ...t, title: "Revisar passo" },
    1,
    { id: t.id, targetType: "project", targetId: project.id },
    f.db,
  );
  expect(await f.db.tasks.count()).toBe(1);
  expect(await f.db.futureTaskLinks.count()).toBe(1);
  expect(
    taskOccurrences(
      await f.db.tasks.toArray(),
      [],
      refDate,
      shiftDate(refDate, 6),
    ),
  ).toHaveLength(7);
});
it("vínculo inválido reverte também a criação da tarefa", async () => {
  const t = {
    id: uid(),
    title: "Passo",
    description: "",
    startDate: refDate,
    endDate: "",
    time: "",
    priority: "medium" as const,
    duration: 30,
    recurrence: "once" as const,
    weekdays: [],
    status: "active" as const,
  };
  await expect(
    saveLinkedTask(
      t,
      null,
      { id: t.id, targetType: "goal", targetId: uid() },
      f.db,
    ),
  ).rejects.toThrow("não encontrado");
  expect(await f.db.tasks.count()).toBe(0);
  await expect(
    linkTask({ id: uid(), targetType: "project", targetId: project.id }, f.db),
  ).rejects.toThrow();
});
it("reinicialização preserva contribuições, projetos e vínculos", async () => {
  await contribute(move(), uid(), f.db);
  await postProject(post(), uid(), f.db);
  f.db.close();
  await f.db.open();
  expect(await f.db.goalMovements.count()).toBe(1);
  expect(await f.db.projectReceipts.count()).toBe(1);
});

it("falha posterior à transferência reverte lançamento, alocação e operações internas", async () => {
  await saveEntry(
    {
      ...f.entry,
      accountId: f.savings.id,
      dueDate: "2024-02-01",
      competence: "2024-02-01",
    },
    uid(),
    f.db,
  );
  await payTarget(
    {
      id: uid(),
      targetType: "entry",
      targetId: f.entry.id,
      accountId: f.savings.id,
      amount: 10000,
      date: "2024-02-01",
      eligibilityConfirmed: false,
    },
    uid(),
    f.db,
  );
  const before = await f.db.financeOperations.count();
  await expect(
    contribute(
      move(20000, { accountId: f.savings.id, fromAccountId: f.bank.id }),
      uid(),
      f.db,
    ),
  ).rejects.toThrow("reservas");
  expect(await f.db.financeTransfers.count()).toBe(0);
  expect(await f.db.goalMovements.count()).toBe(0);
  expect(await f.db.financeOperations.count()).toBe(before);
});
it("metas de valor zero são explícitas; valores desconhecidos continuam sem percentual", async () => {
  expect(
    goalProgress({ ...goal, target: 0 }, await readFuture(f.db)).percent,
  ).toBe(100);
  expect(
    goalProgress({ ...goal, target: null }, await readFuture(f.db)).percent,
  ).toBeNull();
});
it("resumo de renda explicita previsão desconhecida e cobertura incompleta", async () => {
  let summary = opportunitySummary(
    await readFuture(f.db),
    await readFinance(f.db),
  );
  expect(summary.unknownForecast).toBe(true);
  expect(summary.net).toBeNull();
  expect(summary.hourly).toBeNull();
  await saveProject(
    {
      ...project,
      costsComplete: true,
      hoursComplete: true,
      estimated: 50000,
      revision: 2,
    },
    uid(),
    f.db,
  );
  summary = opportunitySummary(await readFuture(f.db), await readFinance(f.db));
  expect(summary.unknownForecast).toBe(false);
  expect(summary.net).toBe(0);
  expect(summary.hourly).toBeNull();
});

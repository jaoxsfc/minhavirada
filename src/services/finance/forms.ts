import type {
  FinanceData,
  FinanceSettings,
} from "../../features/finance/models";
import { financeDefaults } from "../../features/finance/models";
import { localDate } from "../../lib/date";
import { parseMoney } from "./money";
import { entryRemaining, allInvoices } from "./calculations";
import {
  saveAccount,
  saveCategory,
  saveEntry,
  saveRule,
  saveCard,
  addPurchase,
  payTarget,
  addTransfer,
  addBenefit,
  saveBudget,
  saveFinanceSettings,
} from "./commands";
export type FormMode =
  | "settings"
  | "account"
  | "category"
  | "entry"
  | "rule"
  | "card"
  | "purchase"
  | "payment"
  | "transfer"
  | "benefit"
  | "budget";
export interface FinanceFormRequest {
  mode: FormMode;
  id?: string;
  kind?: "income" | "expense";
  targetType?: "entry" | "invoice";
  targetId?: string;
}
export interface FinanceField {
  name: string;
  label: string;
  type?: "text" | "money" | "date" | "month" | "number" | "select" | "color";
  options?: { value: string; label: string }[];
  required?: boolean;
  readOnly?: boolean;
  advanced?: boolean;
}
export interface FormSpec {
  title: string;
  note: string;
  fields: FinanceField[];
  values: Record<string, string>;
}
const fmt = (amount: number) => (amount / 100).toFixed(2).replace(".", ",");
const statuses = [
  { value: "active", label: "Ativa" },
  { value: "archived", label: "Arquivada" },
];
const yesNo = [
  { value: "no", label: "Não" },
  { value: "yes", label: "Sim" },
];
const labels: Record<FormMode, string> = {
  settings: "Seu planejamento financeiro",
  account: "Uma conta, um ponto de partida",
  category: "Organizar por categoria",
  entry: "Registrar lançamento",
  rule: "Uma previsão que se repete",
  card: "Seu cartão, com clareza",
  purchase: "Registrar compra no cartão",
  payment: "Confirmar pagamento ou recebimento",
  transfer: "Mover entre suas contas",
  benefit: "Registrar no ticket",
  budget: "Um limite para planejar",
};
export function financeFormSpec(
  request: FinanceFormRequest,
  data: FinanceData,
  suggested?: Partial<FinanceSettings>,
): FormSpec {
  const fields: FinanceField[] = [];
  const values: Record<string, string> = {};
  const add = (
    name: string,
    label: string,
    type: FinanceField["type"] = "text",
    value: string | number = "",
    options?: FinanceField["options"],
    extra: Partial<FinanceField> = {},
  ) => {
    fields.push({ name, label, type, required: true, options, ...extra });
    values[name] = String(value);
  };
  const accounts = data.accounts
    .filter(
      (a) =>
        a.status === "active" ||
        a.id === data.entries.find((e) => e.id === request.id)?.accountId,
    )
    .map((a) => ({
      value: a.id,
      label: a.name + (a.type === "benefit" ? " · Ticket" : ""),
    }));
  const bankAccounts = accounts.filter(
    (o) => data.accounts.find((a) => a.id === o.value)?.type !== "benefit",
  );
  const benefitAccounts = accounts.filter(
    (o) => data.accounts.find((a) => a.id === o.value)?.type === "benefit",
  );
  const categories = (kind = "expense") =>
    data.categories
      .filter(
        (c) => c.status === "active" && (c.kind === kind || c.kind === "both"),
      )
      .map((c) => ({ value: c.id, label: c.name }));
  const activeCards = data.cards
    .filter((c) => c.status === "active")
    .map((c) => ({ value: c.id, label: c.name }));
  const select = (
    name: string,
    label: string,
    options: NonNullable<FinanceField["options"]>,
    value = options[0]?.value ?? "",
    extra: Partial<FinanceField> = {},
  ) => add(name, label, "select", value, options, extra);
  let note = "Tudo fica neste navegador. Confira os dados antes de confirmar.";
  if (request.mode === "settings") {
    const p = { ...financeDefaults, ...suggested, ...data.settings };
    for (const [key, label] of [
      ["salary", "Salário sugerido"],
      ["benefit", "Benefício mensal sugerido"],
      ["fuel", "Orçamento de combustível"],
      ["food", "Orçamento de alimentação"],
      ["benefitPreserve", "Meta mensal preservada no benefício"],
      ["car", "Financiamento do carro sugerido"],
      ["insurance", "Seguro do carro sugerido"],
      ["reserveTarget", "Objetivo futuro de reserva"],
    ] as const)
      add(key, label + " (R$)", "money", fmt(p[key]));
    add("payday", "Dia de recebimento", "number", p.payday);
    add(
      "variableEstimate",
      "Estimativa mensal adicional ainda não lançada (R$; vazio = desconhecida)",
      "money",
      p.variableEstimate === null ? "" : fmt(p.variableEstimate),
      undefined,
      { required: false },
    );
    for (const scenario of ["conservative", "base", "optimistic"] as const) {
      const title = {
        conservative: "Conservador",
        base: "Base",
        optimistic: "Otimista",
      }[scenario];
      for (const [key, label] of [
        ["incomePercent", "Receitas previstas (%)"],
        ["variablePercent", "Estimativa variável (%)"],
        ["extraExpense", "Despesa adicional (R$)"],
      ] as const)
        add(
          `${scenario}__${key}`,
          `${title} · ${label}`,
          key === "extraExpense" ? "money" : "number",
          key === "extraExpense"
            ? fmt(p.scenarios[scenario][key])
            : p.scenarios[scenario][key],
          undefined,
          { advanced: true },
        );
    }
    select(
      "withCategories",
      "Adicionar categorias sugeridas (sem movimentos)",
      yesNo,
      "yes",
    );
    note =
      "Este assistente é independente das suas preferências pessoais. Salvar valores sugeridos não cria receitas, despesas, saldos ou recorrências. As premissas são apenas hipóteses editáveis.";
  }
  if (request.mode === "account") {
    const p = data.accounts.find((a) => a.id === request.id);
    add("name", "Nome da conta", "text", p?.name);
    select(
      "type",
      "Tipo de conta",
      [
        ["checking", "Conta corrente"],
        ["savings", "Poupança"],
        ["wallet", "Carteira"],
        ["cash", "Dinheiro físico"],
        ["other", "Outra"],
        ["benefit", "Benefício / ticket"],
      ].map(([value, label]) => ({ value, label })),
      p?.type ?? "checking",
    );
    add(
      "openingBalance",
      "Saldo inicial confirmado (R$)",
      "money",
      fmt(p?.openingBalance ?? 0),
    );
    add(
      "openingDate",
      "Data do saldo inicial",
      "date",
      p?.openingDate ?? localDate(),
    );
    add("color", "Cor da conta", "color", p?.color ?? "#173e34");
    select("status", "Status da conta", statuses, p?.status ?? "active");
    select("confirm", "Confirma o saldo inicial e sua data?", yesNo, "no");
    note =
      "O saldo inicial é uma fotografia informada por você, não uma receita. Depois de usar a conta, saldo inicial, data e tipo ficam protegidos. O saldo atual será sempre calculado.";
  }
  if (request.mode === "category") {
    const p = data.categories.find((c) => c.id === request.id);
    add("name", "Nome da categoria", "text", p?.name);
    select(
      "kind",
      "Tipo de categoria",
      [
        { value: "expense", label: "Despesa" },
        { value: "income", label: "Receita" },
        { value: "both", label: "Ambas" },
      ],
      p?.kind ?? "expense",
    );
    select(
      "benefitEligible",
      "É elegível para benefício?",
      yesNo,
      p?.benefitEligible ? "yes" : "no",
    );
    select("status", "Status da categoria", statuses, p?.status ?? "active");
  }
  if (request.mode === "entry" || request.mode === "rule") {
    const p =
      request.mode === "entry"
        ? data.entries.find((e) => e.id === request.id)
        : data.rules.find((r) => r.id === request.id);
    const kind = p?.kind ?? request.kind ?? "expense";
    add("description", "Descrição", "text", p?.description);
    select(
      "kind",
      "Tipo de lançamento",
      [{ value: kind, label: kind === "income" ? "Receita" : "Despesa" }],
      kind,
    );
    select(
      "accountId",
      "Conta do lançamento",
      accounts,
      p?.accountId ?? accounts[0]?.value ?? "",
    );
    select(
      "categoryId",
      "Categoria do lançamento",
      categories(kind),
      p?.categoryId ?? categories(kind)[0]?.value ?? "",
    );
    add("amount", "Valor do lançamento (R$)", "money", p ? fmt(p.amount) : "");
    if (request.mode === "entry") {
      const e = data.entries.find((e) => e.id === request.id);
      add(
        "competence",
        "Data de competência",
        "date",
        e?.competence ?? localDate(),
      );
      add("dueDate", "Vencimento", "date", e?.dueDate ?? localDate());
      select(
        "status",
        "Estado da previsão",
        [
          { value: "pending", label: "Pendente" },
          { value: "planned", label: "Previsto" },
        ],
        e?.status === "planned" ? "planned" : "pending",
      );
      note =
        "Este registro cria uma obrigação ou previsão, sem alterar o saldo. Depois, confirme o pagamento ou recebimento na lista.";
    } else {
      const r = data.rules.find((r) => r.id === request.id);
      add(
        "startDate",
        "Primeiro vencimento",
        "date",
        r?.startDate ?? localDate(),
        undefined,
        { readOnly: !!r },
      );
      add(
        "endDate",
        "Último vencimento (opcional)",
        "date",
        r?.endDate ?? "",
        undefined,
        { required: false },
      );
      select(
        "frequency",
        "Repetição",
        [
          ["monthly", "Mensal"],
          ["weekly", "Semanal"],
          ["yearly", "Anual"],
          ["custom", "Intervalo de dias"],
        ].map(([value, label]) => ({ value, label })),
        r?.frequency ?? "monthly",
      );
      add(
        "intervalDays",
        "Dias do intervalo personalizado",
        "number",
        r?.intervalDays ?? 30,
      );
      select(
        "entryStatus",
        "Estado das ocorrências",
        [
          { value: "pending", label: "Pendente" },
          { value: "planned", label: "Previsto" },
        ],
        r?.entryStatus ?? "planned",
      );
      select("status", "Status da regra", statuses, r?.status ?? "active");
      add("effectiveFrom", "Aplicar mudanças a partir de", "date", localDate());
      note =
        "Geramos previsões únicas para cada vencimento. Editar esta regra altera somente ocorrências futuras sem pagamentos; ocorrências canceladas manualmente e pagamentos anteriores são preservados.";
    }
  }
  if (request.mode === "card") {
    const p = data.cards.find((c) => c.id === request.id);
    add("name", "Nome do cartão", "text", p?.name);
    add("limit", "Limite informado (R$)", "money", fmt(p?.limit ?? 0));
    add("closingDay", "Dia de fechamento", "number", p?.closingDay ?? 20);
    add("dueDay", "Dia de vencimento", "number", p?.dueDay ?? 5);
    select(
      "accountId",
      "Conta padrão para pagar fatura",
      bankAccounts,
      p?.accountId ?? bankAccounts[0]?.value ?? "",
    );
    select("status", "Status do cartão", statuses, p?.status ?? "active");
    note =
      "Compras no dia do fechamento entram nesse ciclo. Se o vencimento for igual ou anterior ao fechamento, será no mês seguinte. Dias inexistentes são ajustados ao último dia do mês. Ciclos de cartões com histórico ficam protegidos.";
  }
  if (request.mode === "purchase") {
    select("cardId", "Cartão da compra", activeCards);
    select("categoryId", "Categoria da compra", categories());
    add("description", "Descrição da compra");
    add("amount", "Valor total da compra (R$)", "money");
    add("date", "Data da compra", "date", localDate());
    add("installments", "Número de parcelas", "number", 1);
    note =
      "A compra gera parcelas e faturas, sem debitar sua conta. O total é reconhecido uma vez por competência; o pagamento da fatura aparece só no fluxo de caixa. O limite não é dinheiro disponível.";
  }
  if (request.mode === "payment") {
    const entry = data.entries.find((e) => e.id === request.targetId);
    const invoice = allInvoices(data).find((i) => i.id === request.targetId);
    const opts =
      request.targetType === "entry"
        ? accounts.filter((a) => a.value === entry?.accountId)
        : bankAccounts;
    const defaultAccount =
      entry?.accountId ??
      data.cards.find((c) => c.id === invoice?.cardId)?.accountId ??
      opts[0]?.value ??
      "";
    select("accountId", "Conta do pagamento", opts, defaultAccount);
    add(
      "amount",
      "Valor efetivo (R$)",
      "money",
      fmt(entry ? entryRemaining(data, entry) : (invoice?.remaining ?? 0)),
    );
    add("date", "Data efetiva", "date", localDate());
    if (data.accounts.find((a) => a.id === defaultAccount)?.type === "benefit")
      select(
        "eligibilityConfirmed",
        "Confirmo uso do benefício em categoria não elegível",
        yesNo,
        "no",
      );
    note =
      "Só confirme se o valor realmente saiu ou entrou nesta data. Pagamentos parciais são permitidos; o saldo restante continua pendente.";
  }
  if (request.mode === "transfer") {
    select("fromId", "Conta de origem", bankAccounts);
    select(
      "toId",
      "Conta de destino",
      bankAccounts,
      bankAccounts[1]?.value ?? "",
    );
    add("amount", "Valor transferido (R$)", "money");
    add("date", "Data da transferência", "date", localDate());
    note =
      "Transferência entre suas contas não é receita nem despesa. O benefício não pode ser convertido em saldo bancário por este fluxo.";
  }
  if (request.mode === "benefit") {
    select("accountId", "Conta do benefício", benefitAccounts);
    select("kind", "Tipo de movimento", [
      { value: "consume", label: "Consumo" },
      { value: "credit", label: "Crédito" },
      { value: "adjustment", label: "Ajuste (+ ou −)" },
    ]);
    add("description", "Descrição do ticket");
    select(
      "categoryId",
      "Categoria do benefício",
      [{ value: "", label: "Sem categoria (crédito/ajuste)" }, ...categories()],
      "",
      { required: false },
    );
    add("amount", "Valor do ticket (R$)", "money");
    add("date", "Data do movimento", "date", localDate());
    select(
      "eligibilityConfirmed",
      "Confirmo uso do benefício em categoria não elegível",
      yesNo,
      "no",
    );
    note =
      "Créditos e consumos usam valor positivo. Ajustes aceitam sinal negativo e ficam no histórico. Consumos exigem categoria elegível ou confirmação explícita. Saldo do benefício não equivale a dinheiro livre.";
  }
  if (request.mode === "budget") {
    const p = data.budgets.find((b) => b.id === request.id);
    add(
      "month",
      "Mês do orçamento",
      "month",
      p?.month ?? localDate().slice(0, 7),
    );
    select(
      "categoryId",
      "Categoria do orçamento",
      categories(),
      p?.categoryId ?? categories()[0]?.value ?? "",
    );
    select(
      "scope",
      "Fonte do orçamento",
      [
        { value: "bank", label: "Banco / cartões" },
        { value: "benefit", label: "Benefício / ticket" },
      ],
      p?.scope ?? "bank",
    );
    add("amount", "Valor planejado (R$)", "money", fmt(p?.amount ?? 0));
    note =
      "O orçamento não movimenta dinheiro. Uma nova confirmação para o mesmo mês, categoria e fonte atualiza o limite anterior.";
  }
  return { title: labels[request.mode], note, fields, values };
}
export async function submitFinanceForm(
  request: FinanceFormRequest,
  v: Record<string, string>,
  data: FinanceData,
  operationId: string,
  at: string,
) {
  const id = request.id ?? operationId;
  const amount = (key = "amount") => parseMoney(v[key] ?? "");
  const n = (key: string) => Number(v[key]);
  switch (request.mode) {
    case "account": {
      if (v.confirm !== "yes")
        throw new Error("Confirme o saldo inicial e a data.");
      const old = data.accounts.find((a) => a.id === id);
      return saveAccount(
        {
          id,
          name: v.name,
          type: v.type as "checking",
          openingBalance: amount("openingBalance"),
          openingDate: v.openingDate,
          color: v.color,
          status: v.status as "active",
          revision: (old?.revision ?? 0) + 1,
        },
        operationId,
      );
    }
    case "category": {
      const old = data.categories.find((c) => c.id === id);
      return saveCategory(
        {
          id,
          name: v.name,
          kind: v.kind as "expense",
          benefitEligible: v.benefitEligible === "yes",
          status: v.status as "active",
          systemKey: old?.systemKey,
        },
        operationId,
      );
    }
    case "entry": {
      const old = data.entries.find((e) => e.id === id);
      return saveEntry(
        {
          id,
          kind: v.kind as "expense",
          description: v.description,
          accountId: v.accountId,
          categoryId: v.categoryId,
          amount: amount(),
          competence: v.competence,
          dueDate: v.dueDate,
          status: v.status as "pending",
          revision: (old?.revision ?? 0) + 1,
          occurrenceId: old?.occurrenceId,
        },
        operationId,
      );
    }
    case "rule": {
      const old = data.rules.find((r) => r.id === id);
      return saveRule(
        {
          id,
          kind: v.kind as "expense",
          description: v.description,
          accountId: v.accountId,
          categoryId: v.categoryId,
          amount: amount(),
          startDate: v.startDate,
          endDate: v.endDate,
          frequency: v.frequency as "monthly",
          intervalDays: n("intervalDays"),
          status: v.status as "active",
          entryStatus: v.entryStatus as "planned",
          revision: (old?.revision ?? 0) + 1,
        },
        operationId,
        v.effectiveFrom,
      );
    }
    case "card": {
      const old = data.cards.find((c) => c.id === id);
      return saveCard(
        {
          id,
          name: v.name,
          limit: amount("limit"),
          closingDay: n("closingDay"),
          dueDay: n("dueDay"),
          accountId: v.accountId,
          status: v.status as "active",
          revision: (old?.revision ?? 0) + 1,
        },
        operationId,
      );
    }
    case "purchase":
      return addPurchase(
        {
          id,
          cardId: v.cardId,
          categoryId: v.categoryId,
          description: v.description,
          amount: amount(),
          date: v.date,
          installments: n("installments"),
          status: "active",
        },
        operationId,
      );
    case "payment":
      if (!request.targetId || !request.targetType)
        throw new Error("Escolha um lançamento ou fatura.");
      return payTarget(
        {
          id,
          targetId: request.targetId,
          targetType: request.targetType,
          accountId: v.accountId,
          amount: amount(),
          date: v.date,
          eligibilityConfirmed: v.eligibilityConfirmed === "yes",
        },
        operationId,
      );
    case "transfer":
      return addTransfer(
        {
          id,
          fromId: v.fromId,
          toId: v.toId,
          amount: amount(),
          date: v.date,
          status: "active",
        },
        operationId,
      );
    case "benefit":
      return addBenefit(
        {
          id,
          accountId: v.accountId,
          kind: v.kind as "consume",
          description: v.description,
          categoryId: v.categoryId || undefined,
          amount: amount(),
          date: v.date,
          status: "active",
          eligibilityConfirmed: v.eligibilityConfirmed === "yes",
        },
        operationId,
      );
    case "budget":
      return saveBudget(
        {
          id,
          month: v.month,
          categoryId: v.categoryId,
          scope: v.scope as "bank",
          amount: amount(),
        },
        operationId,
      );
    case "settings": {
      const scenario = (key: string) => ({
        incomePercent: n(`${key}__incomePercent`),
        variablePercent: n(`${key}__variablePercent`),
        extraExpense: amount(`${key}__extraExpense`),
      });
      return saveFinanceSettings(
        {
          id: "finance",
          salary: amount("salary"),
          benefit: amount("benefit"),
          fuel: amount("fuel"),
          food: amount("food"),
          benefitPreserve: amount("benefitPreserve"),
          car: amount("car"),
          insurance: amount("insurance"),
          reserveTarget: amount("reserveTarget"),
          payday: n("payday"),
          variableEstimate:
            v.variableEstimate === "" ? null : amount("variableEstimate"),
          scenarios: {
            base: scenario("base"),
            conservative: scenario("conservative"),
            optimistic: scenario("optimistic"),
          },
          updatedAt: at,
        },
        operationId,
        v.withCategories === "yes",
      );
    }
  }
}

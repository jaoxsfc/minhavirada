import { useState, lazy, Suspense } from "react";
import { useLocalToday } from "../../hooks/useLocalToday";
import { projectMonths } from "../../services/finance/calculations";
import { budgetSummary } from "../../services/finance/views";
import { dateLabel } from "../../lib/calendar";
import { money } from "../../lib/date";
import type { FinancePanelProps } from "./shared";
const ProjectionChart = lazy(() =>
  import("./FinanceCharts").then((m) => ({ default: m.ProjectionChart })),
);
export function FinanceRules({ data, onOpen }: FinancePanelProps) {
  return (
    <>
      <div className="section-title">
        <h2>Previsões recorrentes</h2>
        <div className="actions">
          <button onClick={() => onOpen({ mode: "rule", kind: "income" })}>
            Receita recorrente
          </button>
          <button onClick={() => onOpen({ mode: "rule", kind: "expense" })}>
            Despesa recorrente
          </button>
        </div>
      </div>
      <p className="muted small">
        Sugestões de planejamento não criam regras automaticamente. Cadastre
        salário, crédito do benefício, contas e suas datas de início/fim.
      </p>
      <div className="routine-list">
        {data.rules.map((r) => (
          <article className="routine-card" key={r.id}>
            <h3>{r.description}</h3>
            <p>
              {money(r.amount)} ·{" "}
              {
                {
                  monthly: "Mensal",
                  weekly: "Semanal",
                  yearly: "Anual",
                  custom: "Intervalo de dias",
                }[r.frequency]
              }{" "}
              · {r.status === "active" ? "Ativa" : "Arquivada"}
            </p>
            <p className="muted small">
              Desde {dateLabel(r.startDate)}
              {r.endDate ? ` até ${dateLabel(r.endDate)}` : " · sem data final"}
              . Ocorrências são previstas, sem confirmação de dinheiro.
            </p>
            <button onClick={() => onOpen({ mode: "rule", id: r.id })}>
              Editar próximas ocorrências
            </button>
          </article>
        ))}
      </div>
      {!data.rules.length && (
        <section className="empty">
          <h2>Nenhuma previsão repetida.</h2>
          <p>Você decide o que se repete e até quando.</p>
        </section>
      )}
    </>
  );
}
export function FinanceBudgets({ data, onOpen }: FinancePanelProps) {
  const today = useLocalToday();
  const [month, setMonth] = useState(today.slice(0, 7));
  return (
    <>
      <div className="section-title">
        <h2>Orçamentos por categoria</h2>
        <button onClick={() => onOpen({ mode: "budget" })}>
          Definir orçamento
        </button>
      </div>
      <label className="date-control">
        Mês do orçamento
        <input
          type="month"
          value={month}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
        />
      </label>
      <div className="routine-list">
        {data.budgets
          .filter((b) => b.month === month)
          .map((b) => {
            const summary = budgetSummary(
              data,
              month,
              b.categoryId,
              b.scope,
              b.amount,
            );
            return (
              <article className="routine-card" key={b.id}>
                <h3>
                  {data.categories.find((c) => c.id === b.categoryId)?.name} ·{" "}
                  {b.scope === "bank" ? "Banco e cartões" : "Ticket"}
                </h3>
                <p>
                  Planejado: {money(b.amount)} · registrado:{" "}
                  {money(summary.used)}
                </p>
                <p className={summary.over > 0 ? "error" : "muted small"}>
                  {summary.over > 0
                    ? `Acima do orçamento em ${money(summary.over)}. Vale revisar os próximos gastos.`
                    : `Margem de planejamento: ${money(summary.margin)}.`}
                </p>
                <p className="muted small">
                  Banco: despesas por competência, inclusive pendentes. Ticket:
                  consumos efetivos. Não soma pagamentos de fatura às compras.
                </p>
                <button onClick={() => onOpen({ mode: "budget", id: b.id })}>
                  Atualizar orçamento
                </button>
              </article>
            );
          })}
      </div>
      {!data.budgets.some((b) => b.month === month) && (
        <section className="empty">
          <h2>Um limite ajuda a escolher.</h2>
          <p>
            Defina um orçamento para comparar com seus registros, sem movimentar
            saldo.
          </p>
        </section>
      )}
    </>
  );
}
export function FinanceProjection({ data, onOpen }: FinancePanelProps) {
  const today = useLocalToday();
  const [scenario, setScenario] = useState<
    "base" | "conservative" | "optimistic"
  >("base");
  const rows = projectMonths(data, today, scenario);
  const settings = data.settings;
  if(!data.accounts.some(a=>a.type!=='benefit'))return <section className="empty"><h2>Precisamos do seu ponto de partida.</h2><p>Cadastre uma conta e confirme o saldo inicial para apurar projeções bancárias. O benefício permanece separado.</p><button onClick={()=>onOpen({mode:'account'})}>Adicionar conta</button></section>;
  return (
    <>
      <div className="section-title">
        <h2>Os próximos 12 meses</h2>
        <label>
          Cenário
          <select
            value={scenario}
            onChange={(e) => setScenario(e.target.value as typeof scenario)}
          >
            <option value="conservative">Conservador</option>
            <option value="base">Base</option>
            <option value="optimistic">Otimista</option>
          </select>
        </label>
      </div>
      <p className="muted small">
        Receitas previstas × {settings?.scenarios[scenario].incomePercent}%;
        variáveis adicionais × {settings?.scenarios[scenario].variablePercent}%;
        despesa extra {money(settings?.scenarios[scenario].extraExpense ?? 0)}
        /mês. São hipóteses, não disponibilidade real.
      </p>
      <button onClick={() => onOpen({ mode: "settings" })}>
        Editar premissas
      </button>
      {rows[0].incomplete && (
        <p role="status" className="backup-warning">
          Projeção incompleta: gastos variáveis ainda não estimados.
        </p>
      )}
      <section className="panel">
        <Suspense fallback={<p>Preparando gráfico…</p>}>
          <ProjectionChart rows={rows} />
        </Suspense>
      </section>
      <div className="projection-list">
        {rows.map((p) => (
          <article
            className={`routine-card ${p.negative ? "risk-month" : ""}`}
            key={p.month}
          >
            <div className="routine-card-top">
              <h3>
                {p.month}
                {p.negative ? " · Atenção ao saldo negativo" : ""}
              </h3>
              <strong>{money(p.closing)}</strong>
            </div>
            <p className="muted small">
              Saldo de abertura {money(p.opening)} · entradas previstas{" "}
              {money(p.income)} · pendências {money(p.expenses)} · estimativa
              adicional {money(p.variable)}
            </p>
            <p className="muted small">
              Já pago no mês: {money(p.alreadyPaid)} (incluído no saldo real,
              sem descontar de novo). Ticket separado: {money(p.benefitClosing)}
              .
            </p>
            <p className="muted small">
              Potencial de poupança do fluxo: {money(p.potentialSaving)}
              {p.incomplete ? " · incompleto" : ""}.{" "}
              {p.lastInstallments
                ? `${p.lastInstallments} parcelamento(s) termina(m) neste mês.`
                : ""}
            </p>
          </article>
        ))}
      </div>
      <p className="muted small">
        Sem receita prevista, mostramos zero entradas, sem inventar salário.
        Despesas futuras não aparecem como pagas. Transferências próprias têm
        efeito total zero. Projeções partem do saldo real de hoje e podem não
        incluir gastos ainda desconhecidos.
      </p>
    </>
  );
}

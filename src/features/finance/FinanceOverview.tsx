import { ReservationSummary } from "../future/ReservationSummary";
import { Link } from "react-router-dom";
import type { FinanceData } from "./models";
import { overviewModel } from "../../services/finance/views";
import { localDate, money } from "../../lib/date";
import { dateLabel } from "../../lib/calendar";
import type { FinanceFormRequest } from "../../services/finance/forms";
export function FinanceOverview({
  data,
  onOpen,
}: {
  data: FinanceData;
  onOpen: (r: FinanceFormRequest) => void;
}) {
  const today = localDate();
  const view = overviewModel(data, today);
  const bank = view.hasBank,
    benefit = view.hasBenefit,
    salary = view.salary,
    projections = [view.projected],
    paid = view.paid,
    savings = view.savings,
    upcoming = view.upcoming;
  return (
    <>
      <section className="finance-hero">
        <p className="eyebrow">SEU DINHEIRO, COM CLAREZA</p>
        <span>Quanto tenho agora</span>
        <strong data-testid="bank-balance">
          {bank ? money(view.bank) : "Cadastre sua primeira conta"}
        </strong>
        <p>
          Saldo real, calculado com saldos iniciais e movimentos confirmados.
          Benefício e limite de cartão ficam de fora.
        </p>
        <div className="actions">
          <button onClick={() => onOpen({ mode: "entry", kind: "expense" })}>
            Adicionar gasto
          </button>
          <button onClick={() => onOpen({ mode: "entry", kind: "income" })}>
            Registrar receita
          </button>
          <button onClick={() => onOpen({ mode: "transfer" })}>
            Transferir entre contas
          </button>
          <button onClick={() => onOpen({ mode: "purchase" })}>
            Compra parcelada
          </button>
        </div>
      </section>
      <div className="stats-grid">
        <article className="stat">
          <span>Ainda comprometido</span>
          <strong>{money(view.pending)}</strong>
          <p>obrigações conhecidas, inclusive cartões</p>
        </article>
        <article className="stat">
          <span>Já pago neste mês</span>
          <strong>{money(paid)}</strong>
          <p>saídas bancárias confirmadas, incluindo faturas</p>
        </article>
        <article className="stat">
          <span>Saldo do ticket</span>
          <strong data-testid="benefit-balance">
            {benefit ? money(view.benefit) : "Não cadastrado"}
          </strong>
          <p>restrito ao benefício, separado do banco</p>
        </article>
      </div>
      <section className="panel">
        <h2>Até o próximo salário</h2>
        <p className="muted small">
          Até {dateLabel(salary.payday)}, incluindo contas dessa data. O salário
          previsto não entra no saldo real.
        </p>
        <div className="finance-callout">
          <strong>
            {bank ? money(salary.afterKnownBills) : "Saldo ainda não apurado"}
          </strong>
          <span>
            saldo atual após {money(salary.pending)} em compromissos conhecidos
          </span>
        </div>
        <p className="muted small">
          Simulação sem despesas desconhecidas nem novas receitas. Não garante
          sobra. O valor acima inclui as alocações em metas; confira-as abaixo.
        </p>
      </section>
      <ReservationSummary afterKnownBills={salary.afterKnownBills} />
      <div className="overview-grid">
        <section className="panel">
          <h2>Próximos vencimentos</h2>
          {upcoming.length ? (
            upcoming.map((e) => (
              <div className="overview-row" key={e.id}>
                <div>
                  <strong>{e.title}</strong>
                  <p className="muted small">
                    {dateLabel(e.date)} · {money(e.remaining)}
                    {e.date < today ? " · Vencido" : ""}
                  </p>
                </div>
                <button
                  onClick={() =>
                    onOpen({
                      mode: "payment",
                      targetType: e.type,
                      targetId: e.id,
                    })
                  }
                >
                  Pagar conta
                </button>
              </div>
            ))
          ) : (
            <p className="muted small">
              Nenhuma obrigação cadastrada. Isso não significa que todas as
              despesas foram informadas.
            </p>
          )}
        </section>
        <section className="panel">
          <h2>O que poderá sobrar</h2>
          <p className="finance-number">
            {bank ? money(projections[0].closing) : "Sem saldo inicial"}
          </p>
          <p className="muted small">
            Projeção do fim do mês, no cenário base.{" "}
            {projections[0].incomplete
              ? "Incompleta: despesas variáveis ainda desconhecidas."
              : "Inclui sua estimativa adicional, além das contas registradas."}
          </p>
          <p className="muted small">
            Contas poupança: {money(savings)} · referência futura de reserva:{" "}
            {money(data.settings?.reserveTarget ?? 1000000)}. Saldo de poupança
            não é uma contribuição para metas.
          </p>
          <Link className="text-link" to="/financas/projecoes">
            Ver os próximos 12 meses →
          </Link>
        </section>
      </div>
    </>
  );
}

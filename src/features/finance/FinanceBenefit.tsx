import { useState } from "react";
import { Link } from "react-router-dom";
import {
  accountBalance,
  projectMonths,
} from "../../services/finance/calculations";
import { reverseBenefit } from "../../services/finance/commands";
import { Status, useAction } from "../../components/RoutineUI";
import { useLocalToday } from "../../hooks/useLocalToday";
import { money } from "../../lib/date";
import { dateLabel, monthRange } from "../../lib/calendar";
import type { FinancePanelProps } from "./shared";
export default function FinanceBenefit({ data, onOpen }: FinancePanelProps) {
  const today = useLocalToday();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [account, setAccount] = useState("all");
  const [category, setCategory] = useState("all");
  const action = useAction();
  const range = monthRange(month);
  return (
    <>
      <div className="section-title">
        <h2>Seu benefício acumulativo</h2>
        <div className="actions">
          <button onClick={() => onOpen({ mode: "account" })}>
            Cadastrar conta de benefício
          </button>
          <button onClick={() => onOpen({ mode: "benefit" })}>
            Registrar consumo / crédito
          </button>
        </div>
      </div>
      <Status message={action.message} />
      <p className="muted small">
        Saldo restrito ao benefício. Créditos previstos só entram no extrato
        após confirmação. Categoria incompatível exige confirmação explícita.
      </p>
      <div className="finance-accounts">
        {data.accounts
          .filter((a) => a.type === "benefit")
          .map((a) => (
            <article className="routine-card" key={a.id}>
              <h3>{a.name}</h3>
              <p className="finance-number">
                {money(accountBalance(data, a.id, today))}
              </p>
              <p className="muted small">
                Saldo inicial + créditos − consumos + ajustes. Nunca somado ao
                banco.
              </p>
            </article>
          ))}
      </div>
      <section className="filter-panel">
        <div className="filter-grid">
          <label>
            Mês do extrato
            <input
              type="month"
              value={month}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
            />
          </label>
          <label>
            Conta de benefício
            <select
              value={account}
              onChange={(e) => setAccount(e.target.value)}
            >
              <option value="all">Todas</option>
              {data.accounts
                .filter((a) => a.type === "benefit")
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Categoria do extrato
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="all">Todas</option>
              {data.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
      <div className="routine-list">
        {data.benefits
          .filter(
            (b) =>
              b.date >= range.from &&
              b.date <= range.to &&
              (account === "all" || b.accountId === account) &&
              (category === "all" || b.categoryId === category),
          )
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((b) => (
            <article className="routine-card" key={b.id}>
              <span className="eyebrow">
                {dateLabel(b.date)} ·{" "}
                {
                  {
                    credit: "Crédito",
                    consume: "Consumo",
                    adjustment: "Ajuste",
                  }[b.kind]
                }{" "}
                · {b.status === "active" ? "Confirmado" : "Estornado"}
              </span>
              <h3>{b.description}</h3>
              <strong>
                {money(b.kind === "consume" ? -b.amount : b.amount)}
              </strong>
              <p className="muted small">
                {data.accounts.find((a) => a.id === b.accountId)?.name}
                {b.eligibilityConfirmed
                  ? " · Exceção de elegibilidade confirmada"
                  : ""}
              </p>
              {b.status === "active" && !b.paymentId && (
                <button
                  disabled={action.busy}
                  onClick={() =>
                    void action.run(
                      () => reverseBenefit(b.id, crypto.randomUUID()),
                      "Movimento do benefício estornado.",
                    )
                  }
                >
                  Estornar movimento
                </button>
              )}
              {b.paymentId && (
                <Link className="text-link" to="/financas/lancamentos">
                  Pagamento vinculado · consultar lançamento →
                </Link>
              )}
            </article>
          ))}
      </div>
      <section className="panel">
        <h2>Planejamento do benefício</h2>
        <p>
          Combustível: {money(data.settings?.fuel ?? 0)} · alimentação:{" "}
          {money(data.settings?.food ?? 0)} · meta de preservar:{" "}
          {money(data.settings?.benefitPreserve ?? 0)} por mês.
        </p>
        <p className="muted small">
          Referências configuráveis, sem débitos automáticos. Use Orçamentos
          para definir limites por mês e categoria.
        </p>
        <p>
          Saldo projetado no fim deste mês:{" "}
          {money(projectMonths(data, today)[0].benefitClosing)}
        </p>
        <p className="muted small">
          Inclui previsões e a parcela ainda não utilizada dos orçamentos do
          ticket neste mês; não considera outros consumos desconhecidos. Saldo
          acumulado não equivale a dinheiro livre.
        </p>
      </section>
    </>
  );
}

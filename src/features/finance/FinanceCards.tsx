import { allInvoices } from "../../services/finance/calculations";
import { cardSummary } from "../../services/finance/views";
import {
  reversePayment,
  refundPurchase,
} from "../../services/finance/commands";
import { Status, useAction } from "../../components/RoutineUI";
import { useLocalToday } from "../../hooks/useLocalToday";
import { dateLabel } from "../../lib/calendar";
import { money } from "../../lib/date";
import type { FinancePanelProps } from "./shared";
export default function FinanceCards({ data, onOpen }: FinancePanelProps) {
  const action = useAction();
  const today = useLocalToday();
  const invoices = allInvoices(data).sort((a, b) =>
    a.dueDate.localeCompare(b.dueDate),
  );
  return (
    <>
      <div className="section-title">
        <h2>Cartões e parcelas</h2>
        <div className="actions">
          <button onClick={() => onOpen({ mode: "card" })}>
            Adicionar cartão
          </button>
          <button onClick={() => onOpen({ mode: "purchase" })}>
            Adicionar compra parcelada
          </button>
        </div>
      </div>
      <Status message={action.message} />
      <p className="muted small">
        Juros, multas e tarifas não são calculados automaticamente. Cadastre
        esses encargos separadamente como despesas e confirme apenas a parte
        correspondente em cada pagamento.
      </p>
      <div className="finance-accounts">
        {data.cards.map((c) => {
          const summary = cardSummary(data, c.id);
          return (
            <article className="routine-card" key={c.id}>
              <h3>{c.name}</h3>
              <p className="finance-number">{money(summary.outstanding)}</p>
              <p className="muted small">
                em obrigações · limite disponível estimado{" "}
                {money(summary.availableLimit)}, que não é dinheiro
              </p>
              <p className="muted small">
                Fecha dia {c.closingDay} · vence dia {c.dueDay} ·{" "}
                {c.status === "active" ? "Ativo" : "Arquivado"}
              </p>
              <button onClick={() => onOpen({ mode: "card", id: c.id })}>
                Editar cartão
              </button>
            </article>
          );
        })}
      </div>
      <section className="panel">
        <h2>Faturas e vencimentos</h2>
        {invoices.map((i) => (
          <article className="invoice-row" key={i.id}>
            <div>
              <h3>
                {data.cards.find((c) => c.id === i.cardId)?.name} ·{" "}
                {i.cycleMonth}
              </h3>
              <p className="muted small">
                Fecha {dateLabel(i.closingDate)} · vence {dateLabel(i.dueDate)}
              </p>
              <p>
                Total: {money(i.charges)} · pago: {money(i.paid)} · estornos:{" "}
                {money(i.credits)} · crédito anterior aplicado:{" "}
                {money(i.appliedCredit)}
              </p>
              <strong>Em aberto: {money(i.remaining)}</strong>
              {i.creditBalance > 0 && (
                <p className="muted small">
                  Crédito no cartão: {money(i.creditBalance)}. Não foi devolvido
                  ao banco.
                </p>
              )}
            </div>
            {i.remaining > 0 && (
              <button
                onClick={() =>
                  onOpen({
                    mode: "payment",
                    targetType: "invoice",
                    targetId: i.id,
                  })
                }
              >
                Pagar fatura
              </button>
            )}
            <details>
              <summary>Consultar fatura</summary>
              {data.installments
                .filter((part) => part.invoiceId === i.id)
                .map((part) => (
                  <p className="muted small" key={part.id}>
                    {
                      data.purchases.find((p) => p.id === part.purchaseId)
                        ?.description
                    }{" "}
                    · parcela {part.number} · {money(part.amount)}
                  </p>
                ))}
              {data.payments
                .filter(
                  (p) => p.targetType === "invoice" && p.targetId === i.id,
                )
                .map((p) => (
                  <div className="overview-row" key={p.id}>
                    <span>
                      {dateLabel(p.date)} · {money(p.amount)} ·{" "}
                      {p.status === "active" ? "Confirmado" : "Estornado"}
                    </span>
                    {p.status === "active" && (
                      <button
                        disabled={action.busy}
                        onClick={() =>
                          void action.run(
                            () => reversePayment(p.id, crypto.randomUUID()),
                            "Pagamento da fatura estornado.",
                          )
                        }
                      >
                        Estornar pagamento
                      </button>
                    )}
                  </div>
                ))}
            </details>
          </article>
        ))}
        {!invoices.length && (
          <p className="muted small">
            As faturas aparecerão após cadastrar uma compra real.
          </p>
        )}
      </section>
      <section className="panel">
        <h2>Compras registradas</h2>
        {data.purchases.map((p) => (
          <div className="overview-row" key={p.id}>
            <div>
              <h3>{p.description}</h3>
              <p className="muted small">
                {dateLabel(p.date)} · {money(p.amount)} em {p.installments}× ·{" "}
                {p.status === "refunded" ? "Estornada" : "Ativa"}
              </p>
            </div>
            {p.status === "active" && (
              <button
                disabled={action.busy}
                onClick={() =>
                  void action.run(
                    () => refundPurchase(p.id, today, crypto.randomUUID()),
                    "Compra estornada integralmente. Crédito no cartão, sem entrada bancária.",
                  )
                }
              >
                Estornar compra
              </button>
            )}
          </div>
        ))}
      </section>
    </>
  );
}

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/database";
import { useLocalToday } from "../../hooks/useLocalToday";
import { Status, useAction } from "../../components/RoutineUI";
import { accountBalance } from "../../services/finance/calculations";
import { reverseTransfer } from "../../services/finance/commands";
import { dateLabel } from "../../lib/calendar";
import { money } from "../../lib/date";
import type { FinancePanelProps } from "./shared";
export default function FinanceAccounts({ data, onOpen }: FinancePanelProps) {
  const today = useLocalToday();
  const action = useAction();
  const changes = useLiveQuery(() =>
    db.financeChanges.orderBy("at").reverse().limit(60).toArray(),
  );
  return (
    <>
      <div className="section-title">
        <h2>Contas e saldos</h2>
        <button onClick={() => onOpen({ mode: "account" })}>
          Adicionar conta
        </button>
      </div>
      <div className="actions">
        <button onClick={() => onOpen({ mode: "transfer" })}>
          Transferir entre contas
        </button>
        <button onClick={() => onOpen({ mode: "category" })}>
          Nova categoria
        </button>
      </div>
      <Status message={action.message} />
      <div className="finance-accounts">
        {data.accounts.map((a) => (
          <article className="routine-card" key={a.id}>
            <span className="account-color" style={{ background: a.color }} />
            <h3>{a.name}</h3>
            <p className="muted small">
              {a.type === "benefit"
                ? "Benefício restrito"
                : a.type === "savings"
                  ? "Poupança"
                  : "Conta própria"}{" "}
              · {a.status === "active" ? "Ativa" : "Arquivada"}
            </p>
            <p className="finance-number">
              {money(accountBalance(data, a.id, today))}
            </p>
            <p className="muted small">
              Saldo inicial {money(a.openingBalance)} em{" "}
              {dateLabel(a.openingDate)}
            </p>
            <button onClick={() => onOpen({ mode: "account", id: a.id })}>
              Editar conta
            </button>
          </article>
        ))}
      </div>
      {!data.accounts.length && (
        <section className="empty">
          <h2>Seu saldo começa com uma conta.</h2>
          <p>
            Informe o saldo real e a data de referência. Nenhuma receita será
            criada.
          </p>
        </section>
      )}
      <section className="panel">
        <h2>Suas categorias</h2>
        {data.categories.map((c) => (
          <div key={c.id} className="overview-row">
            <span>
              {c.name} · {c.status === "active" ? "Ativa" : "Arquivada"}
              {c.benefitEligible ? " · Elegível para ticket" : ""}
            </span>
            <button onClick={() => onOpen({ mode: "category", id: c.id })}>
              Editar categoria
            </button>
          </div>
        ))}
      </section>
      <section className="panel">
        <h2>Transferências confirmadas</h2>
        {data.transfers.map((t) => (
          <div className="overview-row" key={t.id}>
            <span>
              {dateLabel(t.date)} ·{" "}
              {data.accounts.find((a) => a.id === t.fromId)?.name} →{" "}
              {data.accounts.find((a) => a.id === t.toId)?.name} ·{" "}
              {money(t.amount)} ·{" "}
              {t.status === "active" ? "Confirmada" : "Estornada"}
            </span>
            {t.status === "active" && (
              <button
                disabled={action.busy}
                onClick={() =>
                  void action.run(
                    () => reverseTransfer(t.id, crypto.randomUUID()),
                    "Transferência estornada.",
                  )
                }
              >
                Estornar transferência
              </button>
            )}
          </div>
        ))}
      </section>
      <details className="panel">
        <summary>Histórico financeiro recente</summary>
        {changes?.map((c) => (
          <details key={c.id}>
            <summary>
              {new Date(c.at).toLocaleString("pt-BR")} · {c.action}
            </summary>
            <p className="muted small preserve-text">
              Antes: {c.before ?? "Sem registro anterior"}
              <br />
              Depois: {c.after ?? "Sem conteúdo"}
            </p>
          </details>
        ))}
      </details>
    </>
  );
}

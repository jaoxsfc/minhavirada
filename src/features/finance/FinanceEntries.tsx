import { useState } from "react";
import { Status, useAction } from "../../components/RoutineUI";
import {
  entryStatus,
  entryRemaining,
} from "../../services/finance/calculations";
import { cancelEntry, reversePayment } from "../../services/finance/commands";
import { monthRange, dateLabel } from "../../lib/calendar";
import { localDate, money } from "../../lib/date";
import { statusNames, type FinancePanelProps } from "./shared";
export default function FinanceEntries({ data, onOpen }: FinancePanelProps) {
  const [month, setMonth] = useState(localDate().slice(0, 7));
  const [search, setSearch] = useState("");
  const [state, setState] = useState("all");
  const [account, setAccount] = useState("all");
  const [category, setCategory] = useState("all");
  const [limit, setLimit] = useState(50);
  const action = useAction();
  const period = monthRange(month);
  const rows = data.entries
    .filter(
      (e) =>
        e.dueDate >= period.from &&
        e.dueDate <= period.to &&
        (state === "all" || entryStatus(data, e) === state) &&
        (account === "all" || e.accountId === account) &&
        (category === "all" || e.categoryId === category) &&
        e.description
          .toLocaleLowerCase("pt-BR")
          .includes(search.toLocaleLowerCase("pt-BR")),
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return (
    <>
      <div className="section-title">
        <h2>Receitas e despesas</h2>
        <div className="actions">
          <button onClick={() => onOpen({ mode: "entry", kind: "expense" })}>
            Adicionar gasto
          </button>
          <button onClick={() => onOpen({ mode: "entry", kind: "income" })}>
            Registrar receita
          </button>
        </div>
      </div>
      <Status message={action.message} />
      <section className="filter-panel">
        <div className="filter-grid">
          <label>
            Mês dos lançamentos
            <input
              type="month"
              value={month}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
            />
          </label>
          <label>
            Conta
            <select
              value={account}
              onChange={(e) => setAccount(e.target.value)}
            >
              <option value="all">Todas</option>
              {data.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Categoria
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
          <label>
            Pesquisar descrição
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label>
            Estado do lançamento
            <select value={state} onChange={(e) => setState(e.target.value)}>
              <option value="all">Todos</option>
              {Object.entries(statusNames).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
      <div className="routine-list">
        {rows.slice(0, limit).map((e) => (
          <article className="routine-card" key={e.id}>
            <div className="routine-card-top">
              <div>
                <span className="eyebrow">
                  {e.kind === "income" ? "Receita" : "Despesa"} ·{" "}
                  {statusNames[entryStatus(data, e)]}
                </span>
                <h3>{e.description}</h3>
                <p className="muted small">
                  Vence {dateLabel(e.dueDate)} · competência{" "}
                  {dateLabel(e.competence)} ·{" "}
                  {data.accounts.find((a) => a.id === e.accountId)?.name}
                </p>
              </div>
              <strong>{money(e.amount)}</strong>
            </div>
            <p className="muted small">
              Restante: {money(entryRemaining(data, e))}
              {e.occurrenceId ? " · Ocorrência recorrente" : ""}
            </p>
            <div className="actions">
              {entryRemaining(data, e) > 0 && (
                <button
                  className="primary"
                  onClick={() =>
                    onOpen({
                      mode: "payment",
                      targetType: "entry",
                      targetId: e.id,
                    })
                  }
                >
                  {e.kind === "income"
                    ? "Confirmar recebimento"
                    : "Pagar conta"}
                </button>
              )}
              <button onClick={() => onOpen({ mode: "entry", id: e.id })}>
                Editar lançamento
              </button>
              {e.status !== "cancelled" && (
                <button
                  disabled={action.busy}
                  onClick={() =>
                    void action.run(
                      () => cancelEntry(e.id, crypto.randomUUID()),
                      "Lançamento cancelado, com histórico preservado.",
                    )
                  }
                >
                  Cancelar lançamento
                </button>
              )}
            </div>
            <details>
              <summary>Pagamentos e estornos</summary>
              {data.payments
                .filter((p) => p.targetType === "entry" && p.targetId === e.id)
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
                            "Pagamento estornado. Saldo recalculado.",
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
      </div>
      {rows.length > 0 && (
        <p className="muted small">
          Exibindo {Math.min(limit, rows.length)} de {rows.length} lançamentos
          neste filtro.
        </p>
      )}
      {rows.length > limit && (
        <button onClick={() => setLimit((value) => value + 50)}>
          Mostrar mais lançamentos
        </button>
      )}
      {!rows.length && (
        <section className="empty">
          <h2>Nenhum lançamento neste filtro.</h2>
          <p>
            Registre suas contas e confirme os pagamentos quando acontecerem.
          </p>
        </section>
      )}
    </>
  );
}

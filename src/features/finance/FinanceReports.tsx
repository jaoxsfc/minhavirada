import { useState, lazy, Suspense } from "react";
import { useLocalToday } from "../../hooks/useLocalToday";
import {
  categoryTotals,
  monthlyCashHistory,
} from "../../services/finance/views";
import { cashFlow } from "../../services/finance/calculations";
import { dateLabel, monthRange } from "../../lib/calendar";
import { money } from "../../lib/date";
import { downloadCsv } from "../../lib/csv";
import type { FinancePanelProps } from "./shared";
const CategoryChart = lazy(() =>
  import("./FinanceCharts").then((m) => ({ default: m.CategoryChart })),
);
export default function FinanceReports({ data }: FinancePanelProps) {
  const today = useLocalToday();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [account, setAccount] = useState("all");
  const [category, setCategory] = useState("all");
  const period = monthRange(month);
  const report = categoryTotals(
    data,
    period.from,
    period.to,
    account,
    category,
  );
  const flows = cashFlow(data, period.from, period.to).filter(
    (p) =>
      (account === "all" || p.accountId === account) &&
      (category === "all" || p.categoryId === category),
  );
  return (
    <>
      <h2>Um olhar para suas escolhas</h2>
      <section className="filter-panel">
        <div className="filter-grid">
          <label>
            Mês financeiro
            <input
              type="month"
              value={month}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
            />
          </label>
          <label>
            Filtrar conta
            <select
              value={account}
              onChange={(e) => setAccount(e.target.value)}
            >
              <option value="all">Todas</option>
              {data.accounts
                .filter((a) => a.type !== "benefit")
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Filtrar categoria
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
      <section className="panel">
        <h2>Despesas por competência</h2>
        <p className="muted small">
          Inclui previsões e pendências. Compras no cartão entram pelo total na
          data da compra; pagamentos de fatura não são outra despesa. Benefício
          fica no módulo próprio. Filtro por conta atribui compras à conta
          padrão do cartão.
        </p>
        {report.categories.length ? (
          <Suspense fallback={<p>Preparando gráfico…</p>}>
            <CategoryChart rows={report.categories} />
          </Suspense>
        ) : (
          <p>Nenhuma despesa por competência neste filtro.</p>
        )}
        {report.categories.map((c) => (
          <p key={c.name}>
            {c.name}: <strong>{money(c.amount)}</strong>
          </p>
        ))}
        {report.categories[0] && (
          <p className="muted small">
            Maior categoria registrada: {report.categories[0].name}. Revise
            esses gastos para identificar o que pode ser ajustado; não estimamos
            economias sem seus dados.
          </p>
        )}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Descrição</th>
                <th>Competência</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((r) => (
                <tr key={r.id}>
                  <td>{dateLabel(r.date)}</td>
                  <td>{r.description}</td>
                  <td>{money(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          onClick={() =>
            downloadCsv(
              report.rows.map((r) => ({
                data: r.date,
                descricao: r.description,
                categoria:
                  data.categories.find((c) => c.id === r.categoryId)?.name ??
                  "",
                valor_centavos: r.amount,
                valor_brl: money(r.amount),
                origem: r.source,
              })),
            )
          }
        >
          Exportar competência CSV
        </button>
      </section>
      <section className="panel">
        <h2>Fluxo de caixa realizado</h2>
        <p className="muted small">
          Somente pagamentos e recebimentos bancários confirmados no período.
          Inclui faturas; transferências e ticket ficam separados. Pagamentos de
          fatura não são rateados por categoria no caixa.
        </p>
        {flows.map((p) => (
          <div className="overview-row" key={p.id}>
            <span>
              {dateLabel(p.date)} · {p.description}
            </span>
            <strong>{money(p.amount)}</strong>
          </div>
        ))}
        <button
          onClick={() =>
            downloadCsv(
              flows.map((p) => ({
                data: p.date,
                descricao: p.description,
                conta:
                  data.accounts.find((a) => a.id === p.accountId)?.name ?? "",
                valor_centavos: p.amount,
                valor_brl: money(p.amount),
              })),
            )
          }
        >
          Exportar fluxo CSV
        </button>
      </section>
      <section className="panel">
        <h2>Histórico mensal geral confirmado</h2>
        {monthlyCashHistory(data, month).map((row) => (
          <div className="overview-row" key={row.month}>
            <span>{row.month}</span>
            <span>
              Recebido {money(row.income)} · pago {money(row.paid)}
            </span>
          </div>
        ))}
      </section>
    </>
  );
}

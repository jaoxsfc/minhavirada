import { useState } from "react";
import { Link } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { useRoutines } from "../../hooks/useRoutines";
import { localDate } from "../../lib/date";
import { chartDays } from "../../services/routines";
import {
  dateLabel,
  weekStart,
  shiftDate,
  monthRange,
} from "../../lib/calendar";
import { DataState } from "../../components/RoutineUI";
export default function ReportsPage() {
  const data = useRoutines();
  const [period, setPeriod] = useState("week");
  const [anchor, setAnchor] = useState(localDate());
  const range =
    period === "week"
      ? { from: weekStart(anchor), to: shiftDate(weekStart(anchor), 6) }
      : monthRange(anchor.slice(0, 7));
  const chart = chartDays(data?.checkIns ?? [], range.from, range.to);
  const records = (data?.checkIns ?? []).filter(
    (c) => c.date >= range.from && c.date <= range.to,
  );
  const total = records.reduce((sum, c) => sum + c.activityMinutes, 0);
  const projects = records.reduce((sum, c) => sum + c.projectMinutes, 0);
  return (
    <>
      <p className="eyebrow">PERCEBA O SEU CAMINHO</p>
      <h1>Minha evolução.</h1>
      <p className="muted">Um olhar gentil para os dias que você registrou.</p>
      <div className="toolbar">
        <label>
          Período dos gráficos
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="week">Semana</option>
            <option value="month">Mês</option>
          </select>
        </label>
        <label>
          Data de referência
          <input
            type="date"
            value={anchor}
            max={localDate()}
            onChange={(e) => e.target.value && setAnchor(e.target.value)}
          />
        </label>
      </div>
      <DataState data={data}>
        <p className="muted small">
          {dateLabel(range.from)} — {dateLabel(range.to)} · Apenas dias
          registrados entram nos cálculos. Lacunas não são convertidas em zero.
        </p>
        <div className="stats-grid">
          <article className="stat">
            <span>Dias registrados</span>
            <strong>{records.length}</strong>
            <p>neste período</p>
          </article>
          <article className="stat">
            <span>Movimento</span>
            <strong>
              {total}
              <small> min</small>
            </strong>
            <p>de atividade confirmada</p>
          </article>
          <article className="stat">
            <span>Projetos pessoais</span>
            <strong>
              {projects}
              <small> min</small>
            </strong>
            <p>de dedicação registrada</p>
          </article>
        </div>
        {records.length ? (
          <>
            <section className="panel">
              <h2>Humor e energia</h2>
              <p className="muted small">
                Humor: 1 muito ruim, 2 ruim, 3 normal, 4 bom, 5 muito bom.
                Energia: de 1 a 5.
              </p>
              <div
                className="chart"
                role="img"
                aria-label="Gráfico de humor e energia nos dias registrados"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chart}>
                    <CartesianGrid
                      stroke="var(--border)"
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      dataKey="date"
                      tickFormatter={dateLabel}
                      tick={{ fill: "var(--muted)", fontSize: 10 }}
                    />
                    <YAxis
                      domain={[1, 5]}
                      allowDecimals={false}
                      tick={{ fill: "var(--muted)" }}
                    />
                    <Tooltip
                      labelFormatter={(v) => dateLabel(String(v))}
                      contentStyle={{
                        background: "var(--surface)",
                        borderColor: "var(--border)",
                        color: "var(--ink)",
                      }}
                    />
                    <Legend />
                    <Line
                      isAnimationActive={false}
                      name="Humor"
                      dataKey="mood"
                      stroke="var(--chart-primary)"
                      strokeWidth={2}
                      connectNulls={false}
                    />
                    <Line
                      isAnimationActive={false}
                      name="Energia"
                      dataKey="energy"
                      stroke="var(--chart-secondary)"
                      strokeDasharray="5 4"
                      strokeWidth={2}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="panel">
              <h2>Tempo de cuidado e criação</h2>
              <div
                className="chart"
                role="img"
                aria-label="Gráfico de minutos de atividade e projetos"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart}>
                    <CartesianGrid
                      stroke="var(--border)"
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      dataKey="date"
                      tickFormatter={dateLabel}
                      tick={{ fill: "var(--muted)", fontSize: 10 }}
                    />
                    <YAxis tick={{ fill: "var(--muted)" }} />
                    <Tooltip
                      labelFormatter={(v) => dateLabel(String(v))}
                      contentStyle={{
                        background: "var(--surface)",
                        borderColor: "var(--border)",
                        color: "var(--ink)",
                      }}
                    />
                    <Legend />
                    <Bar
                      isAnimationActive={false}
                      name="Atividade (min)"
                      dataKey="activity"
                      fill="var(--chart-primary)"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      isAnimationActive={false}
                      name="Projetos (min)"
                      dataKey="projects"
                      fill="var(--chart-secondary)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="panel">
              <h2>Os dados por trás dos gráficos</h2>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Dia</th>
                      <th>Humor (1–5)</th>
                      <th>Energia (1–5)</th>
                      <th>Atividade (min)</th>
                      <th>Projetos (min)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chart.map((row) => (
                      <tr key={row.date}>
                        <th scope="row">{dateLabel(row.date)}</th>
                        <td>{row.mood ?? "Sem registro"}</td>
                        <td>{row.energy ?? "—"}</td>
                        <td>{row.activity ?? "—"}</td>
                        <td>{row.projects ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : (
          <section className="empty">
            <h2>Seu histórico começa com um dia.</h2>
            <p>
              Nenhum check-in neste período. Não há resultados para estimar.
            </p>
            <Link className="text-link" to="/habitos/check-in">
              Registrar check-in →
            </Link>
          </section>
        )}
        <p className="muted small">
          <Link className="text-link" to="/financas/relatorios">
            Abrir relatórios financeiros →
          </Link>
        </p>
      </DataState>
    </>
  );
}

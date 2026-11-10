import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";
import { money } from "../../lib/date";
export function ProjectionChart({
  rows,
}: {
  rows: { month: string; closing: number }[];
}) {
  return (
    <div
      className="chart"
      role="img"
      aria-label="Saldo bancário projetado para doze meses"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="month"
            tick={{ fill: "var(--muted)", fontSize: 10 }}
          />
          <YAxis
            tickFormatter={(n) => String(Number(n) / 100)}
            tick={{ fill: "var(--muted)", fontSize: 10 }}
          />
          <Tooltip
            formatter={(value) => money(Number(value))}
            contentStyle={{ background: "var(--surface)", color: "var(--ink)" }}
          />
          <Line
            name="Saldo projetado"
            dataKey="closing"
            stroke="var(--chart-secondary)"
            strokeDasharray="5 4"
            strokeWidth={2}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
export function CategoryChart({
  rows,
}: {
  rows: { name: string; amount: number }[];
}) {
  return (
    <div
      className="chart"
      role="img"
      aria-label="Despesas por categoria, por competência"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 10 }} />
          <YAxis
            tickFormatter={(n) => String(Number(n) / 100)}
            tick={{ fill: "var(--muted)", fontSize: 10 }}
          />
          <Tooltip
            formatter={(value) => money(Number(value))}
            contentStyle={{ background: "var(--surface)", color: "var(--ink)" }}
          />
          <Bar
            name="Competência"
            dataKey="amount"
            fill="var(--chart-primary)"
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

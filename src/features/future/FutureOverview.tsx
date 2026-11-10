import { Link } from "react-router-dom";
import type { FutureData } from "./models";
import type { FinanceData } from "../finance/models";
import type { Task, TaskRecord } from "../tasks/models";
import {
  goalProgress,
  opportunitySummary,
  allocated,
} from "../../services/future-calculations";
import { dateLabel, shiftDate, weekStart } from "../../lib/calendar";
import { localDate, money } from "../../lib/date";
import { taskOccurrences } from "../../services/routines";
export function FutureOverview({
  data,
  finance,
  tasks,
  records,
}: {
  data: FutureData;
  finance: FinanceData;
  tasks: Task[];
  records: TaskRecord[];
}) {
  const today = localDate(),
    start = weekStart(today);
  const priority = { high: 0, medium: 1, low: 2 };
  const active = data.goals
    .filter((g) => g.status === "active")
    .sort(
      (a, b) =>
        priority[a.priority] - priority[b.priority] ||
        (a.deadline || "9999").localeCompare(b.deadline || "9999"),
    );
  const next = active[0],
    reserve = active.find(
      (g) => g.category === "Reserva" || g.suggestionKey === "reserve",
    );
  const milestones = data.milestones
    .filter(
      (m) =>
        !m.completed && m.deadline && active.some((g) => g.id === m.goalId),
    )
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .slice(0, 3);
  const summary = opportunitySummary(data, finance);
  const linkedIds = new Set(data.taskLinks.map((l) => l.id));
  const week = taskOccurrences(
    tasks.filter((t) => linkedIds.has(t.id)),
    records,
    start,
    shiftDate(start, 6),
  );
  const weekly = allocated(
    data.movements.filter((m) => m.date >= start),
    undefined,
    undefined,
    today,
  );
  const minutes = data.timeEntries
    .filter((t) => t.date >= start && t.date <= today)
    .reduce((n, t) => n + t.minutes, 0);
  return (
    <>
      <section className="future-banner">
        <p className="eyebrow">MEU FUTURO</p>
        <h2>O amanhã ganha forma nos pequenos passos.</h2>
        <p>
          {next
            ? "Sua prioridade agora: " + next.title
            : "Escolha um objetivo que faça sentido para este momento."}
        </p>
        <div className="future-metrics">
          <div>
            <span>Reserva financeira</span>
            <strong>
              {reserve
                ? money(goalProgress(reserve, data).reserved)
                : "Ainda não configurada"}
            </strong>
            {reserve && (
              <span>
                {reserve.target === null
                  ? "Valor-alvo em aberto"
                  : money(reserve.target) +
                    " de objetivo · " +
                    Math.round(goalProgress(reserve, data).percent ?? 0) +
                    "%"}
              </span>
            )}
          </div>
          <div>
            <span>Oportunidades abertas</span>
            <strong>{summary.open}</strong>
          </div>
          <div>
            <span>Tarefas vinculadas na semana</span>
            <strong>
              {week.filter((o) => o.status === "done").length}/{week.length}{" "}
              concluídas
            </strong>
          </div>
        </div>
      </section>
      <div className="future-columns">
        <section className="panel">
          <h3>Seu próximo passo possível</h3>
          <p>
            {!active.length
              ? "Comece confirmando uma sugestão ou criando sua própria meta."
              : next?.type === "financial" &&
                  !data.movements.some((m) => m.goalId === next.id)
                ? "Confira o saldo real da sua conta e escolha quanto pode reservar para " +
                  next.title +
                  "."
                : week.some((o) => o.status === "pending")
                  ? "Você tem tarefas vinculadas pendentes nesta semana. Reserve um momento possível para uma delas."
                  : "Defina ou revise o próximo marco da sua meta prioritária."}
          </p>
          <Link className="text-link" to="/metas/objetivos">
            Cuidar das minhas metas →
          </Link>
          <h3>Evolução nesta semana</h3>
          <p className="muted small">
            {money(weekly)} de variação líquida nas alocações · {minutes} min
            registrados em projetos. Valores zero significam que não há
            movimentos registrados no período.
          </p>
        </section>
        <section className="panel">
          <h3>Marcos próximos</h3>
          {milestones.map((m) => (
            <p key={m.id}>
              <strong>{m.title}</strong>
              <br />
              <span className="muted small">
                {dateLabel(m.deadline)} ·{" "}
                {data.goals.find((g) => g.id === m.goalId)?.title}
              </span>
            </p>
          ))}
          {!milestones.length && (
            <p className="muted">
              Nenhum marco com prazo definido. Você pode planejar sem pressa.
            </p>
          )}
          <Link className="text-link" to="/mais/renda">
            Acompanhar oportunidades de renda →
          </Link>
        </section>
      </div>
    </>
  );
}

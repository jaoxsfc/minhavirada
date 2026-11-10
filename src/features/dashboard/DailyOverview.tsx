import { Link } from "react-router-dom";
import { useRoutines } from "../../hooks/useRoutines";
import type { Settings } from "../../db/database";
import { DataState, Status, useAction } from "../../components/RoutineUI";
import { useLocalToday } from "../../hooks/useLocalToday";
import { weekStart, shiftDate, dateLabel } from "../../lib/calendar";
import {
  consumptionSummary,
  isHabitScheduled,
  taskOccurrences,
} from "../../services/routines";
import { logHabit, updateOccurrence } from "../../repositories/routines";
export function DailyOverview({ profile }: { profile?: Settings }) {
  const data = useRoutines();
  const action = useAction();
  const today = useLocalToday();
  const entry = data?.checkIns.find((c) => c.date === today);
  const week =
    data?.checkIns.filter(
      (c) => c.date >= weekStart(today) && c.date <= today,
    ) ?? [];
  const tasks = data
    ? taskOccurrences(
        data.tasks,
        data.taskRecords,
        today,
        shiftDate(today, 7),
        "pending",
      ).slice(0, 4)
    : [];
  const habits = data?.habits.filter((h) => isHabitScheduled(h, today)) ?? [];
  const attempt = data?.attempts.at(-1);
  const sensitive =
    profile?.hideSensitive === false && attempt && data
      ? consumptionSummary(data.checkIns, attempt.startDate, today)
      : undefined;
  return (
    <DataState data={data}>
      <section className="daily-overview">
        <div className="section-title">
          <h2>Seu dia, com intenção</h2>
          <Link className="text-link" to="/habitos/calendario">
            Meu calendário →
          </Link>
        </div>
        <div className="checkin-banner">
          <div>
            <p className="eyebrow">SEU MOMENTO DE PAUSA</p>
            <h3>
              {entry ? "Check-in de hoje concluído" : "Como você está hoje?"}
            </h3>
            <p className="muted small">
              {entry
                ? "Seu registro está salvo. Você pode ajustá-lo quando quiser."
                : "Ainda não há registro de hoje. Um minuto para perceber seu dia."}
            </p>
          </div>
          <Link className="primary button-link" to="/habitos/check-in">
            {entry ? "Editar check-in" : "Registrar check-in"}
          </Link>
        </div>
        <Status message={action.message} />
        <div className="overview-grid">
          <section className="panel">
            <div className="section-title">
              <h2>Próximas tarefas</h2>
              <Link className="text-link" to="/habitos/tarefas">
                Ver todas
              </Link>
            </div>
            {tasks.length ? (
              tasks.map((o) => (
                <div
                  className="overview-row"
                  key={`${o.task.id}:${o.scheduledDate}`}
                >
                  <div>
                    <strong>{o.task.title}</strong>
                    <p className="muted small">
                      {dateLabel(o.dueDate)}
                      {o.task.time ? ` · ${o.task.time}` : ""} ·{" "}
                      {o.task.duration} min estimados
                    </p>
                  </div>
                  {o.dueDate <= today && (
                    <button
                      aria-label={`Concluir ${o.task.title}`}
                      disabled={action.busy}
                      onClick={() =>
                        void action.run(
                          () =>
                            updateOccurrence(
                              o.task.id,
                              o.scheduledDate,
                              "done",
                            ),
                          "Tarefa concluída.",
                        )
                      }
                    >
                      Concluir
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p className="muted small">
                Nenhuma tarefa pendente nos próximos 8 dias. Abra espaço para um
                próximo passo.
              </p>
            )}
          </section>
          <section className="panel">
            <div className="section-title">
              <h2>Hábitos para hoje</h2>
              <Link className="text-link" to="/habitos">
                Minha rotina
              </Link>
            </div>
            {habits.length ? (
              habits.map((h) => {
                const done = data?.habitLogs.find(
                  (l) => l.habitId === h.id && l.date === today,
                )?.completed;
                return (
                  <div className="overview-row" key={h.id}>
                    <div>
                      <strong>{h.name}</strong>
                      <p className="muted small">
                        {h.duration} min sugeridos ·{" "}
                        {done ? "Concluído hoje" : "Programado para hoje"}
                      </p>
                    </div>
                    <button
                      aria-label={`${done ? "Desfazer" : "Concluir"} ${h.name}`}
                      aria-pressed={!!done}
                      disabled={action.busy}
                      onClick={() =>
                        void action.run(
                          () =>
                            logHabit(h.id, today, !done, done ? 0 : h.duration),
                          done ? "Conclusão desmarcada." : "Hábito concluído.",
                        )
                      }
                    >
                      {done ? "✓" : "Concluir"}
                    </button>
                  </div>
                );
              })
            ) : (
              <p className="muted small">
                Nenhum hábito programado para hoje. Escolha uma rotina que faça
                sentido para você.
              </p>
            )}
          </section>
        </div>
        <div className="section-title">
          <h2>Sua semana até hoje</h2>
          <Link className="text-link" to="/mais/relatorios">
            Ver evolução →
          </Link>
        </div>
        <div className="stats-grid">
          <article className="stat">
            <span>Dias registrados</span>
            <strong>{week.length}</strong>
            <p>check-ins confirmados</p>
          </article>
          <article className="stat">
            <span>Movimento</span>
            <strong>
              {week.reduce((sum, c) => sum + c.activityMinutes, 0)}
              <small> min</small>
            </strong>
            <p>{week.filter((c) => c.exercise).length} dias com atividade</p>
          </article>
          <article className="stat">
            <span>Projetos pessoais</span>
            <strong>
              {week.reduce((sum, c) => sum + c.projectMinutes, 0)}
              <small> min</small>
            </strong>
            <p>de dedicação registrada</p>
          </article>
        </div>
        <p className="muted small">
          Dias sem check-in não entram nas médias nem são considerados dias sem
          atividade.
        </p>
        {sensitive && (
          <section className="panel" data-testid="sensitive-summary">
            <h2>Seu acompanhamento pessoal</h2>
            <p>
              {sensitive.streak} dias consecutivos confirmados sem consumo ·{" "}
              {sensitive.confirmed} dias sem consumo desde{" "}
              {dateLabel(attempt!.startDate)}.
            </p>
            <Link className="text-link" to="/habitos/acompanhamento">
              Abrir acompanhamento →
            </Link>
          </section>
        )}
      </section>
    </DataState>
  );
}

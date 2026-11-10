import { useState } from "react";
import { Link } from "react-router-dom";
import { useFuture } from "../../hooks/useFuture";
import { useLocalToday } from "../../hooks/useLocalToday";
import { taskOccurrences } from "../../services/routines";
import { shiftDate, weekStart, dateLabel } from "../../lib/calendar";
import { TaskForm } from "../tasks/TaskForm";
import { Status, useAction } from "../../components/RoutineUI";
import { updateOccurrence } from "../../repositories/routines";
export function LinkedTasks({
  targetType,
  targetId,
}: {
  targetType: "goal" | "project";
  targetId: string;
}) {
  const data = useFuture(),
    today = useLocalToday(),
    action = useAction();
  const [adding, setAdding] = useState(false);
  const ids = new Set(
    data?.future?.taskLinks
      .filter((l) => l.targetType === targetType && l.targetId === targetId)
      .map((l) => l.id),
  );
  const tasks = data?.tasks.filter((t) => ids.has(t.id)) ?? [];
  const rows = taskOccurrences(
    tasks,
    data?.taskRecords ?? [],
    weekStart(today),
    shiftDate(weekStart(today), 6),
  );
  return (
    <section className="panel">
      <div className="section-title">
        <h3>Próximos passos · esta semana</h3>
        <button onClick={() => setAdding(true)}>Criar tarefa vinculada</button>
      </div>
      <Status message={action.message} />
      {adding && (
        <TaskForm
          initialLink={{ targetType, targetId }}
          onSaved={() => {
            setAdding(false);
            void action.run(async () => undefined, "Tarefa vinculada salva.");
          }}
          onCancel={() => setAdding(false)}
          onError={(s) =>
            void action.run(async () => {
              throw new Error(s);
            })
          }
        />
      )}
      {rows.map((o) => (
        <article className="manage-row" key={o.task.id + o.scheduledDate}>
          <div>
            <strong>{o.task.title}</strong>
            <p className="muted small">
              {dateLabel(o.dueDate)} ·{" "}
              {o.status === "done" ? "Concluída" : "Pendente"}
            </p>
          </div>
          <button
            disabled={action.busy || o.dueDate > today}
            onClick={() =>
              void action.run(() =>
                updateOccurrence(
                  o.task.id,
                  o.scheduledDate,
                  o.status === "done" ? "reopen" : "done",
                ),
              )
            }
          >
            {o.status === "done" ? "Reabrir" : "Concluir tarefa"}
          </button>
        </article>
      ))}
      {!rows.length && (
        <p className="muted small">Nenhuma tarefa vinculada nesta semana.</p>
      )}
      <Link className="text-link" to="/habitos/tarefas">
        Editar, adiar e consultar todas as tarefas →
      </Link>
    </section>
  );
}

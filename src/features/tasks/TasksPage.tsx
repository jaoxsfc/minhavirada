import { useState } from "react";
import { Link } from "react-router-dom";
import { useRoutines } from "../../hooks/useRoutines";
import { useLocalToday } from "../../hooks/useLocalToday";
import {
  dateLabel,
  shiftDate,
  weekStart,
  monthRange,
} from "../../lib/calendar";
import { taskOccurrences } from "../../services/routines";
import { setTaskStatus, updateOccurrence } from "../../repositories/routines";
import { DataState, Status, useAction } from "../../components/RoutineUI";
import { TaskForm } from "./TaskForm";
import { eventLabel } from "../../lib/routine-events";
import type { Task, Occurrence } from "./models";
function TaskRow({
  occurrence,
  onAction,
  busy,
}: {
  occurrence: Occurrence;
  onAction: (action: "done" | "reopen" | "postpone", date?: string) => void;
  busy: boolean;
}) {
  const today = useLocalToday();
  const [postpone, setPostpone] = useState(false);
  const [date, setDate] = useState(shiftDate(occurrence.dueDate, 1));
  const { task, status, dueDate, scheduledDate } = occurrence;
  return (
    <article className="routine-card">
      <div className="routine-card-top">
        <div>
          <span className="eyebrow">
            {dateLabel(dueDate)}
            {task.time ? ` · ${task.time}` : ""} ·{" "}
            {status === "done"
              ? "Concluída"
              : dueDate < today
                ? "Pendente de outro dia"
                : "Pendente"}
          </span>
          <h3>{task.title}</h3>
          <p className="muted small">{task.description}</p>
        </div>
        <span className="pill">
          {{ low: "Baixa", medium: "Média", high: "Alta" }[task.priority]}
        </span>
      </div>
      <p className="muted small">
        {task.duration} min estimados ·{" "}
        {task.recurrence === "once"
          ? "Pontual"
          : task.recurrence === "daily"
            ? "Diária"
            : "Semanal"}
        {dueDate !== scheduledDate
          ? ` · Adiada de ${dateLabel(scheduledDate)}`
          : ""}
      </p>
      <div className="actions">
        <button
          className={status === "done" ? "completed-button" : "primary"}
          disabled={busy || (status === "pending" && dueDate > today)}
          onClick={() => onAction(status === "done" ? "reopen" : "done")}
        >
          {status === "done" ? "✓ Concluída · reabrir" : "Concluir tarefa"}
        </button>
        {status === "pending" && (
          <button onClick={() => setPostpone(!postpone)}>Adiar</button>
        )}
      </div>
      {dueDate > today && status === "pending" && (
        <p className="muted small">
          A conclusão fica disponível na data da tarefa.
        </p>
      )}
      {postpone && (
        <form
          className="postpone-form"
          onSubmit={(e) => {
            e.preventDefault();
            onAction("postpone", date);
            setPostpone(false);
          }}
        >
          <label>
            Nova data
            <input
              type="date"
              min={shiftDate(dueDate, 1)}
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <button disabled={busy}>Confirmar adiamento</button>
        </form>
      )}
    </article>
  );
}
export default function TasksPage() {
  const data = useRoutines();
  const action = useAction();
  const today = useLocalToday();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(shiftDate(today, 7));
  const [state, setState] = useState("all");
  const [editor, setEditor] = useState<Task | "new">();
  const [showManage, setShowManage] = useState(false);
  const valid =
    !!from &&
    !!to &&
    from <= to &&
    (Date.parse(to) - Date.parse(from)) / 86400000 <= 366;
  const occurrences =
    valid && data
      ? taskOccurrences(data.tasks, data.taskRecords, from, to, state)
      : [];
  return (
    <>
      <Link className="text-link" to="/habitos">
        ← Hábitos e rotina
      </Link>
      <p className="eyebrow">ESPAÇO PARA O QUE IMPORTA</p>
      <h1>Minhas tarefas.</h1>
      <p className="muted">
        Organize o possível. Ajustar a rota também é avançar.
      </p>
      <DataState data={data}>
        <div className="section-title">
          <h2>Próximos passos</h2>
          <button onClick={() => setEditor("new")}>Nova tarefa</button>
        </div>
        <Status message={action.message} />
        {editor && (
          <TaskForm
            key={editor === "new" ? "new" : `${editor.id}:${editor.revision}`}
            task={editor === "new" ? undefined : editor}
            onSaved={() => {
              setEditor(undefined);
              void action.run(
                async () => undefined,
                "Tarefa salva neste dispositivo.",
              );
            }}
            onCancel={() => setEditor(undefined)}
            onError={(s) =>
              void action.run(async () => {
                throw new Error(s);
              })
            }
          />
        )}
        <section className="filter-panel">
          <div className="actions">
            <button
              onClick={() => {
                setFrom(today);
                setTo(today);
              }}
            >
              Hoje
            </button>
            <button
              onClick={() => {
                setFrom(weekStart());
                setTo(shiftDate(weekStart(), 6));
              }}
            >
              Esta semana
            </button>
            <button
              onClick={() => {
                const range = monthRange(today.slice(0, 7));
                setFrom(range.from);
                setTo(range.to);
              }}
            >
              Este mês
            </button>
          </div>
          <div className="filter-grid">
            <label>
              De
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label>
              Até
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
            <label>
              Estado
              <select value={state} onChange={(e) => setState(e.target.value)}>
                <option value="all">Todos</option>
                <option value="pending">Pendentes</option>
                <option value="done">Concluídas</option>
              </select>
            </label>
          </div>
          {!valid && (
            <p role="alert" className="error">
              Escolha um intervalo válido de até 366 dias.
            </p>
          )}
        </section>
        <div className="routine-list">
          {occurrences.map((o) => (
            <TaskRow
              key={`${o.task.id}:${o.scheduledDate}:${o.dueDate}`}
              occurrence={o}
              busy={action.busy}
              onAction={(kind, date) =>
                void action.run(
                  () =>
                    updateOccurrence(o.task.id, o.scheduledDate, kind, date),
                  kind === "postpone"
                    ? "Tarefa adiada. A ocorrência original foi preservada."
                    : kind === "done"
                      ? "Tarefa concluída."
                      : "Tarefa reaberta.",
                )
              }
            />
          ))}
        </div>
        {!occurrences.length && valid && (
          <section className="empty">
            <h2>Nenhuma tarefa neste filtro.</h2>
            <p>Escolha outro período ou crie um pequeno próximo passo.</p>
          </section>
        )}
        <section className="panel">
          <div className="section-title">
            <h2>Tarefas e histórico</h2>
            <button onClick={() => setShowManage(!showManage)}>
              {showManage ? "Recolher tarefas" : "Gerenciar tarefas"}
            </button>
          </div>
          {showManage && (
            <>
              {data?.tasks.map((task) => (
                <article key={task.id} className="manage-row">
                  <h3>
                    {task.title}{" "}
                    <span className="pill">
                      {task.status === "archived" ? "Arquivada" : "Ativa"}
                    </span>
                  </h3>
                  <div className="actions">
                    <button onClick={() => setEditor(task)}>
                      Editar tarefa
                    </button>
                    <button
                      disabled={action.busy}
                      onClick={() =>
                        void action.run(
                          () =>
                            setTaskStatus(
                              task.id,
                              task.status === "active" ? "archived" : "active",
                            ),
                          "Status atualizado. Histórico preservado.",
                        )
                      }
                    >
                      {task.status === "active"
                        ? "Arquivar tarefa"
                        : "Reativar tarefa"}
                    </button>
                  </div>
                  <details>
                    <summary>Ver histórico</summary>
                    {data.events
                      .filter(
                        (e) => e.entity === "task" && e.entityId === task.id,
                      )
                      .slice(0, 30)
                      .map((e) => (
                        <p className="muted small" key={e.id}>
                          {dateLabel(e.date)} · {eventLabel(e.action)}
                          {e.toDate
                            ? ` · ${dateLabel(e.fromDate!)} → ${dateLabel(e.toDate)}`
                            : ""}
                        </p>
                      ))}
                  </details>
                </article>
              ))}
              {!data?.tasks.length && (
                <p className="muted">Nenhuma tarefa cadastrada.</p>
              )}
            </>
          )}
        </section>
      </DataState>
    </>
  );
}

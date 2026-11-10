import { eventLabel } from "../../lib/routine-events";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Sprout,
  CalendarDays,
  ClipboardCheck,
  ArrowUpRight,
} from "lucide-react";
import { useRoutines } from "../../hooks/useRoutines";
import { useLocalToday } from "../../hooks/useLocalToday";
import { dateLabel, weekStart, weekdays, dayOfWeek } from "../../lib/calendar";
import { habitWeekProgress, isHabitScheduled } from "../../services/routines";
import {
  confirmSuggestions,
  habitSuggestions,
  logHabit,
  setHabitStatus,
} from "../../repositories/routines";
import { DataState, Status, useAction } from "../../components/RoutineUI";
import { HabitForm } from "./HabitForm";
import type { Habit } from "./models";
export default function HabitsPage() {
  const data = useRoutines();
  const action = useAction();
  const [editor, setEditor] = useState<Habit | "new">();
  const [showArchived, setShowArchived] = useState(false);
  const [suggestions, setSuggestions] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [historyId, setHistoryId] = useState<string>();
  const today = useLocalToday();
  const [date, setDate] = useState(today);
  return (
    <>
      <p className="eyebrow">CONSTÂNCIA COM GENTILEZA</p>
      <h1>Hábitos</h1>
      <p className="muted">Cuide da sua rotina, um gesto de cada vez.</p>
      <div className="quick-grid">
        <Link className="quick-card" to="/habitos/check-in">
          <ClipboardCheck />
          <strong>Fazer check-in</strong>
          <span>Seu momento de pausa</span>
        </Link>
        <Link className="quick-card" to="/habitos/calendario">
          <CalendarDays />
          <strong>Meu calendário</strong>
          <span>Histórico, dia a dia</span>
        </Link>
        <Link className="quick-card" to="/habitos/tarefas">
          <Sprout />
          <strong>Minhas tarefas</strong>
          <span>Organize os próximos passos</span>
        </Link>
      </div>
      <div className="sub-links">
        <Link to="/mais/relatorios">
          Ver minha evolução <ArrowUpRight size={14} />
        </Link>
        <Link to="/habitos/acompanhamento">
          Meu acompanhamento pessoal <ArrowUpRight size={14} />
        </Link>
      </div>
      <DataState data={data}>
        <div className="section-title">
          <h2>Minha rotina</h2>
          <button
            onClick={() => {
              setEditor("new");
            }}
          >
            Novo hábito
          </button>
        </div>
        <Status message={action.message} />
        {editor && (
          <HabitForm
            key={editor === "new" ? "new" : `${editor.id}:${editor.revision}`}
            habit={editor === "new" ? undefined : editor}
            onSaved={() => {
              setEditor(undefined);
              void action.run(
                async () => undefined,
                "Hábito salvo neste dispositivo.",
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
        <div className="toolbar">
          <label>
            Dia da rotina
            <input
              type="date"
              max={today}
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Mostrar arquivados
          </label>
        </div>
        <div className="routine-list">
          {data?.habits
            .filter((h) => showArchived || h.status === "active")
            .map((h) => {
              const done = data.habitLogs.find(
                (l) => l.habitId === h.id && l.date === date,
              )?.completed;
              const progress = habitWeekProgress(
                h,
                data.habitLogs,
                weekStart(date),
                date,
              );
              return (
                <article className="routine-card" key={h.id}>
                  <div className="routine-card-top">
                    <div>
                      <span className="eyebrow">
                        {h.category}{" "}
                        {h.status === "archived" ? "· Arquivado" : ""}
                      </span>
                      <h3>{h.name}</h3>
                      <p className="muted small">{h.description}</p>
                    </div>
                    <span className="pill">
                      {progress.completed}/{progress.target} dias na semana
                    </span>
                  </div>
                  <p className="muted small">
                    {h.frequency}× por semana · {h.duration} min sugeridos ·{" "}
                    {h.preferredDays.length
                      ? h.preferredDays.map((d) => weekdays[d]).join(", ")
                      : "Agenda distribuída"}{" "}
                    ·{" "}
                    {isHabitScheduled(h, date)
                      ? `Programado para ${weekdays[dayOfWeek(date)]}`
                      : "Sem programação neste dia"}
                  </p>
                  <div className="actions">
                    {h.status === "active" && date >= h.startDate && (
                      <button
                        disabled={action.busy}
                        className={done ? "completed-button" : "primary"}
                        onClick={() =>
                          void action.run(
                            () =>
                              logHabit(
                                h.id,
                                date,
                                !done,
                                !done ? h.duration : 0,
                              ),
                            done
                              ? "Conclusão desmarcada. Histórico preservado."
                              : "Hábito concluído neste dia.",
                          )
                        }
                      >
                        {done ? "✓ Concluído · desfazer" : "Concluir neste dia"}
                      </button>
                    )}
                    <button onClick={() => setEditor(h)}>Editar</button>
                    <button
                      disabled={action.busy}
                      onClick={() =>
                        void action.run(
                          () =>
                            setHabitStatus(
                              h.id,
                              h.status === "active" ? "archived" : "active",
                            ),
                          h.status === "active"
                            ? "Hábito arquivado. Seu histórico foi preservado."
                            : "Hábito reativado.",
                        )
                      }
                    >
                      {h.status === "active" ? "Arquivar" : "Reativar"}
                    </button>
                    <button
                      onClick={() =>
                        setHistoryId(historyId === h.id ? undefined : h.id)
                      }
                    >
                      Histórico
                    </button>
                  </div>
                  {historyId === h.id && (
                    <div className="history-list">
                      <h4>Registros deste hábito</h4>
                      {data.habitLogs
                        .filter((l) => l.habitId === h.id)
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .map((l) => (
                          <p key={l.date}>
                            {dateLabel(l.date)} ·{" "}
                            {l.completed ? "Concluído" : "Conclusão desmarcada"}{" "}
                            · {l.minutes} min de referência
                          </p>
                        ))}
                      {!data.habitLogs.some((l) => l.habitId === h.id) && (
                        <p>Nenhuma conclusão registrada.</p>
                      )}
                      <h4>Alterações</h4>
                      {data.events
                        .filter(
                          (e) => e.entity === "habit" && e.entityId === h.id,
                        )
                        .slice(0, 20)
                        .map((e) => (
                          <p key={e.id}>
                            {dateLabel(e.date)} · {eventLabel(e.action)}
                          </p>
                        ))}
                    </div>
                  )}
                </article>
              );
            })}
        </div>
        {!data?.habits.some((h) => showArchived || h.status === "active") && (
          <section className="empty">
            <Sprout size={40} />
            <h2>Um pequeno hábito já é um começo.</h2>
            <p>Crie o seu ou escolha sugestões para adaptar ao seu ritmo.</p>
          </section>
        )}
        <section className="panel suggestions">
          <h2>Algumas ideias para começar</h2>
          <p className="muted">
            Você escolhe o que faz sentido. Nada será cadastrado sem sua
            confirmação.
          </p>
          <button onClick={() => setSuggestions(!suggestions)}>
            {suggestions ? "Fechar sugestões" : "Escolher sugestões"}
          </button>
          {suggestions && (
            <>
              <div className="suggestion-options">
                {habitSuggestions.map((h) => (
                  <label className="check" key={h.id}>
                    <input
                      type="checkbox"
                      checked={selected.includes(h.id)}
                      disabled={data?.habits.some(
                        (existing) => existing.id === h.id,
                      )}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, h.id]
                            : selected.filter((id) => id !== h.id),
                        )
                      }
                    />
                    <span>
                      {h.name} · {h.frequency}×/semana
                      {data?.habits.some((existing) => existing.id === h.id)
                        ? " · Já adicionado"
                        : ""}
                    </span>
                  </label>
                ))}
              </div>
              <button
                className="primary"
                disabled={!selected.length || action.busy}
                onClick={() =>
                  void action.run(async () => {
                    await confirmSuggestions(selected);
                    setSelected([]);
                  }, "Sugestões confirmadas. Hábitos anteriores foram mantidos.")
                }
              >
                Confirmar sugestões
              </button>
            </>
          )}
        </section>
      </DataState>
    </>
  );
}

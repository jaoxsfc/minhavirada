import { useState } from "react";
import { Link } from "react-router-dom";
import { useRoutines } from "../../hooks/useRoutines";
import { useProfile } from "../../hooks/useProfile";
import { localDate } from "../../lib/date";
import { monthShift, dateLabel, dayOfWeek, weekdays } from "../../lib/calendar";
import {
  calendarDays,
  isHabitScheduled,
  taskOccurrences,
} from "../../services/routines";
import { moodLabels } from "./models";
import { DataState } from "../../components/RoutineUI";
export default function CalendarPage() {
  const data = useRoutines();
  const profile = useProfile()?.profile;
  const [month, setMonth] = useState(localDate().slice(0, 7));
  const [selected, setSelected] = useState(localDate());
  const changeMonth = (value: string) => {
    if (value) {
      setMonth(value);
      setSelected(
        value === localDate().slice(0, 7) ? localDate() : `${value}-01`,
      );
    }
  };
  const days = calendarDays(month, data?.checkIns ?? []);
  const entry = data?.checkIns.find((c) => c.date === selected);
  const sensitive = profile?.hideSensitive === false;
  return (
    <>
      <Link className="text-link" to="/habitos">
        ← Hábitos e rotina
      </Link>
      <p className="eyebrow">CADA DIA TEM SUA HISTÓRIA</p>
      <h1>Meu calendário.</h1>
      <DataState data={data}>
        <section className="panel">
          <div className="calendar-heading">
            <button
              aria-label="Mês anterior"
              onClick={() => changeMonth(monthShift(month, -1))}
            >
              ←
            </button>
            <label>
              Mês do calendário
              <input
                type="month"
                value={month}
                onChange={(e) => changeMonth(e.target.value)}
              />
            </label>
            <button
              aria-label="Próximo mês"
              onClick={() => changeMonth(monthShift(month, 1))}
            >
              →
            </button>
          </div>
          <div className="calendar-grid" role="group" aria-label="Dias do mês">
            {weekdays.map((d) => (
              <span className="weekday" key={d}>
                {d}
              </span>
            ))}
            {Array.from({ length: dayOfWeek(`${month}-01`) }, (_, i) => (
              <span key={`empty-${i}`} />
            ))}
            {days.map((day) => (
              <button
                key={day.date}
                aria-pressed={selected === day.date}
                className={`calendar-day ${day.registered ? "registered" : ""} ${day.active ? "has-activity" : ""} ${selected === day.date ? "selected" : ""}`}
                aria-label={`${day.date}: ${day.registered ? "registrado" : "sem registro"}${day.active ? ", com atividade" : ""}`}
                onClick={() => setSelected(day.date)}
              >
                <span>{Number(day.date.slice(-2))}</span>
                <span aria-hidden="true" className="day-mark">
                  {day.active ? "●" : day.registered ? "✓" : "·"}
                </span>
              </button>
            ))}
          </div>
          <p className="calendar-legend">
            <span>✓ Com registro</span>
            <span>● Com atividade</span>
            <span>· Sem registro</span>
          </p>
        </section>
        <section className="panel" aria-label="Detalhes do dia">
          <p className="eyebrow">
            {dateLabel(selected)} · {selected.slice(0, 4)}
          </p>
          <h2>{entry ? "Um dia registrado" : "Sem check-in neste dia"}</h2>
          {entry ? (
            <>
              <div className="stats-inline">
                <span>
                  Humor: <strong>{moodLabels[entry.mood - 1]}</strong>
                </span>
                <span>
                  Energia: <strong>{entry.energy}/5</strong>
                </span>
                <span>
                  Atividade: <strong>{entry.activityMinutes} min</strong>
                </span>
                <span>
                  Projetos: <strong>{entry.projectMinutes} min</strong>
                </span>
              </div>
              {sensitive && (
                <p data-testid="calendar-sensitive">
                  {entry.consumed ? "Com consumo" : "Sem consumo"} · Vontade{" "}
                  {entry.craving}/5
                  {entry.triggers ? ` · Gatilhos: ${entry.triggers}` : ""}
                </p>
              )}
              <details>
                <summary>Observações pessoais</summary>
                <p className="preserve-text">
                  {entry.notes || "Nenhuma observação."}
                </p>
              </details>
            </>
          ) : (
            <p className="muted">
              Ausência de registro não indica ausência de consumo ou de
              atividade. Nenhum resultado foi inferido.
            </p>
          )}
          {selected <= localDate() && (
            <Link
              className="text-link"
              to={`/habitos/check-in?date=${selected}`}
            >
              {entry ? "Editar check-in" : "Registrar este dia"} →
            </Link>
          )}
          <div className="day-routine">
            <h3>Rotina do dia</h3>
            {data?.habits
              .filter(
                (h) =>
                  isHabitScheduled(h, selected) ||
                  data.habitLogs.some(
                    (l) => l.habitId === h.id && l.date === selected,
                  ),
              )
              .map((h) => (
                <p key={h.id}>
                  {data.habitLogs.find(
                    (l) => l.habitId === h.id && l.date === selected,
                  )?.completed
                    ? "✓"
                    : "○"}{" "}
                  {h.name}
                </p>
              ))}
            {data &&
              taskOccurrences(
                data.tasks,
                data.taskRecords,
                selected,
                selected,
              ).map((o) => (
                <p key={`${o.task.id}:${o.scheduledDate}`}>
                  {o.status === "done" ? "✓" : "○"} {o.task.title}
                </p>
              ))}
          </div>
        </section>
      </DataState>
    </>
  );
}

import { useState } from "react";
import { useLocalToday } from "../../hooks/useLocalToday";
import { dueRows } from "../../services/finance/views";
import {
  dateRange,
  dayOfWeek,
  weekdays,
  monthRange,
  dateLabel,
} from "../../lib/calendar";
import { money } from "../../lib/date";
import type { FinancePanelProps } from "./shared";
export default function FinanceCalendar({ data, onOpen }: FinancePanelProps) {
  const today = useLocalToday();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [date, setDate] = useState(today);
  const range = monthRange(month);
  const rows = dueRows(data);
  return (
    <>
      <h2>Calendário de vencimentos</h2>
      <section className="panel">
        <label className="date-control">
          Mês dos vencimentos
          <input
            type="month"
            value={month}
            onChange={(e) => {
              if (e.target.value) {
                setMonth(e.target.value);
                setDate(e.target.value + "-01");
              }
            }}
          />
        </label>
        <div
          className="calendar-grid"
          role="group"
          aria-label="Vencimentos do mês"
        >
          {weekdays.map((d) => (
            <span className="weekday" key={d}>
              {d}
            </span>
          ))}
          {Array.from({ length: dayOfWeek(range.from) }, (_, i) => (
            <span key={i} />
          ))}
          {dateRange(range.from, range.to).map((day) => (
            <button
              key={day}
              aria-pressed={day === date}
              className={`calendar-day ${rows.some((r) => r.date === day) ? "registered" : ""} ${day === date ? "selected" : ""}`}
              aria-label={`${day}: ${rows.filter((r) => r.date === day).length} vencimentos`}
              onClick={() => setDate(day)}
            >
              {Number(day.slice(-2))}
              <span className="day-mark">
                {rows.some((r) => r.date === day) ? "●" : "·"}
              </span>
            </button>
          ))}
        </div>
        <h3>{dateLabel(date)}</h3>
        {rows
          .filter((r) => r.date === date)
          .map((r) => (
            <div className="overview-row" key={r.id}>
              <div>
                <strong>{r.title}</strong>
                <p className="muted small">
                  {r.kind === "income" ? "Receita" : "Despesa"} ·{" "}
                  {r.remaining > 0
                    ? money(r.remaining) + " pendente"
                    : "Quitado"}
                </p>
              </div>
              {r.remaining > 0 && (
                <button
                  onClick={() =>
                    onOpen({
                      mode: "payment",
                      targetType: r.type,
                      targetId: r.id,
                    })
                  }
                >
                  {r.kind === "income" ? "Receber" : "Pagar"}
                </button>
              )}
            </div>
          ))}
        {!rows.some((r) => r.date === date) && (
          <p className="muted small">Nenhum vencimento cadastrado neste dia.</p>
        )}
      </section>
    </>
  );
}

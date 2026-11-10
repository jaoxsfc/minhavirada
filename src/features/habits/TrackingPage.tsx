import { useState } from "react";
import { Link } from "react-router-dom";
import { useRoutines } from "../../hooks/useRoutines";
import { useLocalToday } from "../../hooks/useLocalToday";
import { dateLabel, shiftDate } from "../../lib/calendar";
import { consumptionSummary, trackingWeeks } from "../../services/routines";
import { addAttempt } from "../../repositories/routines";
import { DataState, Status, useAction } from "../../components/RoutineUI";
export default function TrackingPage() {
  const today = useLocalToday();
  const data = useRoutines();
  const [start, setStart] = useState(today);
  const [selected, setSelected] = useState("");
  const action = useAction();
  const attempt =
    data?.attempts.find((a) => a.id === selected) ?? data?.attempts.at(-1);
  const summary = attempt
    ? consumptionSummary(data?.checkIns ?? [], attempt.startDate, today)
    : undefined;
  const [showHistory, setShowHistory] = useState(false);
  return (
    <>
      <Link className="text-link" to="/habitos">
        ← Hábitos e rotina
      </Link>
      <p className="eyebrow">UM ESPAÇO DISCRETO, SÓ SEU</p>
      <h1>Meu acompanhamento.</h1>
      <p className="muted">
        Cada registro ajuda a perceber seu caminho. Recomeçar faz parte dele.
      </p>
      <DataState data={data}>
        <section className="panel">
          <h2>
            {attempt
              ? "Uma nova etapa, sem apagar o caminho"
              : "Quando você quer começar?"}
          </h2>
          <p className="muted small">
            A data inicial define o período de acompanhamento. Uma nova etapa
            preserva todos os check-ins e etapas anteriores.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action.run(
                () => addAttempt(start),
                "Início registrado. Seu histórico foi preservado.",
              );
            }}
          >
            <label className="date-control">
              Data inicial
              <input
                type="date"
                required
                max={today}
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <button className="primary" disabled={action.busy}>
              Registrar início / nova etapa
            </button>
          </form>
          <Status message={action.message} />
        </section>
        {attempt && summary && (
          <>
            <label className="date-control">
              Período de acompanhamento
              <select
                value={attempt.id}
                onChange={(e) => setSelected(e.target.value)}
              >
                {data?.attempts.map((a) => (
                  <option key={a.id} value={a.id}>
                    Desde {dateLabel(a.startDate)} · {a.startDate.slice(0, 4)}
                  </option>
                ))}
              </select>
            </label>
            <div className="stats-grid">
              <article className="stat">
                <span>Sequência confirmada</span>
                <strong>{summary.streak}</strong>
                <p>
                  dias consecutivos sem consumo
                  {summary.through
                    ? ` · até ${dateLabel(summary.through)}`
                    : ""}
                </p>
              </article>
              <article className="stat">
                <span>Dias sem consumo</span>
                <strong>{summary.confirmed}</strong>
                <p>confirmados no período</p>
              </article>
              <article className="stat">
                <span>Dias sem registro</span>
                <strong>{summary.missing}</strong>
                <p>não entram na contagem</p>
              </article>
            </div>
            <p className="muted small">
              A sequência termina no último dia confirmado (hoje ou ontem).
              Lacunas e dias com consumo interrompem a sequência, sem apagar
              conquistas anteriores.
            </p>
            <section className="panel">
              <h2>Semanas do período</h2>
              {trackingWeeks(attempt.startDate, today).map((week) => {
                const end = shiftDate(week, 6);
                const entries = data!.checkIns.filter(
                  (c) =>
                    c.date >= week &&
                    c.date <= end &&
                    c.date >= attempt.startDate,
                );
                return (
                  <div className="week-row" key={week}>
                    <span>
                      {dateLabel(week)} — {dateLabel(end)}
                    </span>
                    <strong>
                      {entries.filter((c) => !c.consumed).length} sem consumo
                    </strong>
                    <span>
                      {entries.length} registros · vontade média{" "}
                      {entries.length
                        ? (
                            entries.reduce((n, c) => n + c.craving, 0) /
                            entries.length
                          ).toFixed(1)
                        : "—"}
                    </span>
                  </div>
                );
              })}
              <p className="muted small">
                Até 8 semanas recentes. Médias usam apenas dias registrados.
              </p>
            </section>
          </>
        )}
        <section className="panel">
          <div className="section-title">
            <h2>Meu histórico de registros</h2>
            <button onClick={() => setShowHistory(!showHistory)}>
              {showHistory ? "Recolher histórico" : "Ver registros"}
            </button>
          </div>
          {showHistory && (
            <div className="history-list">
              {data?.checkIns
                .filter((c) => !attempt || c.date >= attempt.startDate)
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((c) => (
                  <article key={c.date}>
                    <Link
                      className="text-link"
                      to={`/habitos/check-in?date=${c.date}`}
                    >
                      {dateLabel(c.date)} ·{" "}
                      {c.consumed ? "Com consumo" : "Sem consumo"} →
                    </Link>
                    <p>
                      Vontade: {c.craving}/5
                      {c.triggers ? ` · Gatilhos: ${c.triggers}` : ""}
                    </p>
                  </article>
                ))}
              {!data?.checkIns.length && (
                <p>
                  Nenhum check-in registrado. Não inferimos resultados para dias
                  vazios.
                </p>
              )}
            </div>
          )}
        </section>
        <details className="panel">
          <summary>Quando quiser apoio</summary>
          <p>
            Se sentir necessidade, conversar com um profissional de saúde pode
            ajudar. Este espaço não oferece diagnóstico ou tratamento. Você
            escolhe o que quer registrar.
          </p>
        </details>
      </DataState>
    </>
  );
}

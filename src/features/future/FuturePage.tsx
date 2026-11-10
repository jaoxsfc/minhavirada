import { useConfirmDiscard } from "../../components/EditingGuard";
import { useLocalToday } from "../../hooks/useLocalToday";
import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useFuture } from "../../hooks/useFuture";
import { DataState, Status, useAction } from "../../components/RoutineUI";
import { FutureForm } from "./FutureForm";
import { goalFields, projectFields } from "./form-fields";
import { goalSchema, projectSchema, stageLabels } from "./models";
import {
  confirmGoalSuggestion,
  goalSuggestions,
  newGoal,
  newProject,
  saveGoal,
  saveProject,
} from "../../repositories/future";
import {
  goalProgress,
  opportunitySummary,
} from "../../services/future-calculations";
import { money } from "../../lib/date";
import { GoalDetails } from "./GoalDetails";
import { ProjectDetails } from "./ProjectDetails";
import { FutureOverview } from "./FutureOverview";
export default function FuturePage() {
  const discard = useConfirmDiscard();
  const today = useLocalToday();
  const result = useFuture(),
    action = useAction(),
    path = useLocation().pathname;
  const projects = path === "/mais/renda",
    overview = path === "/metas" || path === "/metas/";
  const [selection, setSelection] = useState<string>();
  const [adding, setAdding] = useState(false),
    [filter, setFilter] = useState("active");
  const [stage, setStage] = useState("all");
  const data = result?.future,
    finance = result?.finance;
  const goal = data?.goals.find((g) => g.id === selection),
    project = data?.projects.find((p) => p.id === selection);
  const summary =
    data && finance ? opportunitySummary(data, finance) : undefined;
  return (
    <>
      <p className="eyebrow">PLANOS COM ESPAÇO PARA A VIDA</p>
      <h1>{projects ? "Renda extra." : "Meu futuro."}</h1>
      <p className="muted">
        {projects
          ? "Suas ideias, próximos passos e resultados reais."
          : "Uma conquista de cada vez, no seu ritmo."}
      </p>
      <nav className="finance-nav future-nav" aria-label="Metas e projetos">
        <NavLink to="/metas" end>
          Meu futuro
        </NavLink>
        <NavLink to="/metas/objetivos">Minhas metas</NavLink>
        <NavLink to="/mais/renda">Renda extra</NavLink>
      </nav>
      <DataState data={result}>
        <Status message={action.message} />
        {data && finance && (
          <>
            {overview && (
              <FutureOverview
                data={data}
                finance={finance}
                tasks={result?.tasks ?? []}
                records={result?.taskRecords ?? []}
              />
            )}
            {projects && summary && (
              <>
                <div className="future-metrics panel">
                  <div>
                    <span>Oportunidades abertas</span>
                    <strong>{summary.open}</strong>
                  </div>
                  <div>
                    <span>Propostas enviadas</span>
                    <strong>{summary.proposals}</strong>
                  </div>
                  <div>
                    <span>Projetos contratados/em execução</span>
                    <strong>{summary.contracted}</strong>
                  </div>
                  <div>
                    <span>Receita prevista restante</span>
                    <strong>{money(summary.forecast)}</strong>
                  </div>
                  <div>
                    <span>Receita recebida · todo histórico</span>
                    <strong>{money(summary.received)}</strong>
                  </div>
                  <div>
                    <span>Custos pagos · todo histórico</span>
                    <strong>{money(summary.costs)}</strong>
                  </div>
                  <div>
                    <span>Resultado líquido de caixa · histórico</span>
                    <strong>
                      {summary.net === null
                        ? "Confirme a cobertura dos custos"
                        : money(summary.net)}
                    </strong>
                  </div>
                  <div>
                    <span>Tempo registrado · histórico</span>
                    <strong>
                      {(summary.minutes / 60).toLocaleString("pt-BR", {
                        maximumFractionDigits: 2,
                      })}{" "}
                      h
                    </strong>
                  </div>
                  <div>
                    <span>Receita recebida por hora · histórico</span>
                    <strong>
                      {summary.hourly === null
                        ? "Confirme o tempo completo"
                        : money(summary.hourly) + "/h"}
                    </strong>
                  </div>
                </div>
                <p className="muted small">
                  Previsão exclui oportunidades perdidas, canceladas e
                  arquivadas; valores recebidos e custos preservam todo o
                  histórico.{" "}
                  {summary.unknownForecast
                    ? "Há oportunidades com valores ainda desconhecidos."
                    : ""}{" "}
                  Previsões não entram no banco nem na reserva.
                </p>
              </>
            )}
            <div className="section-title">
              <h2>{projects ? "Ideias em movimento" : "Seus objetivos"}</h2>
              <button
                className="primary"
                onClick={() =>
                  discard(() => {
                    setAdding(true);
                    setSelection(undefined);
                  })
                }
              >
                {projects ? "Novo projeto" : "Nova meta"}
              </button>
            </div>
            {adding &&
              (projects ? (
                <FutureForm
                  key="project"
                  title="Novo projeto"
                  fields={projectFields}
                  initial={newProject()}
                  onSave={(v, op) => saveProject(projectSchema.parse(v), op)}
                  onSaved={() =>
                    void action.run(
                      async () => undefined,
                      projects
                        ? "Projeto salvo neste dispositivo."
                        : "Meta salva neste dispositivo.",
                    )
                  }
                  onCancel={() => setAdding(false)}
                />
              ) : (
                <FutureForm
                  key="goal"
                  title="Nova meta"
                  fields={goalFields}
                  initial={newGoal()}
                  onSave={(v, op) => saveGoal(goalSchema.parse(v), op)}
                  onSaved={() =>
                    void action.run(
                      async () => undefined,
                      projects
                        ? "Projeto salvo neste dispositivo."
                        : "Meta salva neste dispositivo.",
                    )
                  }
                  onCancel={() => setAdding(false)}
                />
              ))}
            <div className="actions future-filters">
              <label>
                Exibir
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="active">Em andamento</option>
                  <option value="all">Todo o histórico</option>
                  <option value="archived">Arquivados</option>
                </select>
              </label>
              {projects && (
                <label>
                  Etapa do projeto
                  <select
                    value={stage}
                    onChange={(e) => setStage(e.target.value)}
                  >
                    <option value="all">Todas as etapas</option>
                    {Object.entries(stageLabels).map(([key, label]) => (
                      <option value={key} key={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div className="future-grid">
              {projects
                ? data.projects
                    .filter(
                      (p) =>
                        (filter === "all" ||
                          p.archived === (filter === "archived")) &&
                        (stage === "all" || p.stage === stage),
                    )
                    .map((p) => (
                      <button
                        className="future-tile"
                        key={p.id}
                        aria-pressed={selection === p.id}
                        onClick={() =>
                          discard(() => {
                            setSelection(p.id);
                            setAdding(false);
                          })
                        }
                      >
                        <span className="eyebrow">{stageLabels[p.stage]}</span>
                        <strong>{p.service}</strong>
                        <span className="muted small">
                          {p.client || "Cliente em aberto"}
                        </span>
                        <span className="text-link">Acompanhar projeto →</span>
                      </button>
                    ))
                : data.goals
                    .filter(
                      (g) =>
                        filter === "all" ||
                        g.status ===
                          (filter === "archived" ? "archived" : "active"),
                    )
                    .map((g) => {
                      const progress = goalProgress(g, data, today);
                      return (
                        <button
                          className="future-tile"
                          key={g.id}
                          aria-pressed={selection === g.id}
                          onClick={() =>
                            discard(() => {
                              setSelection(g.id);
                              setAdding(false);
                            })
                          }
                        >
                          <span className="eyebrow">{g.category}</span>
                          <strong>{g.title}</strong>
                          {progress.percent !== null ? (
                            <>
                              <progress
                                max={100}
                                value={progress.percent}
                                aria-label={"Progresso de " + g.title}
                              />
                              <span>
                                {Math.round(progress.percent)}% do objetivo
                              </span>
                            </>
                          ) : (
                            <span className="muted small">
                              Planejamento em aberto
                            </span>
                          )}
                          <span className="text-link">Acompanhar meta →</span>
                        </button>
                      );
                    })}
            </div>
            {(projects
              ? data.projects.length > 0 &&
                !data.projects.some(
                  (p) =>
                    (filter === "all" ||
                      p.archived === (filter === "archived")) &&
                    (stage === "all" || p.stage === stage),
                )
              : data.goals.length > 0 &&
                !data.goals.some(
                  (g) =>
                    filter === "all" ||
                    g.status ===
                      (filter === "archived" ? "archived" : "active"),
                )) && (
              <section className="empty">
                <h2>Nenhum resultado neste filtro.</h2>
                <p>
                  Seu histórico continua guardado. Experimente exibir todo o
                  histórico.
                </p>
                <button
                  onClick={() => {
                    setFilter("all");
                    setStage("all");
                  }}
                >
                  Mostrar todo o histórico
                </button>
              </section>
            )}
            {!(projects ? data.projects : data.goals).length && (
              <section className="empty">
                <h2>
                  {projects
                    ? "Uma ideia pode ser seu próximo começo."
                    : "O que você quer construir?"}
                </h2>
                <p>
                  {projects
                    ? "Registre uma oportunidade. Só recebimentos confirmados movimentam seu dinheiro."
                    : "Crie um objetivo ou escolha uma sugestão abaixo. Nenhum dinheiro será movimentado."}
                </p>
              </section>
            )}
            {!projects && goal && (
              <GoalDetails
                key={goal.id}
                goal={goal}
                data={data}
                finance={finance}
              />
            )}
            {projects && project && (
              <ProjectDetails
                key={project.id}
                project={project}
                data={data}
                finance={finance}
              />
            )}
            {!projects && (
              <details className="panel">
                <summary>Ideias para começar · você escolhe</summary>
                <p className="muted small">
                  Confirme apenas o que fizer sentido. Depois, ajuste título,
                  valor, datas e marcos. Casamento e moradia começam sem
                  valor-alvo ou prazo presumidos.
                </p>
                <div className="future-grid">
                  {goalSuggestions.map((s) => (
                    <article className="future-suggestion" key={s.key}>
                      <h3>{s.title}</h3>
                      <p className="muted small">
                        {s.target
                          ? money(s.target) + " · valor ajustável"
                          : "Valores e prazos em aberto"}
                      </p>
                      <button
                        disabled={
                          action.busy ||
                          data.goals.some((g) => g.suggestionKey === s.key)
                        }
                        onClick={() =>
                          void action.run(async () => {
                            setSelection(await confirmGoalSuggestion(s.key));
                          }, "Sugestão confirmada. Personalize ao seu momento.")
                        }
                      >
                        {data.goals.some((g) => g.suggestionKey === s.key)
                          ? "Já adicionada"
                          : "Adicionar sugestão"}
                      </button>
                    </article>
                  ))}
                </div>
              </details>
            )}
          </>
        )}
      </DataState>
    </>
  );
}

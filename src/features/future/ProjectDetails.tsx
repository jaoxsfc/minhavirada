import { Link } from "react-router-dom";
import { useState } from "react";
import type { FutureData, Project, ProjectTime } from "./models";
import type { FinanceData } from "../finance/models";
import { projectSchema, stageLabels, timeSchema } from "./models";
import { FutureForm, type FutureField, type Values } from "./FutureForm";
import { projectFields } from "./form-fields";
import {
  postProject,
  postingSchema,
  saveProject,
  saveTime,
} from "../../repositories/future";
import { projectMetrics } from "../../services/future-calculations";
import { now, uuid } from "../../services/finance/transaction";
import { reversePayment } from "../../services/finance/commands";
import { localDate, money } from "../../lib/date";
import { dateLabel } from "../../lib/calendar";
import { Status, useAction } from "../../components/RoutineUI";
import { LinkedTasks } from "./LinkedTasks";
export function ProjectDetails({
  project,
  data,
  finance,
}: {
  project: Project;
  data: FutureData;
  finance: FinanceData;
}) {
  const action = useAction(),
    metrics = projectMetrics(project.id, data, finance);
  const [editor, setEditor] = useState<{
    title: string;
    fields: FutureField[];
    initial: Values;
    save: (v: Values, op: string) => Promise<unknown>;
  }>();
  const [reverseId, setReverseId] = useState<string>();
  const hasBank = finance.accounts.some(
    (a) => a.type !== "benefit" && a.status === "active",
  );
  const hasCategory = (kind: "income" | "expense") =>
    finance.categories.some(
      (c) => c.status === "active" && (c.kind === kind || c.kind === "both"),
    );
  function edit() {
    setEditor({
      title: "Editar projeto",
      fields: projectFields,
      initial: project,
      save: (v, op) =>
        saveProject(
          projectSchema.parse({
            ...v,
            revision: project.revision + 1,
            updatedAt: now(),
          }),
          op,
        ),
    });
  }
  function posting(kind: "income" | "expense") {
    setEditor({
      title:
        kind === "income"
          ? "Confirmar recebimento parcial"
          : "Registrar custo realizado",
      fields: [
        { key: "description", label: "Descrição do movimento", required: true },
        {
          key: "amount",
          label: "Valor efetivamente movimentado (R$)",
          type: "money",
          required: true,
        },
        { key: "date", label: "Data efetiva", type: "date", required: true },
        {
          key: "accountId",
          label: "Conta bancária",
          type: "select",
          required: true,
          options: [
            { value: "", label: "Selecione" },
            ...finance.accounts
              .filter((a) => a.type !== "benefit" && a.status === "active")
              .map((a) => ({ value: a.id, label: a.name })),
          ],
        },
        {
          key: "categoryId",
          label: "Categoria financeira",
          type: "select",
          required: true,
          options: [
            { value: "", label: "Selecione" },
            ...finance.categories
              .filter(
                (c) =>
                  c.status === "active" &&
                  (c.kind === kind || c.kind === "both"),
              )
              .map((c) => ({ value: c.id, label: c.name })),
          ],
        },
      ],
      initial: {
        id: uuid(),
        projectId: project.id,
        kind,
        description: project.service,
        amount: null,
        date: localDate(),
        accountId: "",
        categoryId: "",
        entryId: uuid(),
        paymentId: uuid(),
      },
      save: (v, op) => postProject(postingSchema.parse(v), op),
    });
  }
  function time(t?: ProjectTime) {
    setEditor({
      title: t ? "Editar tempo dedicado" : "Registrar tempo dedicado",
      fields: [
        {
          key: "date",
          label: "Data do trabalho",
          type: "date",
          required: true,
        },
        {
          key: "minutes",
          label: "Minutos dedicados",
          type: "number",
          max: 1440,
          required: true,
        },
        { key: "notes", label: "Atividade realizada", type: "textarea" },
      ],
      initial: t ?? {
        id: uuid(),
        projectId: project.id,
        date: localDate(),
        minutes: 30,
        notes: "",
        revision: 1,
        createdAt: now(),
        updatedAt: now(),
      },
      save: (v, op) =>
        saveTime(
          timeSchema.parse({
            ...v,
            revision: (t?.revision ?? 0) + 1,
            updatedAt: now(),
          }),
          op,
        ),
    });
  }
  return (
    <section className="future-detail" aria-label="Detalhes do projeto">
      <div className="section-title">
        <div>
          <p className="eyebrow">
            {stageLabels[project.stage]}
            {project.archived ? " · Arquivado" : ""}
          </p>
          <h2>{project.service}</h2>
        </div>
        <button onClick={edit}>Editar projeto</button>
      </div>
      <p className="muted">
        {project.client || "Cliente ou origem em aberto"} · {project.category}
      </p>
      <p>{project.description}</p>
      <div className="future-metrics">
        <div>
          <span>Estimado · previsão</span>
          <strong>
            {project.estimated === null
              ? "A definir"
              : money(project.estimated)}
          </strong>
        </div>
        <div>
          <span>Contratado · previsão</span>
          <strong>
            {project.contracted === null
              ? "A definir"
              : money(project.contracted)}
          </strong>
        </div>
        <div>
          <span>Custos previstos</span>
          <strong>
            {project.forecastCosts === null
              ? "A definir"
              : money(project.forecastCosts)}
          </strong>
        </div>
        <div>
          <span>Recebido de verdade</span>
          <strong data-testid="project-received">
            {money(metrics.received)}
          </strong>
        </div>
        <div>
          <span>Custos pagos registrados</span>
          <strong data-testid="project-costs">{money(metrics.costs)}</strong>
        </div>
        <div>
          <span>Resultado líquido de caixa até agora</span>
          <strong data-testid="project-net">
            {metrics.net === null
              ? "Confirme a cobertura dos custos"
              : money(metrics.net)}
          </strong>
        </div>
        <div>
          <span>Tempo registrado</span>
          <strong>
            {(metrics.minutes / 60).toLocaleString("pt-BR", {
              maximumFractionDigits: 2,
            })}{" "}
            h
          </strong>
        </div>
        <div>
          <span>Receita recebida por hora</span>
          <strong>
            {metrics.hourly === null
              ? "Confirme o tempo completo"
              : money(metrics.hourly) + "/h"}
          </strong>
        </div>
      </div>
      <p className="muted small">
        Valores negociados não alteram o banco. Indicadores de caixa não incluem
        custos ainda não pagos; tempo e custos só são considerados completos
        após sua confirmação na edição do projeto.
      </p>
      <p>
        <strong>Próxima ação:</strong>{" "}
        {project.nextAction || "Escolha um pequeno próximo passo."}
      </p>
      <p className="small">
        {project.deadline
          ? "Prazo " + dateLabel(project.deadline)
          : "Prazo em aberto"}
      </p>
      <Status message={action.message} />
      <div className="actions">
        <button
          className="primary"
          disabled={project.archived || !hasBank || !hasCategory("income")}
          onClick={() => posting("income")}
        >
          Registrar recebimento
        </button>
        <button
          disabled={project.archived || !hasBank || !hasCategory("expense")}
          onClick={() => posting("expense")}
        >
          Registrar custo
        </button>
        <button onClick={() => time()}>Registrar tempo</button>
        <button
          disabled={action.busy}
          onClick={() =>
            void action.run(() =>
              saveProject(
                {
                  ...project,
                  archived: !project.archived,
                  revision: project.revision + 1,
                  updatedAt: now(),
                },
                uuid(),
              ),
            )
          }
        >
          {project.archived ? "Reativar projeto" : "Arquivar projeto"}
        </button>
      </div>
      {(!hasBank || !hasCategory("income") || !hasCategory("expense")) && (
        <p className="muted small">
          <Link className="text-link" to="/financas">
            Prepare contas e categorias em Finanças
          </Link>{" "}
          para confirmar recebimentos e custos reais.
        </p>
      )}
      {editor && (
        <FutureForm
          key={editor.initial.id as string}
          title={editor.title}
          fields={editor.fields}
          initial={editor.initial}
          onSave={editor.save}
          onSaved={() =>
            void action.run(
              async () => undefined,
              "Alteração salva neste dispositivo.",
            )
          }
          onCancel={() => setEditor(undefined)}
        />
      )}
      <LinkedTasks targetType="project" targetId={project.id} />
      <section className="panel">
        <h3>Recebimentos e custos · histórico</h3>
        {data.receipts
          .filter((r) => r.projectId === project.id)
          .map((r) => {
            const payment = finance.payments.find((p) => p.id === r.paymentId);
            return (
              payment && (
                <article className="manage-row" key={r.id}>
                  <div>
                    <strong>
                      {r.kind === "income" ? "Recebimento" : "Custo"} ·{" "}
                      {money(payment.amount)}
                    </strong>
                    <p className="muted small">
                      {dateLabel(payment.date)} ·{" "}
                      {payment.status === "reversed"
                        ? "Estornado"
                        : "Confirmado"}{" "}
                      ·{" "}
                      {
                        finance.accounts.find((a) => a.id === payment.accountId)
                          ?.name
                      }
                    </p>
                  </div>
                  {payment.status === "active" && (
                    <button
                      disabled={action.busy}
                      onClick={() => setReverseId(payment.id)}
                    >
                      Revisar estorno
                    </button>
                  )}
                </article>
              )
            );
          })}
        {!data.receipts.some((r) => r.projectId === project.id) && (
          <p className="muted">Nenhum movimento confirmado ainda.</p>
        )}
        {reverseId && (
          <div className="backup-warning">
            <p>
              O estorno desfaz o efeito deste pagamento no banco e nos
              indicadores. O histórico será mantido. Confirme apenas para
              corrigir um registro que não aconteceu.
            </p>
            <div className="actions">
              <button
                disabled={action.busy}
                onClick={() =>
                  void action.run(async () => {
                    await reversePayment(reverseId, uuid());
                    setReverseId(undefined);
                  }, "Pagamento estornado. Histórico mantido.")
                }
              >
                Confirmar estorno
              </button>
              <button onClick={() => setReverseId(undefined)}>
                Cancelar estorno
              </button>
            </div>
          </div>
        )}
      </section>
      <section className="panel">
        <h3>Tempo dedicado · histórico</h3>
        {data.timeEntries
          .filter((t) => t.projectId === project.id)
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((t) => (
            <article className="manage-row" key={t.id}>
              <div>
                <strong>
                  {t.minutes} min · {dateLabel(t.date)}
                </strong>
                <p className="muted small">{t.notes}</p>
              </div>
              <button onClick={() => time(t)}>Editar tempo</button>
            </article>
          ))}
        {!data.timeEntries.some((t) => t.projectId === project.id) && (
          <p className="muted">
            Registre os períodos dedicados para acompanhar o seu ritmo.
          </p>
        )}
      </section>
      {project.notes && <p className="note">{project.notes}</p>}
    </section>
  );
}

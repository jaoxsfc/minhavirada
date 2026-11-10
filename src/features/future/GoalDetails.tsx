import { useState } from "react";
import { Link } from "react-router-dom";
import type { Goal, FutureData, Milestone } from "./models";
import type { FinanceData } from "../finance/models";
import { goalSchema, milestoneSchema } from "./models";
import { FutureForm, type FutureField, type Values } from "./FutureForm";
import { goalFields, milestoneFields } from "./form-fields";
import {
  saveGoal,
  saveMilestone,
  contribute,
  contributionSchema,
} from "../../repositories/future";
import { goalProgress, allocated } from "../../services/future-calculations";
import { accountBalance } from "../../services/finance/calculations";
import { now, uuid } from "../../services/finance/transaction";
import { localDate, money } from "../../lib/date";
import { dateLabel } from "../../lib/calendar";
import { Status, useAction } from "../../components/RoutineUI";
import { LinkedTasks } from "./LinkedTasks";
export function GoalDetails({
  goal,
  data,
  finance,
}: {
  goal: Goal;
  data: FutureData;
  finance: FinanceData;
}) {
  const action = useAction();
  const [editor, setEditor] = useState<{
    title: string;
    fields: FutureField[];
    initial: Values;
    save: (v: Values, op: string) => Promise<unknown>;
  }>();
  const progress = goalProgress(goal, data);
  const banks = finance.accounts.filter(
    (a) => a.type !== "benefit" && a.status === "active",
  );
  const accountOptions = banks.map((a) => ({ value: a.id, label: a.name }));
  function editGoal() {
    setEditor({
      title: "Editar meta",
      fields: [
        ...goalFields,
        {
          key: "accountId",
          label: "Conta preferencial (opcional)",
          type: "select",
          options: [
            { value: "", label: "Escolher a cada contribuição" },
            ...accountOptions,
          ],
        },
      ],
      initial: { ...goal, accountId: goal.accountId ?? "" },
      save: (v, op) =>
        saveGoal(
          goalSchema.parse({
            ...v,
            accountId: v.accountId || null,
            revision: goal.revision + 1,
            updatedAt: now(),
          }),
          op,
        ),
    });
  }
  function editMilestone(m?: Milestone) {
    setEditor({
      title: m ? "Editar marco" : "Novo marco",
      fields: milestoneFields,
      initial: m ?? {
        id: uuid(),
        goalId: goal.id,
        title: "",
        deadline: "",
        budget: null,
        completed: false,
        notes: "",
        revision: 1,
        createdAt: now(),
        updatedAt: now(),
      },
      save: (v, op) =>
        saveMilestone(
          milestoneSchema.parse({
            ...v,
            revision: (m?.revision ?? 0) + 1,
            updatedAt: now(),
          }),
          op,
        ),
    });
  }
  function movement(kind: "allocate" | "withdraw") {
    setEditor({
      title:
        kind === "allocate"
          ? "Reservar para esta meta"
          : "Liberar valor reservado",
      fields: [
        {
          key: "accountId",
          label: "Conta da reserva",
          type: "select",
          required: true,
          options: [{ value: "", label: "Selecione" }, ...accountOptions],
        },
        {
          key: "amount",
          label: "Valor confirmado (R$)",
          type: "money",
          required: true,
        },
        {
          key: "date",
          label: "Data da movimentação",
          type: "date",
          required: true,
        },
        ...(kind === "allocate"
          ? [
              {
                key: "fromAccountId",
                label: "Transferir de outra conta? (opcional)",
                type: "select" as const,
                options: [
                  { value: "", label: "Somente alocar saldo já existente" },
                  ...accountOptions,
                ],
              },
            ]
          : []),
        { key: "notes", label: "Observações", type: "textarea" },
      ],
      initial: {
        id: uuid(),
        goalId: goal.id,
        kind,
        accountId: goal.accountId ?? "",
        amount: null,
        date: localDate(),
        notes: "",
        fromAccountId: "",
        transferId: uuid(),
      },
      save: (v, op) =>
        contribute(
          contributionSchema.parse({
            ...v,
            fromAccountId: v.fromAccountId || null,
          }),
          op,
        ),
    });
  }
  return (
    <section className="future-detail" aria-label="Detalhes da meta">
      <div className="section-title">
        <div>
          <p className="eyebrow">{goal.category}</p>
          <h2>{goal.title}</h2>
        </div>
        <button onClick={editGoal}>Editar meta</button>
      </div>
      <p className="muted">{goal.description}</p>
      <p className="small">
        Início {dateLabel(goal.startDate)} ·{" "}
        {goal.deadline
          ? "Prazo " + dateLabel(goal.deadline)
          : "Prazo em aberto"}{" "}
        ·{" "}
        {goal.status === "active"
          ? "Ativa"
          : goal.status === "completed"
            ? "Concluída"
            : "Arquivada"}
      </p>
      {progress.percent !== null && (
        <>
          <progress
            max={100}
            value={progress.percent}
            aria-label="Progresso da meta"
          />
          <p className="small">{Math.round(progress.percent)}% do objetivo</p>
        </>
      )}
      {goal.type === "financial" && (
        <>
          <div className="future-metrics">
            <div>
              <span>Reservado de verdade</span>
              <strong data-testid="goal-reserved">
                {money(progress.reserved)}
              </strong>
            </div>
            <div>
              <span>Valor-alvo</span>
              <strong>
                {goal.target === null ? "A definir" : money(goal.target)}
              </strong>
            </div>
            <div>
              <span>Falta reservar</span>
              <strong>
                {progress.remaining === null
                  ? "Defina o valor-alvo"
                  : money(progress.remaining)}
              </strong>
            </div>
          </div>
          <p className="muted small">
            A alocação separa dinheiro existente, sem alterar seu saldo. A
            retirada libera esse valor para outros usos e não é uma despesa.
          </p>
          <p className="muted small">
            Projeção:{" "}
            {progress.projection
              ? progress.remaining === 0
                ? "Valor-alvo reservado"
                : progress.projection
              : "aguardando 90 dias de histórico e um ritmo líquido positivo"}
            . Estimativa pelo ritmo dos últimos 90 dias, sem garantia e sem usar
            receitas previstas.
          </p>
          <div className="actions">
            <button
              className="primary"
              disabled={action.busy || goal.status !== "active"}
              onClick={() => movement("allocate")}
            >
              Reservar valor
            </button>
            <button
              disabled={action.busy || goal.status !== "active"}
              onClick={() => movement("withdraw")}
            >
              Liberar reserva
            </button>
          </div>
          {!banks.length && (
            <p className="muted">
              <Link to="/financas/contas">Cadastre uma conta bancária</Link>{" "}
              para registrar valores reais.
            </p>
          )}
          <details>
            <summary>Saldo disponível por conta</summary>
            {banks.map((a) => (
              <p key={a.id} className="small">
                {a.name}:{" "}
                {money(
                  accountBalance(finance, a.id, localDate()) -
                    allocated(data.movements, undefined, a.id),
                )}{" "}
                livres após todas as metas.
              </p>
            ))}
          </details>
        </>
      )}
      <Status message={action.message} />
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
      <div className="section-title">
        <h3>
          Pequenos marcos · {progress.completed}/{progress.steps}
        </h3>
        <button onClick={() => editMilestone()}>Adicionar marco</button>
      </div>
      {data.milestones
        .filter((m) => m.goalId === goal.id)
        .map((m) => (
          <article className="manage-row" key={m.id}>
            <div>
              <h3>
                {m.completed ? "✓ " : ""}
                {m.title}
              </h3>
              <p className="muted small">
                {m.deadline ? dateLabel(m.deadline) : "Sem prazo definido"} ·{" "}
                {m.budget === null ? "Orçamento em aberto" : money(m.budget)}
              </p>
              <p className="small">{m.notes}</p>
            </div>
            <button onClick={() => editMilestone(m)}>Editar marco</button>
          </article>
        ))}
      {!progress.steps && (
        <p className="muted small">
          Transforme este objetivo em um primeiro passo possível.
        </p>
      )}
      <LinkedTasks targetType="goal" targetId={goal.id} />
      {goal.type === "financial" && (
        <section className="panel">
          <h3>Evolução mensal da reserva</h3>
          <ul className="future-history">
            {progress.monthly.map((m) => (
              <li key={m.month}>
                <span>{m.month}</span>
                <span>
                  {money(m.net)} no mês · {money(m.total)} reservado
                </span>
              </li>
            ))}
          </ul>
          <h3>Contribuições e retiradas</h3>
          {data.movements
            .filter((m) => m.goalId === goal.id)
            .sort(
              (a, b) =>
                b.date.localeCompare(a.date) ||
                b.createdAt.localeCompare(a.createdAt),
            )
            .map((m) => (
              <article className="manage-row" key={m.id}>
                <div>
                  <strong>
                    {m.kind === "allocate" ? "+" : "−"} {money(m.amount)}
                  </strong>
                  <p className="muted small">
                    {dateLabel(m.date)} ·{" "}
                    {finance.accounts.find((a) => a.id === m.accountId)?.name} ·{" "}
                    {m.kind === "withdraw"
                      ? "Alocação liberada"
                      : m.transferId
                        ? "Transferência real e alocação"
                        : "Alocação de saldo existente"}
                  </p>
                  <p className="small">{m.notes}</p>
                </div>
              </article>
            ))}
          {!data.movements.some((m) => m.goalId === goal.id) && (
            <p className="muted">Nenhum valor reservado ainda.</p>
          )}
        </section>
      )}
      {goal.notes && <p className="note">{goal.notes}</p>}
    </section>
  );
}

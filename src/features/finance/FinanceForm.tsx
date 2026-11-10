import { useEditingGuard } from "../../components/EditingGuard";
import { storageMessage } from "../../services/storage";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { FinanceData, FinanceSettings } from "./models";
import {
  financeFormSpec,
  submitFinanceForm,
  type FinanceFormRequest,
  type FinanceField,
} from "../../services/finance/forms";
import { Status } from "../../components/RoutineUI";
const schema = z.record(z.string(), z.string());
export function FinanceForm({
  request,
  data,
  onSaved,
  onCancel,
  suggested,
}: {
  request: FinanceFormRequest;
  data: FinanceData;
  onSaved: () => void;
  onCancel: () => void;
  suggested?: Partial<FinanceSettings>;
}) {
  const [spec] = useState(() => financeFormSpec(request, data, suggested));
  const [snapshot] = useState(data);
  const [operationId] = useState(() => crypto.randomUUID());
  const [at] = useState(() => new Date().toISOString());
  const [message, setMessage] = useState("");
  const {
    register,
    handleSubmit,
    formState: { isSubmitting, isDirty },
  } = useForm<Record<string, string>>({
    resolver: zodResolver(schema),
    defaultValues: spec.values,
  });
  const discard = useEditingGuard(isDirty);
  const field = (f: FinanceField) => (
    <label key={f.name} htmlFor={`finance-${f.name}`}>
      {f.label}
      {f.type === "select" ? (
        <select
          id={`finance-${f.name}`}
          required={f.required}
          {...register(f.name)}
          aria-readonly={f.readOnly}
        >
          {!f.options?.length && (
            <option value="">Cadastre uma opção antes</option>
          )}
          {f.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={`finance-${f.name}`}
          type={f.type === "money" ? "text" : (f.type ?? "text")}
          inputMode={f.type === "money" ? "decimal" : undefined}
          required={f.required}
          readOnly={f.readOnly}
          maxLength={f.type === "text" ? 200 : undefined}
          step={f.type === "number" ? 1 : undefined}
          {...register(f.name)}
        />
      )}
    </label>
  );
  return (
    <section
      className="panel finance-editor"
      aria-label="Formulário financeiro"
    >
      <div className="section-title">
        <h2>{spec.title}</h2>
        <button
          type="button"
          onClick={() => discard(onCancel)}
          disabled={isSubmitting}
        >
          Fechar formulário
        </button>
      </div>
      <p className="muted small">{spec.note}</p>
      <form
        onSubmit={handleSubmit(async (values) => {
          setMessage("");
          try {
            await submitFinanceForm(request, values, snapshot, operationId, at);
            onSaved();
          } catch (error) {
            setMessage(
              storageMessage(error) ??
                (error instanceof z.ZodError
                  ? (error.issues[0]?.message ?? "Confira os campos.")
                  : error instanceof Error && error.name === "Error"
                    ? error.message
                    : "Não foi possível salvar. Verifique o armazenamento e tente novamente."),
            );
          }
        })}
      >
        <div className="form-grid">
          {spec.fields.filter((f) => !f.advanced).map(field)}
        </div>
        {spec.fields.some((f) => f.advanced) && (
          <details>
            <summary>Premissas dos três cenários</summary>
            <p className="muted small">
              Percentuais se aplicam somente a receitas previstas e gastos
              variáveis adicionais, nunca ao saldo real. As hipóteses não
              garantem resultados.
            </p>
            <div className="form-grid">
              {spec.fields.filter((f) => f.advanced).map(field)}
            </div>
          </details>
        )}
        <Status message={message} />
        <div className="actions">
          <button className="primary" disabled={isSubmitting}>
            {isSubmitting ? "Salvando…" : "Confirmar e salvar"}
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => discard(onCancel)}
          >
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}

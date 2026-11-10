import { useEditingGuard } from "../../components/EditingGuard";
import { storageMessage } from "../../services/storage";
import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { parseMoney } from "../../services/finance/money";
import { Status } from "../../components/RoutineUI";
export interface FutureField {
  key: string;
  label: string;
  type?:
    "text" | "textarea" | "date" | "money" | "number" | "select" | "checkbox";
  options?: { value: string; label: string }[];
  required?: boolean;
  max?: number;
}
export type Values = Record<string, unknown>;
export function FutureForm({
  title,
  fields,
  initial,
  onSave,
  onSaved,
  onCancel,
}: {
  title: string;
  fields: FutureField[];
  initial: Values;
  onSave: (values: Values, operationId: string) => Promise<unknown>;
  onSaved?: () => void;
  onCancel: () => void;
}) {
  const [snapshot] = useState(initial);
  const [operationId] = useState(() => crypto.randomUUID());
  const [message, setMessage] = useState("");
  const defaults = Object.fromEntries(
    fields.map((f) => [
      f.key,
      f.type === "money"
        ? snapshot[f.key] === null || snapshot[f.key] === undefined
          ? ""
          : String(Number(snapshot[f.key]) / 100).replace(".", ",")
        : (snapshot[f.key] ?? ""),
    ]),
  );
  const {
    register,
    handleSubmit,
    formState: { isSubmitting, isDirty },
  } = useForm({ defaultValues: defaults });
  const discard = useEditingGuard(isDirty);
  return (
    <section className="panel future-editor" aria-label={title}>
      <h2>{title}</h2>
      <p className="muted small">
        Ajuste ao seu momento. Campos opcionais podem ficar em branco.
      </p>
      <form
        onSubmit={handleSubmit(async (raw) => {
          setMessage("");
          try {
            const values: Values = { ...snapshot };
            for (const f of fields) {
              const v = raw[f.key];
              values[f.key] =
                f.type === "money"
                  ? String(v).trim() === ""
                    ? null
                    : parseMoney(String(v))
                  : f.type === "number"
                    ? Number(v)
                    : f.type === "checkbox"
                      ? !!v
                      : v;
            }
            await onSave(values, operationId);
            onSaved?.();
            onCancel();
          } catch (error) {
            setMessage(
              storageMessage(error) ??
                (error instanceof z.ZodError
                  ? (error.issues[0]?.message ?? "Verifique os campos.")
                  : error instanceof Error
                    ? error.message
                    : "Não foi possível salvar."),
            );
          }
        })}
      >
        <div className="form-grid">
          {fields.map((f) => (
            <label
              key={f.key}
              className={f.type === "textarea" ? "future-wide" : ""}
            >
              {f.type === "checkbox" ? (
                <>
                  <input type="checkbox" {...register(f.key)} />
                  {f.label}
                </>
              ) : (
                <>
                  {f.label}
                  {f.type === "textarea" ? (
                    <textarea rows={3} maxLength={3000} {...register(f.key)} />
                  ) : f.type === "select" ? (
                    <select {...register(f.key)} required={f.required}>
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      {...register(f.key)}
                      type={f.type === "money" ? "text" : (f.type ?? "text")}
                      inputMode={f.type === "money" ? "decimal" : undefined}
                      required={f.required}
                      min={f.type === "number" ? 1 : undefined}
                      max={f.max}
                      maxLength={
                        f.type === "date" || f.type === "number"
                          ? undefined
                          : f.type === "money"
                            ? 14
                            : 120
                      }
                    />
                  )}
                </>
              )}
            </label>
          ))}
        </div>
        <Status message={message} />
        <div className="actions">
          <button className="primary" disabled={isSubmitting}>
            {isSubmitting ? "Salvando…" : "Salvar alterações"}
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

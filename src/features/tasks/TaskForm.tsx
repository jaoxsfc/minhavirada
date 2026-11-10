import { useEditingGuard } from "../../components/EditingGuard";
import { saveLinkedTask } from "../../repositories/future";
import type { TaskLink } from "../future/models";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { taskSchema, type Task, type TaskInput } from "./models";
import { saveTask } from "../../repositories/routines";
import { DayPicker, FieldError } from "../../components/RoutineUI";
import { localDate } from "../../lib/date";
export function TaskForm({
  task,
  initialLink,
  onSaved,
  onCancel,
  onError,
}: {
  task?: Task;
  initialLink?: Omit<TaskLink, "id">;
  onSaved: () => void;
  onCancel: () => void;
  onError: (s: string) => void;
}) {
  const {
    register,
    handleSubmit,
    control,

    formState: { errors, isSubmitting, isDirty },
  } = useForm<TaskInput>({
    resolver: zodResolver(taskSchema),
    defaultValues: task ?? {
      id: crypto.randomUUID(),
      title: "",
      description: "",
      startDate: localDate(),
      endDate: "",
      time: "",
      priority: "medium",
      duration: 30,
      recurrence: "once",
      weekdays: [],
      status: "active",
    },
  });
  const discard = useEditingGuard(isDirty);
  const recurrence = useWatch({ control, name: "recurrence" });
  return (
    <section className="panel">
      <h2>{task ? "Editar tarefa" : "Qual é o próximo passo?"}</h2>
      <form
        onSubmit={handleSubmit(async (values) => {
          try {
            if (initialLink)
              await saveLinkedTask(values, task?.revision ?? null, {
                ...initialLink,
                id: values.id,
              });
            else await saveTask(values, task?.revision ?? null);
            onSaved();
          } catch (error) {
            onError(
              error instanceof Error
                ? error.message
                : "Não foi possível salvar.",
            );
          }
        })}
      >
        <label>
          Título da tarefa
          <input
            {...register("title")}
            maxLength={120}
            aria-invalid={!!errors.title}
          />
          <FieldError message={errors.title?.message} />
        </label>
        <label>
          Descrição
          <textarea {...register("description")} rows={2} maxLength={1000} />
          <FieldError message={errors.description?.message} />
        </label>
        <div className="form-grid">
          <label>
            Data / início
            <input type="date" {...register("startDate")} />
            <FieldError message={errors.startDate?.message} />
          </label>
          <label>
            Horário (opcional)
            <input type="time" {...register("time")} />
            <FieldError message={errors.time?.message} />
          </label>
          <label>
            Prioridade
            <select {...register("priority")}>
              <option value="low">Baixa</option>
              <option value="medium">Média</option>
              <option value="high">Alta</option>
            </select>
          </label>
          <label>
            Duração estimada (minutos)
            <input
              type="number"
              min="0"
              max="1440"
              {...register("duration", { valueAsNumber: true })}
            />
            <FieldError message={errors.duration?.message} />
          </label>
          <label>
            Frequência
            <select {...register("recurrence")}>
              <option value="once">Uma vez</option>
              <option value="daily">Diária</option>
              <option value="weekly">Semanal</option>
            </select>
          </label>
          {recurrence !== "once" && (
            <label>
              Data final (opcional)
              <input type="date" {...register("endDate")} />
              <FieldError message={errors.endDate?.message} />
            </label>
          )}
        </div>
        {recurrence === "weekly" && (
          <>
            <Controller
              name="weekdays"
              control={control}
              render={({ field }) => (
                <DayPicker value={field.value} onChange={field.onChange} />
              )}
            />
            <FieldError message={errors.weekdays?.message} />
          </>
        )}
        <p className="muted small">
          Editar a frequência reorganiza ocorrências ainda não registradas.
          Conclusões e adiamentos anteriores permanecem no histórico.
        </p>
        <div className="actions">
          <button className="primary" disabled={isSubmitting}>
            {isSubmitting ? "Salvando…" : "Salvar tarefa"}
          </button>
          <button type="button" onClick={() => discard(onCancel)}>
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}

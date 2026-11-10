import { useEditingGuard } from "../../components/EditingGuard";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { habitSchema, type Habit, type HabitInput } from "./models";
import { saveHabit } from "../../repositories/routines";
import { localDate } from "../../lib/date";
import { DayPicker, FieldError } from "../../components/RoutineUI";
export function HabitForm({
  habit,
  onSaved,
  onCancel,
  onError,
}: {
  habit?: Habit;
  onSaved: () => void;
  onCancel: () => void;
  onError: (s: string) => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<HabitInput>({
    resolver: zodResolver(habitSchema),
    defaultValues: habit ?? {
      id: crypto.randomUUID(),
      name: "",
      description: "",
      category: "Cuidado pessoal",
      frequency: 3,
      preferredDays: [],
      duration: 20,
      startDate: localDate(),
      status: "active",
    },
  });
  const discard = useEditingGuard(isDirty);
  return (
    <section className="panel">
      <h2>{habit ? "Editar hábito" : "Um novo cuidado na rotina"}</h2>
      <form
        onSubmit={handleSubmit(async (value) => {
          try {
            await saveHabit(value, habit?.revision ?? null);
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
          Nome do hábito
          <input
            {...register("name")}
            maxLength={100}
            aria-invalid={!!errors.name}
          />
          <FieldError message={errors.name?.message} />
        </label>
        <label>
          Descrição
          <textarea rows={2} {...register("description")} maxLength={1000} />
          <FieldError message={errors.description?.message} />
        </label>
        <div className="form-grid">
          <label>
            Categoria
            <select {...register("category")}>
              {[
                "Movimento",
                "Projetos",
                "Organização",
                "Cuidado pessoal",
                "Outro",
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Meta de dias por semana
            <input
              type="number"
              min="1"
              max="7"
              {...register("frequency", { valueAsNumber: true })}
            />
            <FieldError message={errors.frequency?.message} />
          </label>
          <label>
            Duração sugerida (minutos)
            <input
              type="number"
              min="0"
              max="1440"
              {...register("duration", { valueAsNumber: true })}
            />
            <FieldError message={errors.duration?.message} />
          </label>
          <label>
            Início do hábito
            <input type="date" {...register("startDate")} />
            <FieldError message={errors.startDate?.message} />
          </label>
        </div>
        <Controller
          control={control}
          name="preferredDays"
          render={({ field }) => (
            <DayPicker value={field.value} onChange={field.onChange} />
          )}
        />
        <p className="muted small">
          Dias preferenciais organizam a agenda; a meta semanal é independente.
          Sem seleção, distribuímos a meta ao longo da semana. Nada é marcado
          como concluído automaticamente.
        </p>
        <div className="actions">
          <button className="primary" disabled={isSubmitting}>
            {isSubmitting ? "Salvando…" : "Salvar hábito"}
          </button>
          <button type="button" onClick={() => discard(onCancel)}>
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}

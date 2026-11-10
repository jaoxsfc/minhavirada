import { useEditingGuard } from "../../components/EditingGuard";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRoutines } from "../../hooks/useRoutines";
import {
  checkInSchema,
  dateSchema,
  moodLabels,
  type CheckInInput,
  type CheckIn,
} from "./models";
import { useLocalToday } from "../../hooks/useLocalToday";
import { saveCheckIn } from "../../repositories/routines";
import { DataState, FieldError, Status } from "../../components/RoutineUI";
function CheckInForm({
  date,
  entry,
  onSaved,
}: {
  date: string;
  entry?: CheckIn;
  onSaved: (message: string) => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CheckInInput>({
    resolver: zodResolver(checkInSchema),
    defaultValues: entry ?? {
      date,
      mood: 3,
      energy: 3,
      craving: 0,
      triggers: "",
      exercise: false,
      activityMinutes: 0,
      projectMinutes: 0,
      notes: "",
    },
  });
  useEditingGuard(isDirty);
  const exercise = useWatch({ control, name: "exercise" });
  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        try {
          await saveCheckIn(values, entry?.revision ?? null);
          reset(values);
          onSaved("Check-in salvo neste dispositivo.");
        } catch (error) {
          onSaved(
            error instanceof Error && error.name === "Error"
              ? error.message
              : "Não foi possível salvar. Reabra o registro e tente novamente.",
          );
        }
      })}
    >
      <input type="hidden" {...register("date")} />
      <div className="section-title">
        <h2>Como foi seu dia?</h2>
        <span>{entry ? "Editar registro" : "Seu momento de pausa"}</span>
      </div>
      <div className="form-grid">
        <label>
          Humor
          <select {...register("mood", { valueAsNumber: true })}>
            {moodLabels.map((label, i) => (
              <option value={i + 1} key={label}>
                {label}
              </option>
            ))}
          </select>
          <FieldError message={errors.mood?.message} />
        </label>
        <label>
          Energia (1 a 5)
          <select {...register("energy", { valueAsNumber: true })}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
                {n === 1 ? " · Baixa" : n === 5 ? " · Alta" : ""}
              </option>
            ))}
          </select>
          <FieldError message={errors.energy?.message} />
        </label>
      </div>
      <fieldset className="private-fields">
        <legend>Um registro só seu</legend>
        <p className="muted small">
          Esses dados ficam neste navegador. Nenhum dia sem registro será
          interpretado como um dia sem consumo.
        </p>
        <div className="form-grid">
          <label>
            Houve consumo de maconha?
            <select
              {...register("consumed", {
                setValueAs: (v) =>
                  v === true || v === "true"
                    ? true
                    : v === false || v === "false"
                      ? false
                      : undefined,
              })}
              defaultValue={entry ? String(entry.consumed) : ""}
              aria-invalid={!!errors.consumed}
            >
              <option value="">Escolha uma opção</option>
              <option value="false">Não</option>
              <option value="true">Sim</option>
            </select>
            <FieldError
              message={errors.consumed ? "Escolha sim ou não." : undefined}
            />
          </label>
          <label>
            Vontade de consumir (0 a 5)
            <select {...register("craving", { valueAsNumber: true })}>
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                  {n === 0 ? " · Nenhuma" : n === 5 ? " · Intensa" : ""}
                </option>
              ))}
            </select>
            <FieldError message={errors.craving?.message} />
          </label>
        </div>
        <label>
          Gatilhos percebidos (opcional)
          <input
            {...register("triggers")}
            maxLength={500}
            placeholder="O que você percebeu hoje?"
          />
          <FieldError message={errors.triggers?.message} />
        </label>
      </fieldset>
      <div className="section-title">
        <h2>Tempo para você</h2>
      </div>
      <label className="check">
        <input
          type="checkbox"
          {...register("exercise", {
            onChange: (e) => {
              if (!e.target.checked) setValue("activityMinutes", 0);
            },
          })}
        />
        Realizei atividade física
      </label>
      <div className="form-grid">
        <label>
          Minutos de atividade
          <input
            type="number"
            min="0"
            max="1440"
            readOnly={!exercise}
            {...register("activityMinutes", { valueAsNumber: true })}
          />
          <FieldError message={errors.activityMinutes?.message} />
        </label>
        <label>
          Minutos em projetos pessoais
          <input
            type="number"
            min="0"
            max="1440"
            {...register("projectMinutes", { valueAsNumber: true })}
          />
          <FieldError message={errors.projectMinutes?.message} />
        </label>
      </div>
      <label>
        Observações (opcional)
        <textarea rows={4} maxLength={3000} {...register("notes")} />
        <FieldError message={errors.notes?.message} />
      </label>
      <p className="muted small">
        Você pode voltar e editar este dia. Seu histórico continua com você.
      </p>
      <button className="primary" disabled={isSubmitting}>
        {isSubmitting ? "Salvando…" : "Salvar check-in"}
      </button>
    </form>
  );
}
export default function CheckInPage() {
  const today = useLocalToday();
  const data = useRoutines();
  const [params, setParams] = useSearchParams();
  const [openedDate] = useState(today);
  const candidate = params.get("date") ?? openedDate;
  const date =
    dateSchema.safeParse(candidate).success && candidate <= today
      ? candidate
      : today;
  const [message, setMessage] = useState("");
  const entry = data?.checkIns.find((c) => c.date === date);
  return (
    <>
      <Link className="text-link" to="/habitos">
        ← Hábitos e rotina
      </Link>
      <p className="eyebrow">PERCEBER TAMBÉM É CUIDAR</p>
      <h1>Seu check-in.</h1>
      <p className="muted">
        Sem cobrança. Um espaço para reconhecer como você está.
      </p>
      <label className="date-control">
        Data do check-in
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => {
            if (e.target.value) {
              setParams({ date: e.target.value });
              setMessage("");
            }
          }}
        />
      </label>
      <DataState data={data}>
        <section className="panel">
          <CheckInForm
            key={`${date}:${entry?.revision ?? 0}`}
            date={date}
            entry={entry}
            onSaved={setMessage}
          />
          <Status message={message} />
        </section>
      </DataState>
    </>
  );
}

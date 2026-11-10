import { useEditingGuard } from "./EditingGuard";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { defaults, type Settings } from "../db/database";
import { saveSettings } from "../repositories/settings";
const amount = z
  .string()
  .regex(
    /^\d{1,7}([,.]\d{1,2})?$/,
    "Use um valor positivo com até duas casas decimais.",
  )
  .refine(
    (value) => Number(value.replace(",", ".")) <= 1000000,
    "O limite por valor planejado é R$ 1.000.000,00.",
  );
const schema = z.object({
  name: z.string().trim().min(1, "Informe seu nome.").max(50),
  salary: amount,
  benefit: amount,
  fuel: amount,
  food: amount,
  reserve: amount.refine(
    (v) => Number(v.replace(",", ".")) > 0,
    "A meta deve ser maior que zero.",
  ),
  theme: z.enum(["light", "dark", "system"]),
  hideSensitive: z.boolean(),
});
type Fields = z.infer<typeof schema>;
const cents = (value: string) =>
  Math.round(Number(value.replace(",", ".")) * 100);
export function SettingsForm({
  profile,
  onSaved,
}: {
  profile?: Settings;
  onSaved?: () => void;
}) {
  const p = profile ?? defaults;
  const [message, setMessage] = useState(
    profile ? "Preferências salvas neste dispositivo." : "",
  );
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Fields>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...p,
      salary: String(p.salary / 100),
      benefit: String(p.benefit / 100),
      fuel: String(p.fuel / 100),
      food: String(p.food / 100),
      reserve: String(p.reserve / 100),
    },
  });
  useEditingGuard(isDirty);
  const fields = [
    ["salary", "Salário planejado"],
    ["benefit", "Benefício mensal"],
    ["fuel", "Combustível planejado"],
    ["food", "Alimentação planejada"],
    ["reserve", "Meta de reserva"],
  ] as const;
  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        try {
          await saveSettings({
            ...p,
            ...values,
            salary: cents(values.salary),
            benefit: cents(values.benefit),
            fuel: cents(values.fuel),
            food: cents(values.food),
            reserve: cents(values.reserve),
          });
          reset(values);
          setMessage("Preferências salvas neste dispositivo.");
          onSaved?.();
        } catch {
          setMessage(
            "Não foi possível salvar. Verifique o armazenamento do navegador e tente novamente.",
          );
        }
      })}
    >
      <label>
        Como você quer ser chamado?
        <input
          autoComplete="given-name"
          {...register("name")}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "name-error" : undefined}
        />
      </label>
      {errors.name && (
        <p id="name-error" role="alert" className="error">
          {errors.name.message}
        </p>
      )}
      <div className="form-grid">
        {fields.map(([key, label]) => (
          <label key={key}>
            {label} (R$)
            <input
              inputMode="decimal"
              {...register(key)}
              aria-invalid={!!errors[key]}
            />
            {errors[key] && (
              <span className="error" role="alert">
                {errors[key]?.message}
              </span>
            )}
          </label>
        ))}
        <label>
          Aparência
          <select {...register("theme")}>
            <option value="system">Acompanhar dispositivo</option>
            <option value="light">Clara</option>
            <option value="dark">Escura</option>
          </select>
        </label>
      </div>
      <label className="check">
        <input type="checkbox" {...register("hideSensitive")} />
        Ocultar indicadores sensíveis no início
      </label>
      <p className="muted">
        Valores de planejamento. Salvar não cria transações nem altera saldos.
      </p>
      <button className="primary" disabled={isSubmitting}>
        {isSubmitting
          ? "Salvando…"
          : profile
            ? "Salvar preferências"
            : "Começar minha virada"}
      </button>
      <p role="status">{message}</p>
    </form>
  );
}

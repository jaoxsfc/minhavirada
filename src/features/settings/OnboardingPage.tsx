import { useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { db, defaults, type Settings } from "../../db/database";
import { useProfile } from "../../hooks/useProfile";
import { saveSettings } from "../../repositories/settings";
import { useEditingGuard } from "../../components/EditingGuard";
import { storageMessage } from "../../services/storage";

const basicSchema = z.object({
  name: z.string().trim().min(1, "Informe como quer ser chamado.").max(50),
  theme: z.enum(["system", "light", "dark"]),
});
type Basic = z.infer<typeof basicSchema>;
function Basics({ profile }: { profile?: Settings }) {
  const [message, setMessage] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { isDirty, isSubmitting, errors },
  } = useForm<Basic>({
    resolver: zodResolver(basicSchema),
    defaultValues: {
      name: profile?.name ?? "",
      theme: profile?.theme ?? "system",
    },
  });
  useEditingGuard(isDirty);
  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        try {
          await saveSettings({
            ...defaults,
            ...profile,
            ...values,
            ...(!profile ? { salary: 0, benefit: 0, fuel: 0, food: 0 } : {}),
          });
          reset(values);
          setMessage(
            "Seu espaço está preparado. Escolha seu próximo passo abaixo.",
          );
        } catch (error) {
          setMessage(
            storageMessage(error) ??
              "Não foi possível salvar. Tente novamente.",
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
          aria-describedby={errors.name ? "basic-error" : undefined}
        />
      </label>
      {errors.name && (
        <p id="basic-error" role="alert" className="error">
          {errors.name.message}
        </p>
      )}
      <label>
        Aparência
        <select {...register("theme")}>
          <option value="system">Acompanhar dispositivo</option>
          <option value="light">Clara</option>
          <option value="dark">Escura</option>
        </select>
      </label>
      <p className="muted small">
        Indicadores sensíveis começam ocultos. Nenhuma conta, transação, meta ou
        hábito será criado automaticamente.
      </p>
      <button className="primary" disabled={isSubmitting}>
        {isSubmitting ? "Salvando…" : "Preparar meu espaço"}
      </button>
      <p role="status">{message}</p>
    </form>
  );
}

export default function OnboardingPage() {
  const result = useProfile();
  const progress = useLiveQuery(
    () =>
      db.transaction(
        "r",
        [db.habits, db.goals, db.financeEntries, db.backupState],
        async () => ({
          habits: await db.habits.count(),
          goals: await db.goals.count(),
          entries: await db.financeEntries.count(),
          backup: !!(await db.backupState.get("local"))?.lastExternal,
        }),
      ),
    [],
  );
  return (
    <>
      <p className="eyebrow">SEU COMEÇO, SEM PRESSA</p>
      <h1>Um espaço para sua virada.</h1>
      <p className="muted">
        Cuide do seu dia, organize seu dinheiro e dê um próximo passo nos seus
        planos. Escolha apenas o que fizer sentido agora.
      </p>
      <Link className="text-link" to="/">
        Pular por enquanto →
      </Link>
      <section className="panel">
        <h2>Seus dados ficam com você</h2>
        <p>
          Este navegador guarda os registros localmente, sem conta ou envio de
          dados pessoais. Eles podem se perder ao limpar o site ou trocar de
          aparelho. Uma cópia externa protegida por senha ajuda a preservá-los.
        </p>
        <Link className="text-link" to="/mais/privacidade">
          Entender privacidade e instalação →
        </Link>
      </section>
      <section className="panel">
        <h2>Primeiro, do seu jeito</h2>
        {!result ? (
          <p role="status">Abrindo preferências…</p>
        ) : result.error ? (
          <p role="alert">
            Não foi possível ler suas preferências. Reabra antes de configurar.
          </p>
        ) : (
          <Basics profile={result.profile} />
        )}
      </section>
      <section aria-label="Seus primeiros passos">
        <div className="section-title">
          <h2>Um passo de cada vez</h2>
          <span>Todos opcionais</span>
        </div>
        <p className="muted small">
          Você pode sair e retomar aqui em Mais → Primeiros passos. Os registros
          existentes indicam o que já começou; nada será duplicado ao reabrir.
        </p>
        <div className="menu-list">
          {[
            [
              "Seu primeiro hábito",
              "Escolha uma sugestão na rotina ou crie a sua.",
              "/habitos",
              !!progress?.habits,
            ],
            [
              "Uma meta que importa",
              "Escolha um objetivo, sem movimentar dinheiro.",
              "/metas/objetivos",
              !!progress?.goals,
            ],
            [
              "Seu primeiro lançamento",
              "Configure uma conta, confirme o saldo e registre uma receita ou despesa.",
              "/financas",
              !!progress?.entries,
            ],
            [
              "Sua primeira cópia externa",
              "Exporte, guarde o arquivo e confirme em Seus dados e segurança.",
              "/mais/seguranca",
              !!progress?.backup,
            ],
          ].map(([title, description, path, done]) => (
            <Link to={String(path)} key={String(path)}>
              <div>
                <h3>{String(title)}</h3>
                <p className="muted">{String(description)}</p>
                <span className="pill">
                  {!progress
                    ? "Verificando registros…"
                    : done
                      ? "Já iniciado neste dispositivo"
                      : "Quando você quiser"}
                </span>
              </div>
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

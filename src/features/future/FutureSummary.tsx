import { Link } from "react-router-dom";
import { useFuture } from "../../hooks/useFuture";
import { useProfile } from "../../hooks/useProfile";
import { allocated } from "../../services/future-calculations";
import { dateLabel } from "../../lib/calendar";
import { money } from "../../lib/date";
export function FutureSummary() {
  const result = useFuture(),
    profile = useProfile();
  if (result?.error)
    return (
      <p role="alert">
        Não foi possível ler suas metas.{" "}
        <Link to="/metas">Abrir meu futuro</Link>
      </p>
    );
  const goals =
    result?.future?.goals.filter((g) => g.status === "active") ?? [];
  const next = [...goals].sort(
    (a, b) =>
      ({ high: 0, medium: 1, low: 2 })[a.priority] -
        { high: 0, medium: 1, low: 2 }[b.priority] ||
      (a.deadline || "9999").localeCompare(b.deadline || "9999") ||
      a.title.localeCompare(b.title),
  )[0];
  const milestone = result?.future?.milestones
    ?.filter((m) => m.goalId === next?.id && !m.completed)
    .sort((a, b) =>
      (a.deadline || "9999").localeCompare(b.deadline || "9999"),
    )[0];
  return (
    <section className="note">
      <div>
        <h3>{next ? "Sua próxima meta" : "Meu futuro"}</h3>
        <p>
          {goals.length
            ? goals.length +
              (goals.length === 1
                ? " objetivo em andamento."
                : " objetivos em andamento.")
            : "Um espaço para transformar planos em pequenos passos."}
          {goals.length > 0 && profile?.profile?.hideSensitive === false
            ? " " +
              money(allocated(result?.future?.movements ?? [])) +
              " em alocações confirmadas."
            : ""}
        </p>
        {next && profile?.profile?.hideSensitive === false && (
          <p>
            {next.deadline
              ? "Prazo: " + dateLabel(next.deadline)
              : "Prazo em aberto"}
            {milestone ? " · há um próximo marco a cuidar" : ""}. Abra seus
            planos para ver os detalhes.
          </p>
        )}
        <Link className="text-link" to="/metas">
          Cuidar dos meus planos →
        </Link>
      </div>
    </section>
  );
}

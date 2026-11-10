import { Link } from "react-router-dom";
import { useFinance } from "../../hooks/useFinance";
import {
  bankBalance,
  benefitBalance,
  untilSalary,
} from "../../services/finance/calculations";
import { useLocalToday } from "../../hooks/useLocalToday";
import { money } from "../../lib/date";
export function FinancialSummary({
  hideSensitive = true,
}: {
  hideSensitive?: boolean;
}) {
  const result = useFinance();
  const today = useLocalToday();
  const data = result?.data;
  if (!result) return <p role="status">Abrindo resumo financeiro…</p>;
  if (result.error)
    return (
      <p role="alert">
        Não foi possível ler o resumo financeiro.{" "}
        <Link to="/financas">Abrir finanças</Link>
      </p>
    );
  if (!data?.settings)
    return (
      <section className="note">
        <div>
          <h3>Seu planejamento financeiro começa com você.</h3>
          <p>Configure contas e valores sem criar movimentos automáticos.</p>
          <Link className="text-link" to="/financas">
            Preparar minhas finanças →
          </Link>
        </div>
      </section>
    );
  return (
    <section className="panel financial-home">
      <div className="section-title">
        <h2>Seu dinheiro hoje</h2>
        <Link className="text-link" to="/financas">
          Abrir finanças →
        </Link>
      </div>
      <div className="stats-inline">
        <span>
          Banco:{" "}
          <strong>
            {data.accounts.some((a) => a.type !== "benefit")
              ? hideSensitive
                ? "Valor oculto"
                : money(bankBalance(data, today))
              : "Cadastre uma conta"}
          </strong>
        </span>
        <span>
          Ticket separado:{" "}
          <strong>
            {data.accounts.some((a) => a.type === "benefit")
              ? hideSensitive
                ? "Valor oculto"
                : money(benefitBalance(data, today))
              : "Não cadastrado"}
          </strong>
        </span>
      </div>
      {hideSensitive && (
        <p className="muted small">
          Seus valores ficam discretos no início. Consulte os detalhes em
          Finanças ou ajuste a privacidade nas preferências.
        </p>
      )}
      {!hideSensitive && data.accounts.some((a) => a.type !== "benefit") && (
        <p className="muted small">
          Após compromissos conhecidos até o próximo salário:{" "}
          {money(untilSalary(data, today).afterKnownBills)} (simulação
          incompleta se houver gastos ainda não informados; inclui valores
          alocados em metas).
        </p>
      )}
    </section>
  );
}

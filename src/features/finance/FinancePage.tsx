import { useConfirmDiscard } from "../../components/EditingGuard";
import { useEffect, useState, lazy, Suspense } from "react";
import { Link, useLocation } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/database";
import { useFinance } from "../../hooks/useFinance";
import { useProfile } from "../../hooks/useProfile";
import { useLocalToday } from "../../hooks/useLocalToday";
import { DataState, Status, useAction } from "../../components/RoutineUI";
import { FinanceForm } from "./FinanceForm";
import { FinanceOverview } from "./FinanceOverview";
import { emptyFinance } from "./models";
import type { FinanceFormRequest } from "../../services/finance/forms";
import { synchronizeFinance } from "../../services/finance/commands";
import { needsBackup } from "../../services/backup";
import {
  FinanceRules,
  FinanceBudgets,
  FinanceProjection,
} from "./FinancePlans";
const FinanceAccounts = lazy(() => import("./FinanceAccounts"));
const FinanceEntries = lazy(() => import("./FinanceEntries"));
const FinanceCards = lazy(() => import("./FinanceCards"));
const FinanceBenefit = lazy(() => import("./FinanceBenefit"));
const FinanceCalendar = lazy(() => import("./FinanceCalendar"));
const FinanceReports = lazy(() => import("./FinanceReports"));
const routes = [
  ["", "Visão geral"],
  ["lancamentos", "Lançamentos"],
  ["contas", "Contas"],
  ["cartoes", "Cartões"],
  ["ticket", "Ticket"],
  ["vencimentos", "Vencimentos"],
  ["recorrencias", "Recorrências"],
  ["orcamentos", "Orçamentos"],
  ["projecoes", "Projeções"],
  ["relatorios", "Relatórios"],
];
export default function FinancePage() {
  const result = useFinance();
  const data = result?.data ?? emptyFinance;
  const profile = useProfile()?.profile;
  const discard = useConfirmDiscard();
  const today = useLocalToday();
  const location = useLocation();
  const tab = location.pathname.split("/")[2] ?? "";
  const action = useAction();
  const [form, setForm] = useState<FinanceFormRequest>();
  const [formKey, setFormKey] = useState(0);
  const [syncError, setSyncError] = useState("");
  const rulesKey = data.rules
    .map((r) => `${r.id}:${r.revision}`)
    .sort()
    .join("|");
  const backup = useLiveQuery(() => db.backupState.get("local"));
  useEffect(() => {
    let active = true;
    synchronizeFinance(today)
      .then(() => {
        if (active) setSyncError("");
      })
      .catch(() => {
        if (active)
          setSyncError(
            "Não foi possível atualizar as previsões recorrentes. Reabra o módulo antes de pagar ocorrências que faltam.",
          );
      });
    return () => {
      active = false;
    };
  }, [today, rulesKey]);
  const open = (request: FinanceFormRequest) =>
    discard(() => {
      setForm(request);
      setFormKey((k) => k + 1);
      setTimeout(
        () =>
          document
            .querySelector(".finance-editor")
            ?.scrollIntoView({ behavior: "auto", block: "start" }),
        0,
      );
    });
  const props = { data, onOpen: open };
  return (
    <>
      <p className="eyebrow">CLAREZA PARA ESCOLHER O PRÓXIMO PASSO</p>
      <h1>Finanças</h1>
      <p className="muted">
        Dinheiro presente. Planos possíveis. Cada coisa no seu lugar.
      </p>
      <DataState data={result}>
        {needsBackup(backup?.lastConfirmedAt) && (
          <div className="backup-warning">
            Seus registros precisam de uma cópia recente fora do navegador.{" "}
            <Link to="/mais/backup">Fazer backup →</Link>
          </div>
        )}
        {!data.settings ? (
          <section className="empty">
            <h2>Vamos conhecer seu ponto de partida?</h2>
            <p>
              Os valores sugeridos são apenas planejamento. Você confirma cada
              saldo e cada movimento.
            </p>
            <button
              className="primary"
              onClick={() => open({ mode: "settings" })}
            >
              Configurar minhas finanças
            </button>
          </section>
        ) : (
          <>
            <nav className="finance-nav" aria-label="Seções financeiras">
              {routes.map(([path, label]) => (
                <Link
                  key={path}
                  className={tab === path ? "active" : ""}
                  aria-current={tab === path ? "page" : undefined}
                  to={"/financas" + (path ? "/" + path : "")}
                >
                  {label}
                </Link>
              ))}
            </nav>
            <div className="finance-tools">
              <button onClick={() => open({ mode: "settings" })}>
                Planejamento e cenários
              </button>
              <Link to="/mais/backup">Backup e recuperação</Link>
            </div>
          </>
        )}
        <Status message={action.message} />
        {syncError && (
          <p role="alert" className="error">
            {syncError}
          </p>
        )}
        {form && (
          <FinanceForm
            key={formKey}
            request={form}
            data={data}
            suggested={
              profile
                ? {
                    salary: profile.salary,
                    benefit: profile.benefit,
                    fuel: profile.fuel,
                    food: profile.food,
                    reserveTarget: profile.reserve,
                  }
                : undefined
            }
            onCancel={() => setForm(undefined)}
            onSaved={() => {
              setForm(undefined);
              void action.run(
                () => synchronizeFinance(today),
                "Registro salvo neste dispositivo. Apenas movimentos confirmados alteram saldos.",
              );
            }}
          />
        )}
        {data.settings && (
          <Suspense fallback={<p role="status">Abrindo suas finanças…</p>}>
            {tab === "" && <FinanceOverview {...props} />}{" "}
            {tab === "contas" && <FinanceAccounts {...props} />}{" "}
            {tab === "lancamentos" && <FinanceEntries {...props} />}{" "}
            {tab === "cartoes" && <FinanceCards {...props} />}{" "}
            {tab === "ticket" && <FinanceBenefit {...props} />}{" "}
            {tab === "vencimentos" && <FinanceCalendar {...props} />}{" "}
            {tab === "recorrencias" && <FinanceRules {...props} />}{" "}
            {tab === "orcamentos" && <FinanceBudgets {...props} />}{" "}
            {tab === "projecoes" && <FinanceProjection {...props} />}{" "}
            {tab === "relatorios" && <FinanceReports {...props} />}{" "}
            {!routes.some(([path]) => path === tab) && (
              <section className="empty">
                <h2>Seção não encontrada.</h2>
                <Link to="/financas">Voltar à visão geral</Link>
              </section>
            )}
          </Suspense>
        )}
      </DataState>
    </>
  );
}

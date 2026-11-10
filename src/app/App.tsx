import { lazy, Suspense, useEffect } from "react";
import {
  createHashRouter,
  RouterProvider,
  NavLink,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
import {
  House,
  Wallet,
  Heart,
  Target,
  Grid2X2,
  Sprout,
  ArrowUpRight,
} from "lucide-react";
import { EditingGuard } from "../components/EditingGuard";
import { useMobileViewport } from "../hooks/useMobileViewport";
import { useProfile } from "../hooks/useProfile";
import { Dashboard } from "../features/dashboard/Dashboard";
const OnboardingPage = lazy(
  () => import("../features/settings/OnboardingPage"),
);
const SettingsForm = lazy(() =>
  import("../components/SettingsForm").then((m) => ({
    default: m.SettingsForm,
  })),
);
const HabitsPage = lazy(() => import("../features/habits/HabitsPage"));
const CheckInPage = lazy(() => import("../features/habits/CheckInPage"));
const CalendarPage = lazy(() => import("../features/habits/CalendarPage"));
const TrackingPage = lazy(() => import("../features/habits/TrackingPage"));
const TasksPage = lazy(() => import("../features/tasks/TasksPage"));
const FuturePage = lazy(() => import("../features/future/FuturePage"));
const FinancePage = lazy(() => import("../features/finance/FinancePage"));
const BackupPage = lazy(() => import("../features/settings/BackupPage"));
const ReportsPage = lazy(() => import("../features/reports/ReportsPage"));
import { PwaStatus } from "../components/PwaStatus";
const nav = [
  { to: "/", label: "Início", icon: House },
  { to: "/financas", label: "Finanças", icon: Wallet },
  { to: "/habitos", label: "Hábitos", icon: Heart },
  { to: "/metas", label: "Metas", icon: Target },
  { to: "/mais", label: "Mais", icon: Grid2X2 },
];
function Coming({
  title,
  phase,
  children,
}: {
  title: string;
  phase: string;
  children: string;
}) {
  return (
    <>
      <p className="eyebrow">SEU CAMINHO, NO SEU RITMO</p>
      <h1>{title}</h1>
      <section className="empty">
        <Sprout size={48} strokeWidth={1.3} />
        <h2>Um espaço para o que importa.</h2>
        <p>{children}</p>
        <span className="pill">Disponível na {phase}</span>
        <p className="muted small">Ainda não há registros neste módulo.</p>
        <Link className="text-link" to="/">
          Voltar para o início →
        </Link>
      </section>
    </>
  );
}
function Shell() {
  useMobileViewport();
  const { pathname } = useLocation();
  const result = useProfile();
  const profile = result?.profile;
  useEffect(() => {
    const query = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        profile?.theme === "dark" ||
        ((profile?.theme ?? "system") === "system" && query.matches)
          ? "dark"
          : "light";
    };
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, [profile?.theme]);
  return (
    <>
      <a
        className="skip"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          const main = document.getElementById("main");
          main?.focus();
          main?.scrollIntoView({ block: "start", behavior: "instant" });
        }}
      >
        Pular para o conteúdo
      </a>
      <aside className="sidebar">
        <Link to="/" className="brand">
          <span className="brand-icon">
            <Sprout />
          </span>
          <span>
            minha virada
            <span className="brand-sub">UM NOVO JEITO DE SE CUIDAR</span>
          </span>
        </Link>
        <nav aria-label="Navegação principal">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/"}>
              <n.icon size={21} />
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <Sprout size={27} />
          <p>
            Não precisa mudar tudo.
            <br />
            <strong>Só dar o próximo passo.</strong>
          </p>
          <span>SEU ESPAÇO · SEU RITMO</span>
        </div>
      </aside>
      <div className="workspace">
        <header>
          <Link className="mobile-brand" to="/">
            ✳ minha virada
          </Link>
          <span className="header-label">Uma vida com mais intenção.</span>
          <span className="local-badge">● Armazenamento local</span>
        </header>
        <main id="main" tabIndex={-1}>
          <PwaStatus />
          {!result ? (
            <p role="status">Abrindo seu espaço…</p>
          ) : result.error ? (
            <section className="empty" role="alert">
              <h1>Não foi possível abrir seu espaço.</h1>
              <p>{result.message} Seus dados não foram substituídos.</p>
              <button onClick={() => location.reload()}>
                Tentar novamente
              </button>
            </section>
          ) : (
            <Suspense fallback={<p role="status">Abrindo seu espaço…</p>}>
              <Routes>
                <Route path="/mais/boas-vindas" element={<OnboardingPage />} />
                <Route
                  path="/metas/*"
                  element={<FuturePage key={pathname} />}
                />
                <Route
                  path="/mais/renda"
                  element={<FuturePage key={pathname} />}
                />
                <Route
                  path="/financas/*"
                  element={<FinancePage key={pathname} />}
                />
                <Route path="/mais/backup" element={<BackupPage />} />
                <Route path="/mais/seguranca" element={<BackupPage />} />
                <Route path="/habitos" element={<HabitsPage />} />
                <Route path="/habitos/check-in" element={<CheckInPage />} />
                <Route path="/habitos/calendario" element={<CalendarPage />} />
                <Route
                  path="/habitos/acompanhamento"
                  element={<TrackingPage />}
                />
                <Route path="/habitos/tarefas" element={<TasksPage />} />
                <Route path="/mais/relatorios" element={<ReportsPage />} />
                <Route path="/" element={<Dashboard profile={profile} />} />
                <Route
                  path="/mais/configuracoes"
                  element={
                    <>
                      <p className="eyebrow">DO SEU JEITO</p>
                      <h1>
                        {profile
                          ? "Suas preferências"
                          : "Vamos preparar seu espaço?"}
                      </h1>
                      <p className="muted">
                        Tudo pode ser ajustado depois. Nenhum movimento
                        financeiro será criado.
                      </p>
                      <section className="panel">
                        <Link className="text-link" to="/mais/seguranca">
                          Seus dados e segurança →
                        </Link>
                        <Suspense
                          fallback={
                            <p role="status">Carregando formulário...</p>
                          }
                        >
                          <SettingsForm
                            key={profile?.updatedAt ?? "new"}
                            profile={profile}
                          />
                        </Suspense>
                      </section>
                    </>
                  }
                />
                <Route
                  path="/mais/privacidade"
                  element={
                    <section className="panel">
                      <h1>Privacidade, com clareza.</h1>
                      <p>
                        Este aplicativo guarda preferências e registros pessoais
                        em IndexedDB neste navegador. Não há analytics,
                        autenticação ou envio de dados pessoais.
                      </p>
                      <p>
                        IndexedDB não é criptografado. Quem tem acesso ao seu
                        dispositivo e perfil do navegador pode acessar os dados.
                        Limpar dados do site, perder o dispositivo ou usar
                        navegação privada pode causar perda de informações.
                      </p>
                      <p>
                        Em Configurações → Seus dados e segurança, exporte JSON
                        ou uma cópia criptografada por senha. O banco deste
                        navegador continua legível. Perder a senha impede abrir
                        um arquivo criptografado; guarde-a separadamente.
                      </p>
                      <h2>Instalar no Android</h2>
                      <p>
                        Abra o endereço HTTPS no Chrome, acesse o menu e escolha
                        “Instalar aplicativo” ou “Adicionar à tela inicial”. A
                        opção depende do navegador. Aguarde a confirmação de que
                        o app está pronto para uso offline antes de desconectar.
                      </p>
                      <h2>Cuidado e apoio</h2>
                      <p>
                        Quando sentir necessidade, buscar apoio de um
                        profissional de saúde pode ajudar. O aplicativo não
                        oferece diagnósticos ou acompanhamento médico.
                      </p>
                    </section>
                  }
                />
                <Route
                  path="/mais"
                  element={
                    <>
                      <p className="eyebrow">SEU ESPAÇO</p>
                      <h1>Mais possibilidades.</h1>
                      <div className="menu-list">
                        {[
                          [
                            "Primeiros passos",
                            "Comece ou retome no seu ritmo",
                            "boas-vindas",
                          ],
                          [
                            "Configurações",
                            "Planejamento e aparência",
                            "configuracoes",
                          ],
                          [
                            "Renda extra",
                            "Oportunidades e resultados reais",
                            "renda",
                          ],
                          [
                            "Relatórios",
                            "Hábitos, humor e atividades",
                            "relatorios",
                          ],
                          [
                            "Privacidade e instalação",
                            "Seus dados e seu dispositivo",
                            "privacidade",
                          ],
                          [
                            "Seus dados e segurança",
                            "Backup, armazenamento e integridade",
                            "seguranca",
                          ],
                        ].map(([title, sub, path]) => (
                          <Link to={"/mais/" + path} key={path}>
                            <div>
                              <h3>{title}</h3>
                              <p className="muted">{sub}</p>
                            </div>
                            <ArrowUpRight />
                          </Link>
                        ))}
                      </div>
                    </>
                  }
                />
                <Route
                  path="*"
                  element={
                    <Coming
                      title="Página não encontrada"
                      phase="navegação principal"
                    >
                      Escolha um dos destinos abaixo para continuar.
                    </Coming>
                  }
                />
              </Routes>
            </Suspense>
          )}
          <footer>
            Minha Virada <span>Construindo o amanhã, um dia de cada vez.</span>
          </footer>
        </main>
      </div>
    </>
  );
}
const router = createHashRouter([
  {
    path: "*",
    element: (
      <EditingGuard>
        <Shell />
      </EditingGuard>
    ),
  },
]);
export default function App() {
  return <RouterProvider router={router} />;
}

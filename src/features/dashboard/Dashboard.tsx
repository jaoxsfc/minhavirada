import { FutureSummary } from "../future/FutureSummary";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Sprout,
  Wallet,
  Heart,
  Target,
  ShieldCheck,
} from "lucide-react";
import type { Settings } from "../../db/database";
import { useLocalToday } from "../../hooks/useLocalToday";
import { parseLocal } from "../../lib/calendar";
import { FinancialSummary } from "../finance/FinancialSummary";
import { DailyOverview } from "./DailyOverview";
export function Dashboard({ profile }: { profile?: Settings }) {
  const today = useLocalToday();
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">SEU ESPAÇO DE RECOMEÇO</p>
          <h1>
            {profile ? `Olá, ${profile.name}.` : "Uma nova fase começa aqui."}
          </h1>
          <p className="muted">
            Pequenos passos. Mais equilíbrio. No seu ritmo.
          </p>
        </div>
        <span className="date">
          {new Intl.DateTimeFormat("pt-BR", {
            day: "numeric",
            month: "long",
            weekday: "long",
          }).format(parseLocal(today))}
        </span>
      </div>
      {!profile && (
        <section className="hero">
          <div>
            <span className="pill">UM PASSO DE CADA VEZ</span>
            <h2>
              O futuro que você quer
              <br />
              começa no seu hoje.
            </h2>
            <p>
              Organize o que importa e abra espaço
              <br />
              para a sua próxima conquista.
            </p>
            <Link className="cream-button" to="/mais/configuracoes">
              {profile ? "Revisar meu planejamento" : "Preparar meu caminho"}
              <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="plant" aria-hidden="true">
            <div className="orbit" />
            <Sprout size={140} strokeWidth={1} />
            <span>crescer leva tempo.</span>
          </div>
        </section>
      )}
      <DailyOverview profile={profile} />
      <FinancialSummary hideSensitive={profile?.hideSensitive !== false} />
      <FutureSummary />
      {!profile && (
        <>
          <div className="section-title">
            <h2>Seu ponto de partida</h2>
            <span>Dados deste dispositivo</span>
          </div>
          <div className="cards">
            {[
              {
                icon: Wallet,
                title: "Vida financeira",
                text: "Seu dinheiro, com clareza",
                sub: "Contas, cartões e ticket em seus lugares.",
                to: "/financas",
              },
              {
                icon: Heart,
                title: "Cuidado com você",
                text: "Cuidado diário, do seu jeito",
                sub: "Check-in, hábitos e rotina no seu ritmo.",
                to: "/habitos",
              },
              {
                icon: Target,
                title: "Planos que importam",
                text: "Uma conquista de cada vez",
                sub: "Objetivos, marcos e contribuições reais.",
                to: "/metas",
              },
            ].map((c) => (
              <Link className="card" to={c.to} key={c.title}>
                <div className="card-icon">
                  <c.icon size={22} />
                </div>
                <p className="muted">{c.title}</p>
                <h3>{c.text}</h3>
                <p className="muted small">{c.sub}</p>
                <ArrowUpRight className="corner" size={18} />
              </Link>
            ))}
          </div>
        </>
      )}
      <section className="note">
        <ShieldCheck size={26} />
        <div>
          <h3>Sua vida pessoal continua pessoal.</h3>
          <p>
            Preferências salvas no navegador. Sem conta, anúncios ou envio de
            dados pessoais.
          </p>
        </div>
      </section>
      <p className="home-help">
        <Link className="text-link" to="/mais/boas-vindas">
          {profile ? "Retomar meus primeiros passos" : "Conhecer meu espaço"} →
        </Link>{" "}
        ·{" "}
        <Link className="text-link" to="/mais/configuracoes">
          Minhas preferências
        </Link>
      </p>
    </>
  );
}

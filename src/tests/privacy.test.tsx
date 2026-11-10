import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { DailyOverview } from "../features/dashboard/DailyOverview";
import { defaults } from "../db/database";
import { localDate } from "../lib/date";
vi.mock("../hooks/useRoutines", () => ({
  useRoutines: () => ({
    error: false,
    checkIns: [
      {
        date: localDate(),
        consumed: false,
        mood: 3,
        energy: 3,
        exercise: false,
        activityMinutes: 0,
        projectMinutes: 0,
        craving: 4,
        triggers: "Gatilho privado",
        notes: "Nota privada",
      },
    ],
    habits: [],
    habitLogs: [],
    tasks: [],
    taskRecords: [],
    events: [],
    attempts: [{ id: "a", startDate: localDate(), createdAt: "" }],
  }),
}));
afterEach(cleanup);
it("oculta indicadores e textos sensíveis por padrão", () => {
  render(
    <MemoryRouter>
      <DailyOverview
        profile={{ ...defaults, name: "Ana", hideSensitive: true }}
      />
    </MemoryRouter>,
  );
  expect(screen.queryByTestId("sensitive-summary")).not.toBeInTheDocument();
  expect(screen.queryByText(/sem consumo/i)).not.toBeInTheDocument();
  expect(
    screen.queryByText(/Gatilho privado|Nota privada/),
  ).not.toBeInTheDocument();
  expect(screen.getByText("Check-in de hoje concluído")).toBeInTheDocument();
});
it("ausência de perfil não fornece consentimento", () => {
  render(
    <MemoryRouter>
      <DailyOverview />
    </MemoryRouter>,
  );
  expect(screen.queryByTestId("sensitive-summary")).not.toBeInTheDocument();
});
it("exibe somente o resumo sensível com consentimento explícito", () => {
  render(
    <MemoryRouter>
      <DailyOverview
        profile={{ ...defaults, name: "Ana", hideSensitive: false }}
      />
    </MemoryRouter>,
  );
  expect(screen.getByTestId("sensitive-summary")).toHaveTextContent(
    "1 dias consecutivos confirmados sem consumo",
  );
  expect(
    screen.queryByText(/Gatilho privado|Nota privada/),
  ).not.toBeInTheDocument();
});

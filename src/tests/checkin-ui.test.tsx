import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import CheckInPage from "../features/habits/CheckInPage";
const clock = vi.hoisted(() => ({ today: "2026-11-10" }));
vi.mock("../hooks/useLocalToday", () => ({ useLocalToday: () => clock.today }));
vi.mock("../hooks/useRoutines", () => ({
  useRoutines: () => ({
    error: false,
    checkIns: [],
    habits: [],
    habitLogs: [],
    tasks: [],
    taskRecords: [],
    attempts: [],
    events: [],
  }),
}));
afterEach(() => {
  cleanup();
  clock.today = "2026-11-10";
});
it("a virada do dia não muda a data nem apaga o check-in em edição", () => {
  const view = render(
    <MemoryRouter>
      <CheckInPage />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText("Observações (opcional)"), {
    target: { value: "Rascunho pessoal" },
  });
  clock.today = "2026-11-11";
  view.rerender(
    <MemoryRouter>
      <CheckInPage />
    </MemoryRouter>,
  );
  expect(screen.getByLabelText("Data do check-in")).toHaveValue("2026-11-10");
  expect(screen.getByLabelText("Observações (opcional)")).toHaveValue(
    "Rascunho pessoal",
  );
});

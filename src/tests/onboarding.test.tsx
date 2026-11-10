import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import OnboardingPage from "../features/settings/OnboardingPage";
import { saveSettings } from "../repositories/settings";
vi.mock("../repositories/settings", () => ({ saveSettings: vi.fn() }));
vi.mock("../hooks/useProfile", () => ({
  useProfile: () => ({ error: false, profile: undefined }),
}));
vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: () => ({ habits: 1, goals: 0, entries: 0, backup: false }),
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it("primeiro uso é pulável e não exige configurar módulos", () => {
  render(
    <MemoryRouter>
      <OnboardingPage />
    </MemoryRouter>,
  );
  expect(
    screen.getByRole("link", { name: /Pular por enquanto/ }),
  ).toHaveAttribute("href", "/");
  expect(screen.getAllByText("Já iniciado neste dispositivo")).toHaveLength(1);
  expect(saveSettings).not.toHaveBeenCalled();
});
it("valida nome e prepara apenas preferências, sem valores financeiros presumidos", async () => {
  render(
    <MemoryRouter>
      <OnboardingPage />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Preparar meu espaço" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Informe como quer ser chamado",
  );
  fireEvent.change(screen.getByLabelText("Como você quer ser chamado?"), {
    target: { value: "Ana" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Preparar meu espaço" }));
  await waitFor(() =>
    expect(saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Ana",
        salary: 0,
        benefit: 0,
        fuel: 0,
        food: 0,
        hideSensitive: true,
        theme: "system",
      }),
    ),
  );
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Seu espaço está preparado",
  );
});

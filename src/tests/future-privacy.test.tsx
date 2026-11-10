import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { FutureSummary } from "../features/future/FutureSummary";
const state = vi.hoisted(() => ({ hide: true as boolean | undefined }));
vi.mock("../hooks/useProfile", () => ({
  useProfile: () => ({
    profile:
      state.hide === undefined ? undefined : { hideSensitive: state.hide },
  }),
}));
vi.mock("../hooks/useFuture", () => ({
  useFuture: () => ({
    error: false,
    future: {
      goals: [{ id: "goal", title: "Título privado", status: "active" }],
      movements: [
        {
          goalId: "goal",
          accountId: "bank",
          kind: "allocate",
          amount: 123456,
          date: "2024-01-01",
        },
      ],
    },
  }),
}));
afterEach(() => {
  cleanup();
  state.hide = true;
});
it("home mantém resumo compacto sem valores ou detalhes privados por padrão", () => {
  render(
    <MemoryRouter>
      <FutureSummary />
    </MemoryRouter>,
  );
  expect(screen.getByText(/1 objetivo/)).toBeInTheDocument();
  expect(screen.queryByText(/1.234,56|Título privado/)).not.toBeInTheDocument();
});
it("ausência de perfil não autoriza exposição de valores", () => {
  state.hide = undefined;
  render(
    <MemoryRouter>
      <FutureSummary />
    </MemoryRouter>,
  );
  expect(screen.queryByText(/1.234,56/)).not.toBeInTheDocument();
});
it("consentimento permite total confirmado, sem detalhes das metas na home", () => {
  state.hide = false;
  render(
    <MemoryRouter>
      <FutureSummary />
    </MemoryRouter>,
  );
  expect(screen.getByText(/1.234,56/)).toBeInTheDocument();
  expect(screen.queryByText(/Título privado/)).not.toBeInTheDocument();
});

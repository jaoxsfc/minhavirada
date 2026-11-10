import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { FinancialSummary } from "../features/finance/FinancialSummary";
import { emptyFinance, financeDefaults } from "../features/finance/models";
import { localDate } from "../lib/date";
vi.mock("../hooks/useFinance", () => ({
  useFinance: () => ({
    error: false,
    data: {
      ...emptyFinance,
      settings: financeDefaults,
      accounts: [
        {
          id: "bank",
          type: "checking",
          openingBalance: 123456,
          openingDate: localDate(),
          status: "active",
        },
      ],
      entries: [],
      payments: [],
      transfers: [],
    },
  }),
}));
afterEach(cleanup);
it("saldo da home não aparece no DOM nem com ausência de preferências", () => {
  render(
    <MemoryRouter>
      <FinancialSummary />
    </MemoryRouter>,
  );
  expect(screen.getByText("Valor oculto")).toBeInTheDocument();
  expect(screen.queryByText(/1.234,56/)).not.toBeInTheDocument();
});
it("consentimento explícito permite o saldo confirmado e identifica a simulação", () => {
  render(
    <MemoryRouter>
      <FinancialSummary hideSensitive={false} />
    </MemoryRouter>,
  );
  expect(screen.getAllByText(/1.234,56/).length).toBeGreaterThan(0);
  expect(screen.getByText(/simulação/)).toBeInTheDocument();
});

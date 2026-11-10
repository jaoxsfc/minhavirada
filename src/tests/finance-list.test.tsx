import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import FinanceEntries from "../features/finance/FinanceEntries";
import { emptyFinance, type FinanceEntry } from "../features/finance/models";
import { localDate } from "../lib/date";
afterEach(cleanup);
it("listas longas carregam por etapas sem limitar a busca ou alterar dados", () => {
  const today = localDate();
  const entries: FinanceEntry[] = Array.from({ length: 51 }, (_, i) => ({
    id: crypto.randomUUID(),
    description: `Conta ${i}`,
    kind: "expense",
    accountId: crypto.randomUUID(),
    categoryId: crypto.randomUUID(),
    amount: 100,
    dueDate: today,
    competence: today,
    status: "pending",
    revision: 1,
  }));
  const data = { ...emptyFinance, entries };
  const before = JSON.stringify(data);
  render(<FinanceEntries data={data} onOpen={vi.fn()} />);
  expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(50);
  fireEvent.click(
    screen.getByRole("button", { name: "Mostrar mais lançamentos" }),
  );
  expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(51);
  fireEvent.change(screen.getByLabelText("Pesquisar descrição"), {
    target: { value: "Conta 50" },
  });
  expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(1);
  expect(screen.getByRole("heading", { name: "Conta 50" })).toBeInTheDocument();
  expect(JSON.stringify(data)).toBe(before);
});

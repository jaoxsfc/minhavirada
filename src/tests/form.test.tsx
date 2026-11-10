import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SettingsForm } from "../components/SettingsForm";
import { saveSettings } from "../repositories/settings";
vi.mock("../repositories/settings", () => ({ saveSettings: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it("mostra erro de nome e não submete formulário vazio", async () => {
  render(<SettingsForm />);
  fireEvent.click(screen.getByRole("button", { name: "Começar minha virada" }));
  await waitFor(() =>
    expect(screen.getByText("Informe seu nome.")).toBeInTheDocument(),
  );
});
it("converte reais com vírgula em centavos antes de salvar", async () => {
  render(<SettingsForm />);
  fireEvent.change(
    screen.getByRole("textbox", { name: "Como você quer ser chamado?" }),
    { target: { value: "Ana" } },
  );
  fireEvent.change(
    screen.getByRole("textbox", { name: "Salário planejado (R$)" }),
    { target: { value: "2500,75" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Começar minha virada" }));
  await waitFor(() =>
    expect(saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ salary: 250075, name: "Ana" }),
    ),
  );
});
it("exibe falha de armazenamento e permite tentar novamente", async () => {
  vi.mocked(saveSettings).mockRejectedValueOnce(
    new Error("Storage unavailable"),
  );
  render(<SettingsForm />);
  fireEvent.change(
    screen.getByRole("textbox", { name: "Como você quer ser chamado?" }),
    { target: { value: "Ana" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Começar minha virada" }));
  await waitFor(() =>
    expect(screen.getByText(/Não foi possível salvar/)).toBeInTheDocument(),
  );
  expect(
    screen.getByRole("button", { name: "Começar minha virada" }),
  ).toBeEnabled();
});

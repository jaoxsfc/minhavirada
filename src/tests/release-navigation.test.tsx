import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import {
  createMemoryRouter,
  RouterProvider,
  Link,
  Outlet,
} from "react-router-dom";
import { useState } from "react";
import { EditingGuard, useEditingGuard } from "../components/EditingGuard";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(cleanup);
function Editor() {
  const [value, setValue] = useState("");
  const discard = useEditingGuard(value !== "");
  return (
    <>
      <h1>Registro</h1>
      <label>
        Nota
        <input value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
      <button onClick={() => setValue("")}>Salvar</button>
      <button onClick={() => discard(() => setValue(""))}>
        Cancelar edição
      </button>
      <Link to="/next">Outra página</Link>
    </>
  );
}
function setup() {
  const router = createMemoryRouter([
    {
      element: (
        <EditingGuard>
          <Outlet />
        </EditingGuard>
      ),
      children: [
        { path: "/", element: <Editor /> },
        { path: "/next", element: <h1>Destino</h1> },
      ],
    },
  ]);
  render(<RouterProvider router={router} />);
  return router;
}
it("cancelar navegação mantém o conteúdo e confirmar descarta apenas o rascunho", async () => {
  setup();
  fireEvent.change(screen.getByLabelText("Nota"), {
    target: { value: "Meu registro" },
  });
  fireEvent.click(screen.getByText("Outra página"));
  expect(await screen.findByRole("dialog")).toBeVisible();
  fireEvent.click(screen.getByText("Continuar editando"));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(screen.getByLabelText("Nota")).toHaveValue("Meu registro");
  fireEvent.click(screen.getByText("Outra página"));
  fireEvent.click(await screen.findByText("Descartar e sair"));
  expect(
    await screen.findByRole("heading", { name: "Destino" }),
  ).toBeInTheDocument();
});
it("salvar remove bloqueio de navegação e de fechamento", async () => {
  setup();
  fireEvent.change(screen.getByLabelText("Nota"), {
    target: { value: "Nota" },
  });
  const before = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(before);
  expect(before.defaultPrevented).toBe(true);
  fireEvent.click(screen.getByText("Salvar"));
  const after = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(after);
  expect(after.defaultPrevented).toBe(false);
  fireEvent.click(screen.getByText("Outra página"));
  expect(
    await screen.findByRole("heading", { name: "Destino" }),
  ).toBeInTheDocument();
});
it("fechar um editor exige confirmação somente se foi alterado", () => {
  setup();
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  fireEvent.click(screen.getByText("Cancelar edição"));
  expect(confirm).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Nota"), {
    target: { value: "Nota" },
  });
  fireEvent.click(screen.getByText("Cancelar edição"));
  expect(screen.getByLabelText("Nota")).toHaveValue("Nota");
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByText("Cancelar edição"));
  expect(screen.getByLabelText("Nota")).toHaveValue("");
  confirm.mockRestore();
});

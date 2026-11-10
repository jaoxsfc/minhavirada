import Dexie from "dexie";
import { afterEach, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { AppDatabase } from "../db/database";
import {
  inspectStorage,
  requestPersistence,
  storageMessage,
} from "../services/storage";
import { PwaStatus } from "../components/PwaStatus";
const pwa = vi.hoisted(() => ({ update: vi.fn(), setRefresh: vi.fn() }));
vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({
    needRefresh: [true, pwa.setRefresh],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: pwa.update,
  }),
}));
const originalStorage = Object.getOwnPropertyDescriptor(navigator, "storage");
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  pwa.update.mockClear();
  pwa.setRefresh.mockClear();
  if (originalStorage)
    Object.defineProperty(navigator, "storage", originalStorage);
  else Reflect.deleteProperty(navigator, "storage");
});
it("diagnóstico confirma leitura/gravação sem modificar registros do app", async () => {
  const db = new AppDatabase(crypto.randomUUID());
  try {
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: {
        persisted: async () => false,
        estimate: async () => ({ usage: 1024, quota: 4096 }),
        persist: vi.fn(async () => true),
      },
    });
    const status = await inspectStorage(db);
    expect(status.available).toBe(true);
    expect(status.writable).toBe(true);
    expect(status.usage).toBe(1024);
    expect(navigator.storage.persist).not.toHaveBeenCalled();
    expect(await db.backupState.count()).toBe(0);
    expect(
      (await Dexie.getDatabaseNames()).some((n) =>
        n.startsWith("minha-virada-probe-"),
      ),
    ).toBe(false);
  } finally {
    await db.delete();
  }
});
it("falha de leitura é reportada sem apagar dados", async () => {
  const db = new AppDatabase(crypto.randomUUID());
  await db.open();
  vi.spyOn(db.settings, "count").mockRejectedValue(
    new DOMException("sensitive-message", "SecurityError"),
  );
  const status = await inspectStorage(db);
  expect(status.available).toBe(false);
  expect(status.message).toContain("permissões");
  expect(status.message).not.toContain("sensitive-message");
  await db.delete();
});
it("quota na gravação de teste não é confundida com leitura disponível", async () => {
  const db = new AppDatabase(crypto.randomUUID());
  await db.open();
  const original = Dexie.prototype.table;
  vi.spyOn(Dexie.prototype, "table").mockImplementation(function (
    this: Dexie,
    ...args: unknown[]
  ) {
    const name = String(args[0]);
    if (name === "probe")
      throw new DOMException("simulated", "QuotaExceededError");
    return original.call(this, name);
  });
  const status = await inspectStorage(db);
  expect(status.available).toBe(true);
  expect(status.writable).toBe(false);
  expect(status.message).toContain("espaço");
  vi.restoreAllMocks();
  await db.delete();
});
it("persistência somente é solicitada por chamada explícita e respeita recusa", async () => {
  const persist = vi.fn(async () => false);
  Object.defineProperty(navigator, "storage", {
    configurable: true,
    value: { persist },
  });
  expect(persist).not.toHaveBeenCalled();
  expect(await requestPersistence()).toBe(false);
  expect(persist).toHaveBeenCalledTimes(1);
});
it("navegador sem persistência oferece mensagem simples", async () => {
  Object.defineProperty(navigator, "storage", {
    configurable: true,
    value: undefined,
  });
  await expect(requestPersistence()).rejects.toThrow("não oferece");
});
it("erros de quota, migração e permissão são seguros e não expõem mensagens internas", () => {
  expect(
    storageMessage({
      name: "OpenFailedError",
      inner: new DOMException("secret", "QuotaExceededError"),
    }),
  ).not.toContain("secret");
  expect(
    storageMessage(new DOMException("secret", "QuotaExceededError")),
  ).toContain("espaço");
  expect(
    storageMessage({
      name: "OpenFailedError",
      inner: new DOMException("secret", "QuotaExceededError"),
    }),
  ).toContain("espaço");
  expect(storageMessage({ name: "VersionError" })).toContain("versão");
  expect(storageMessage({ name: "UpgradeError" })).toContain(
    "não foram apagados",
  );
  expect(storageMessage(new Error("business"))).toBeUndefined();
});
it("nova versão avisa sem atualizar automaticamente ou interromper rascunho", async () => {
  render(
    <>
      <PwaStatus />
      <form>
        <label>
          Rascunho de teste
          <input defaultValue="" />
        </label>
      </form>
    </>,
  );
  const input = screen.getByLabelText("Rascunho de teste");
  fireEvent.input(input, { target: { value: "Texto ainda em edição" } });
  expect(pwa.update).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
  expect(
    screen.getByRole("alertdialog", { name: "Atualizar aplicativo" }),
  ).toBeInTheDocument();
  expect(pwa.update).not.toHaveBeenCalled();
  expect(input).toHaveValue("Texto ainda em edição");
  fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(pwa.update).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Já salvei, atualizar agora" }),
  );
  await waitFor(() => expect(pwa.update).toHaveBeenCalledExactlyOnceWith(true));
});
it("atualização sem edição continua exigindo ação do usuário", async () => {
  render(<PwaStatus />);
  expect(pwa.update).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
  await waitFor(() => expect(pwa.update).toHaveBeenCalledExactlyOnceWith(true));
});

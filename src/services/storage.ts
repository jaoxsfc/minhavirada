import Dexie from "dexie";
import { db, type AppDatabase } from "../db/database";
export function storageMessage(error: unknown): string | undefined {
  let current = error;
  const names = new Set<string>();
  for (
    let depth = 0;
    current && typeof current === "object" && depth < 5;
    depth++
  ) {
    const value = current as {
      name?: string;
      inner?: unknown;
      cause?: unknown;
    };
    if (value.name) names.add(value.name);
    current = value.inner ?? value.cause;
  }
  if (names.has("QuotaExceededError"))
    return "O espaço de armazenamento acabou. Nenhuma gravação parcial foi confirmada. Guarde uma cópia externa e libere espaço no dispositivo sem limpar os dados deste app.";
  if (
    ["VersionError", "UpgradeError", "BlockedError"].some((n) => names.has(n))
  )
    return "Não foi possível abrir esta versão do banco. Feche outras abas e reabra a versão mais recente. Os registros não foram apagados.";
  if (
    [
      "SecurityError",
      "InvalidStateError",
      "DatabaseClosedError",
      "OpenFailedError",
      "UnknownError",
      "MissingAPIError",
    ].some((n) => names.has(n))
  )
    return "O armazenamento não está disponível. Confira as permissões do navegador e tente novamente. Não limpe os dados do aplicativo.";
}
export interface StorageStatus {
  available: boolean;
  writable: boolean;
  persistent: boolean | null;
  canRequestPersistence: boolean;
  usage?: number;
  quota?: number;
  message: string;
}
export async function inspectStorage(
  database: AppDatabase = db,
): Promise<StorageStatus> {
  const result: StorageStatus = {
    available: false,
    writable: false,
    persistent: null,
    canRequestPersistence: !!navigator.storage?.persist,
    message: "",
  };
  let probe: Dexie | undefined;
  try {
    await database.settings.count();
    result.available = true;
    // Disposable database contains no user data; the application database is read-only here.
    probe = new Dexie("minha-virada-probe-" + crypto.randomUUID());
    probe.version(1).stores({ probe: "id" });
    await probe.table("probe").put({ id: "test", value: 1 });
    result.writable = (await probe.table("probe").get("test"))?.value === 1;
  } catch (error) {
    result.message =
      storageMessage(error) ??
      "Não foi possível confirmar a gravação neste navegador. Seus dados não foram apagados.";
  } finally {
    if (probe) {
      probe.close();
      try {
        await probe.delete();
      } catch {
        /* A probe contains only a constant, never user records. */
      }
    }
  }
  try {
    result.persistent = (await navigator.storage?.persisted?.()) ?? null;
  } catch {
    result.persistent = null;
  }
  try {
    const e = await navigator.storage?.estimate?.();
    result.usage = e?.usage;
    result.quota = e?.quota;
  } catch {
    /* Estimates are optional. */
  }
  return result;
}
export async function requestPersistence() {
  if (!navigator.storage?.persist)
    throw new Error(
      "Este navegador não oferece a solicitação de armazenamento persistente.",
    );
  return navigator.storage.persist();
}

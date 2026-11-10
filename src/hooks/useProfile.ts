import { storageMessage } from "../services/storage";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/database";
export function useProfile() {
  return useLiveQuery(async () => {
    try {
      return { profile: await db.settings.get("profile"), error: false };
    } catch (error) {
      return {
        profile: undefined,
        error: true,
        message:
          storageMessage(error) ??
          "Não foi possível ler este armazenamento. Reabra o navegador sem limpar os dados do aplicativo.",
      };
    }
  }, []);
}

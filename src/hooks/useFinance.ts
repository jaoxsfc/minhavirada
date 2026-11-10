import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/database";
import { readFinance, financeTableNames } from "../repositories/finance-data";
export function useFinance() {
  return useLiveQuery(async () => {
    try {
      return {
        error: false,
        data: await db.transaction(
          "r",
          financeTableNames.map((n) => db.table(n)),
          () => readFinance(),
        ),
      };
    } catch {
      return { error: true, data: undefined };
    }
  }, []);
}

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/database";
import { futureTableNames } from "../features/future/models";
import { readFuture } from "../repositories/future-data";
import { readFinance, financeTableNames } from "../repositories/finance-data";
export function useFuture() {
  return useLiveQuery(async () => {
    try {
      return await db.transaction(
        "r",
        [...futureTableNames, ...financeTableNames, "tasks", "taskRecords"].map(
          (n) => db.table(n),
        ),
        async () => ({
          error: false,
          future: await readFuture(),
          finance: await readFinance(),
          tasks: await db.tasks.toArray(),
          taskRecords: await db.taskRecords.toArray(),
        }),
      );
    } catch {
      return {
        error: true,
        future: undefined,
        finance: undefined,
        tasks: [],
        taskRecords: [],
      };
    }
  }, []);
}

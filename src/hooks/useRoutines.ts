import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/database";
export function useRoutines() {
  return useLiveQuery(async () => {
    try {
      return {
        error: false,
        checkIns: await db.checkIns.toArray(),
        habits: await db.habits.toArray(),
        habitLogs: await db.habitLogs.toArray(),
        tasks: await db.tasks.toArray(),
        taskRecords: await db.taskRecords.toArray(),
        attempts: await db.attempts.orderBy("startDate").toArray(),
        events: await db.routineEvents.orderBy("id").reverse().toArray(),
      };
    } catch {
      return {
        error: true,
        checkIns: [],
        habits: [],
        habitLogs: [],
        tasks: [],
        taskRecords: [],
        attempts: [],
        events: [],
      };
    }
  }, []);
}
export type RoutineData = NonNullable<ReturnType<typeof useRoutines>>;

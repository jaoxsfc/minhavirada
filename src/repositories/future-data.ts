import { db, type AppDatabase } from "../db/database";
import type { FutureData } from "../features/future/models";
export async function readFuture(
  database: AppDatabase = db,
): Promise<FutureData> {
  return {
    goals: await database.goals.toArray(),
    milestones: await database.goalMilestones.toArray(),
    movements: await database.goalMovements.toArray(),
    projects: await database.projects.toArray(),
    receipts: await database.projectReceipts.toArray(),
    timeEntries: await database.projectTimeEntries.toArray(),
    taskLinks: await database.futureTaskLinks.toArray(),
  };
}

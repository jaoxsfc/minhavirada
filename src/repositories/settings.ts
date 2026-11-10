import {
  db,
  settingsSchema,
  type Settings,
  type AppDatabase,
} from "../db/database";
export async function saveSettings(
  input: Settings,
  database: AppDatabase = db,
) {
  const value = settingsSchema.parse({
    ...input,
    updatedAt: new Date().toISOString(),
  });
  await database.transaction(
    "rw",
    database.settings,
    database.audit,
    async () => {
      await database.settings.put(value);
      await database.audit.add({
        entity: "settings",
        action: "saved",
        at: value.updatedAt,
      });
    },
  );
  return value;
}

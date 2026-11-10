import { afterEach, describe, expect, it } from "vitest";
import { AppDatabase, defaults } from "../db/database";
import { saveSettings } from "../repositories/settings";
import { localDate } from "../lib/date";
const databases: AppDatabase[] = [];
afterEach(async () => {
  for (const db of databases) await db.delete();
  databases.length = 0;
});
function create() {
  const db = new AppDatabase(crypto.randomUUID());
  databases.push(db);
  return db;
}
describe("Preferências locais", () => {
  it("persiste centavos e trilha de alteração sem gerar movimentos", async () => {
    const db = create();
    await saveSettings({ ...defaults, name: "Ana" }, db);
    expect((await db.settings.get("profile"))?.salary).toBe(250000);
    expect(await db.audit.count()).toBe(1);
    expect(db.tables.map((t) => t.name)).not.toContain("transactions");
    expect(await db.checkIns.count()).toBe(0);
  });
  it("mantém os dados após reabrir o banco", async () => {
    const db = create();
    await saveSettings({ ...defaults, name: "Ana" }, db);
    db.close();
    await db.open();
    expect((await db.settings.get("profile"))?.name).toBe("Ana");
    expect(db.verno).toBe(4);
  });
  it("rejeita centavos fracionários e não altera o banco", async () => {
    const db = create();
    await expect(
      saveSettings({ ...defaults, name: "Ana", salary: 1.5 }, db),
    ).rejects.toThrow();
    expect(await db.settings.count()).toBe(0);
    expect(await db.audit.count()).toBe(0);
  });
  it("atualiza um único perfil preservando auditoria", async () => {
    const db = create();
    await saveSettings({ ...defaults, name: "Ana" }, db);
    await saveSettings({ ...defaults, name: "Bia" }, db);
    expect(await db.settings.count()).toBe(1);
    expect(await db.audit.count()).toBe(2);
  });
  it("serializa a data local sem conversão UTC", () => {
    expect(localDate(new Date(2026, 10, 10, 23, 59))).toBe("2026-11-10");
  });
  it("reverte a alteração do perfil se a auditoria falhar", async () => {
    const db = create();
    await saveSettings({ ...defaults, name: "Ana" }, db);
    db.audit.hook("creating", () => {
      throw new Error("Write failed");
    });
    await expect(
      saveSettings({ ...defaults, name: "Bia" }, db),
    ).rejects.toThrow("Write failed");
    expect((await db.settings.get("profile"))?.name).toBe("Ana");
    expect(await db.audit.count()).toBe(1);
  });
});

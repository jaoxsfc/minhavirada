import { financeDefaults } from "../features/finance/models";
import { saveCard, addPurchase } from "../services/finance/commands";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { financeFixture, uid, refDate, type Fixture } from "./finance-fixtures";
import { backupTables, assertBackupCoverage } from "../db/backup-registry";
import {
  exportBackup,
  validateBackup,
  restoreBackup,
  backupChecksum,
  confirmBackupSaved,
  eraseLocalData,
  contentHash,
  rawSnapshot,
  MAX_BACKUP_BYTES,
} from "../services/backup";
import {
  encryptBackup,
  decryptBackup,
  inspectEncryptedBackup,
  parseBackupText,
  MAX_IMPORT_BYTES,
  PBKDF2_ITERATIONS,
} from "../services/backup-crypto";
import { auditIntegrity } from "../services/integrity";
import { structuralIssues } from "../services/integrity-checks";
import { saveEntry, payTarget } from "../services/finance/commands";
import { readFinance } from "../repositories/finance-data";
import { bankBalance, benefitBalance } from "../services/finance/calculations";
import { db as defaultDb, AppDatabase } from "../db/database";
let f: Fixture;
const pass = "frase longa de teste 2026";
beforeEach(async () => {
  f = await financeFixture();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await f.db.delete();
});
async function resign(file: Awaited<ReturnType<typeof exportBackup>>) {
  file.recordCounts = Object.fromEntries(
    Object.entries(file.data).map(([n, r]) => [n, r.length]),
  );
  const { checksum, ...body } = file;
  void checksum;
  return { ...body, checksum: await backupChecksum(body) };
}
it("registro central cobre exatamente todas as tabelas e schemas", async () => {
  expect([...backupTables].sort()).toEqual(
    f.db.tables.map((t) => t.name).sort(),
  );
  expect(() => assertBackupCoverage(f.db)).not.toThrow();
  const spy = vi
    .spyOn(f.db, "tables", "get")
    .mockReturnValue([
      ...f.db.tables,
      { name: "forgotten" },
    ] as typeof f.db.tables);
  expect(() => assertBackupCoverage(f.db)).toThrow("incompleto");
  spy.mockRestore();
});
it("exportação contém metadados, UUID e contagem de todas as 35 tabelas", async () => {
  const file = await exportBackup(f.db);
  expect(file.formatVersion).toBe(1);
  expect(file.schemaVersion).toBe(4);
  expect(file.appVersion).toBe("1.0.0-rc.1");
  expect(file.backupId).toMatch(/^[a-f0-9-]{36}$/);
  expect(Object.keys(file.data)).toHaveLength(35);
  for (const name of backupTables)
    expect(file.recordCounts?.[name]).toBe(file.data[name].length);
  expect((await exportBackup(f.db)).backupId).not.toBe(file.backupId);
});
it("pontos de recuperação são exportados de forma plana e preservados na restauração", async () => {
  const file = await exportBackup(f.db);
  await restoreBackup(file, "RESTAURAR", f.db);
  const after = await exportBackup(f.db);
  expect(after.data.recoverySnapshots).toHaveLength(1);
  const point = after.data.recoverySnapshots[0] as { json: string };
  expect(JSON.parse(point.json).data.recoverySnapshots).toEqual([]);
  await restoreBackup(after, "RESTAURAR", f.db);
  expect(await f.db.recoverySnapshots.count()).toBe(2);
});
it("criptografa e descriptografa com Web Crypto sem expor dados no envelope", async () => {
  const file = await exportBackup(f.db),
    sealed = await encryptBackup(file, pass);
  expect(sealed.kdf.iterations).toBe(PBKDF2_ITERATIONS);
  expect(sealed.cipher.keyBits).toBe(256);
  expect(sealed.cipher.tagBits).toBe(128);
  expect(JSON.stringify(sealed)).not.toContain("Banco de teste");
  expect(JSON.stringify(sealed)).not.toContain(pass);
  expect(await decryptBackup(sealed, pass)).toEqual(await validateBackup(file));
});
it("salt e IV são novos em cada exportação, mesmo conteúdo e senha", async () => {
  const file = await exportBackup(f.db),
    a = await encryptBackup(file, pass),
    b = await encryptBackup(file, pass);
  expect(a.kdf.salt).not.toBe(b.kdf.salt);
  expect(a.cipher.iv).not.toBe(b.cipher.iv);
  expect(a.ciphertext).not.toBe(b.ciphertext);
});
it("senha errada não altera banco nem cria recuperação", async () => {
  const file = await exportBackup(f.db),
    sealed = await encryptBackup(file, pass),
    before = await rawSnapshot(f.db);
  await expect(decryptBackup(sealed, "senha errada")).rejects.toThrow(
    "senha incorreta",
  );
  expect(await rawSnapshot(f.db)).toEqual(before);
});
it.each(["ciphertext", "salt", "iv"] as const)(
  "autenticação rejeita adulteração em %s",
  async (field) => {
    const sealed = await encryptBackup(await exportBackup(f.db), pass);
    const mutate = (s: string) => (s[0] === "A" ? "B" : "A") + s.slice(1);
    if (field === "ciphertext") sealed.ciphertext = mutate(sealed.ciphertext);
    else if (field === "salt") sealed.kdf.salt = mutate(sealed.kdf.salt);
    else sealed.cipher.iv = mutate(sealed.cipher.iv);
    await expect(decryptBackup(sealed, pass)).rejects.toThrow();
  },
);
it("rejeita senha curta, custo não suportado, versão futura e parâmetros desconhecidos", async () => {
  const file = await exportBackup(f.db);
  await expect(encryptBackup(file, "curta")).rejects.toThrow("12");
  const sealed = await encryptBackup(file, pass);
  expect(() => inspectEncryptedBackup({ ...sealed, formatVersion: 9 })).toThrow(
    "não suportada",
  );
  expect(() =>
    inspectEncryptedBackup({
      ...sealed,
      kdf: { ...sealed.kdf, iterations: 999999999 },
    }),
  ).toThrow();
  expect(() =>
    inspectEncryptedBackup({ ...sealed, unknown: "campo" }),
  ).toThrow();
});
it("rejeita JSON truncado, ciphertext truncado e base64 inválido", async () => {
  expect(() => parseBackupText('{"format":')).toThrow("incompleto");
  const sealed = await encryptBackup(await exportBackup(f.db), pass);
  await expect(
    decryptBackup(
      { ...sealed, ciphertext: sealed.ciphertext.slice(0, -4) },
      pass,
    ),
  ).rejects.toThrow();
  expect(() =>
    inspectEncryptedBackup({ ...sealed, ciphertext: "!!!!" }),
  ).toThrow();
});
it("limites de entrada são aplicados antes de decifrar", () => {
  expect(MAX_IMPORT_BYTES).toBe(28 * 1024 * 1024);
  expect(MAX_BACKUP_BYTES).toBe(20 * 1024 * 1024);
  expect(() => parseBackupText(" ".repeat(MAX_IMPORT_BYTES + 1))).toThrow(
    "28 MB",
  );
});
it("rejeita formato futuro e contagens incompatíveis, mesmo com checksum refeito", async () => {
  const file = await exportBackup(f.db);
  await expect(validateBackup({ ...file, formatVersion: 2 })).rejects.toThrow(
    "não suportada",
  );
  await expect(validateBackup({ ...file, schemaVersion: 5 })).rejects.toThrow(
    "não suportada",
  );
  file.recordCounts!.financeAccounts = 99;
  const { checksum, ...body } = file;
  void checksum;
  await expect(
    validateBackup({ ...body, checksum: await backupChecksum(body) }),
  ).rejects.toThrow("Contagem");
});
it.each([3, 4])(
  "fixture representativa v%s converte preservando IDs, saldo e saúde",
  async (version) => {
    const file = JSON.parse(
      readFileSync(
        new URL(
          "../../e2e/fixtures/backup-v" + version + ".json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const preview = await validateBackup(file),
      again = await validateBackup(file);
    expect(preview.checksum).toBe(again.checksum);
    expect(preview.backupId).toBe(again.backupId);
    const before = await rawSnapshot(f.db);
    expect(await rawSnapshot(f.db)).toEqual(before);
    await restoreBackup(preview, "RESTAURAR", f.db);
    const data = await readFinance(f.db);
    expect(bankBalance(data, refDate)).toBe(120000);
    expect(benefitBalance(data, refDate)).toBe(50000);
    expect((await f.db.checkIns.get(refDate))?.consumed).toBe(false);
    expect(data.payments[0].id).toBe(file.data.financePayments[0].id);
    expect(await f.db.goals.count()).toBe(version === 4 ? 1 : 0);
  },
);
it("campos desconhecidos de registros e de objetos aninhados não são descartados", async () => {
  const file = await exportBackup(f.db);
  (file.data.financeAccounts[0] as Record<string, unknown>).newField = "futuro";
  await expect(validateBackup(await resign(file))).rejects.toThrow(
    "campos desconhecidos",
  );
  const raw = JSON.parse(readFileSync("e2e/fixtures/backup-v4.json", "utf8"));
  raw.data.settings[0].secretFutureField = { value: 1 };
  const { checksum, ...body } = raw;
  void checksum;
  raw.checksum = await backupChecksum(body);
  await expect(validateBackup(raw)).rejects.toThrow("campos desconhecidos");
});
it("restauração concorrente do mesmo arquivo é idempotente de forma persistente", async () => {
  const file = await exportBackup(f.db);
  await Promise.all([
    restoreBackup(file, "RESTAURAR", f.db),
    restoreBackup(file, "RESTAURAR", f.db),
  ]);
  expect(await f.db.recoverySnapshots.count()).toBe(1);
  f.db.close();
  await f.db.open();
  await restoreBackup(file, "RESTAURAR", f.db);
  expect(await f.db.recoverySnapshots.count()).toBe(1);
});
it("após nova alteração, o usuário pode restaurar a mesma cópia intencionalmente", async () => {
  const file = await exportBackup(f.db);
  await restoreBackup(file, "RESTAURAR", f.db);
  await saveEntry(f.entry, uid(), f.db);
  await restoreBackup(file, "RESTAURAR", f.db);
  expect(await f.db.financeEntries.count()).toBe(0);
  expect(await f.db.recoverySnapshots.count()).toBe(2);
});
it("quota ao preservar recuperação bloqueia substituição e mantém dados anteriores", async () => {
  const file = await exportBackup(f.db);
  await saveEntry(f.entry, uid(), f.db);
  f.db.recoverySnapshots.hook("creating", () => {
    throw new DOMException("simulated", "QuotaExceededError");
  });
  const before = await rawSnapshot(f.db);
  await expect(restoreBackup(file, "RESTAURAR", f.db)).rejects.toThrow(
    "Nada foi substituído",
  );
  expect(await rawSnapshot(f.db)).toEqual(before);
});
it("falha depois de limpar tabelas reverte tudo, inclusive o ponto de recuperação", async () => {
  await saveEntry(f.entry, uid(), f.db);
  const file = await exportBackup(f.db);
  await payTarget(
    {
      id: uid(),
      targetType: "entry",
      targetId: f.entry.id,
      accountId: f.bank.id,
      amount: 10000,
      date: refDate,
      eligibilityConfirmed: false,
    },
    uid(),
    f.db,
  );
  const before = await rawSnapshot(f.db);
  f.db.financeAccounts.hook("creating", () => {
    throw new Error("simulated-write-failure");
  });
  await expect(restoreBackup(file, "RESTAURAR", f.db)).rejects.toThrow(
    "simulated-write-failure",
  );
  expect(await rawSnapshot(f.db)).toEqual(before);
});
it("arquivo inválido não modifica banco nem histórico de recuperação", async () => {
  const file = await exportBackup(f.db);
  file.data.financePayments = [
    {
      id: uid(),
      targetType: "entry",
      targetId: uid(),
      accountId: f.bank.id,
      amount: 100,
      date: refDate,
      status: "active",
    },
  ];
  const before = await rawSnapshot(f.db);
  await expect(
    restoreBackup(await resign(file), "RESTAURAR", f.db),
  ).rejects.toThrow();
  expect(await rawSnapshot(f.db)).toEqual(before);
});
it("auditoria íntegra é não destrutiva e não mostra dados pessoais", async () => {
  const before = await rawSnapshot(f.db),
    report = await auditIntegrity(f.db);
  expect(report.status).toBe("ok");
  expect(report.tables).toBe(35);
  expect(await rawSnapshot(f.db)).toEqual(before);
  expect(JSON.stringify(report)).not.toContain("Banco de teste");
});
it("auditoria relata órfãos, valores inválidos e relações sem corrigir", async () => {
  await f.db.financeEntries.add({ ...f.entry, accountId: uid() });
  await f.db.goalMovements.add({
    id: uid(),
    goalId: uid(),
    accountId: f.bank.id,
    kind: "allocate",
    amount: 0,
    date: refDate,
    notes: "",
    createdAt: new Date().toISOString(),
  });
  const before = await rawSnapshot(f.db),
    report = await auditIntegrity(f.db);
  expect(report.status).toBe("issues");
  expect(
    report.issues.some(
      (i) => i.entity === "financeEntries" && i.code.includes("referência"),
    ),
  ).toBe(true);
  expect(
    report.issues.some(
      (i) => i.entity === "goalMovements" && i.code === "estrutura",
    ),
  ).toBe(true);
  expect(await rawSnapshot(f.db)).toEqual(before);
});
it("checagem estrutural identifica check-ins diários duplicados e recibos repetidos", async () => {
  const data = JSON.parse(
    readFileSync("e2e/fixtures/backup-v4.json", "utf8"),
  ).data;
  data.recoverySnapshots = [];
  data.checkIns.push({ ...data.checkIns[0] });
  data.projectReceipts.push({ ...data.projectReceipts[0], id: uid() });
  const issues = structuralIssues(data);
  expect(
    issues.some(
      (i) => i.entity === "checkIns" && i.code === "identificadores-duplicados",
    ),
  ).toBe(true);
  expect(
    issues.some(
      (i) =>
        i.entity === "projectReceipts" && i.code.includes("vínculo-duplicado"),
    ),
  ).toBe(true);
});
it("auditoria de banco fechado com falha de abertura retorna orientação sem apagar", async () => {
  const original = f.db.table.bind(f.db);
  vi.spyOn(f.db, "table").mockImplementation((...args: unknown[]) => {
    if (args[0] === "settings")
      throw new DOMException("blocked", "SecurityError");
    return original(String(args[0]));
  });
  expect((await auditIntegrity(f.db)).status).toBe("unavailable");
});
it("apagar exige confirmação e cópia externa informada correspondente aos dados atuais", async () => {
  await expect(eraseLocalData("sim", f.db)).rejects.toThrow("APAGAR");
  await expect(eraseLocalData("APAGAR", f.db)).rejects.toThrow("cópia externa");
  const file = await exportBackup(f.db),
    proof = {
      backupId: file.backupId!,
      contentHash: await contentHash(file.data),
    };
  await confirmBackupSaved(f.db, proof);
  await eraseLocalData("APAGAR", f.db);
  for (const table of backupTables)
    expect(await f.db.table(table).count()).toBe(0);
});
it("cópia antiga não autoriza apagar nem confirmação após mudança de dados", async () => {
  const file = await exportBackup(f.db),
    proof = {
      backupId: file.backupId!,
      contentHash: await contentHash(file.data),
    };
  await confirmBackupSaved(f.db, proof);
  await saveEntry(f.entry, uid(), f.db);
  await expect(eraseLocalData("APAGAR", f.db)).rejects.toThrow("mudaram");
  await expect(confirmBackupSaved(f.db, proof)).rejects.toThrow("mudaram");
  expect(await f.db.financeEntries.count()).toBe(1);
});
it("falha durante apagar reverte exclusões anteriores", async () => {
  const file = await exportBackup(f.db);
  await confirmBackupSaved(f.db, {
    backupId: file.backupId!,
    contentHash: await contentHash(file.data),
  });
  const before = await rawSnapshot(f.db);
  f.db.financeAccounts.hook("deleting", () => {
    throw new Error("delete-write-failed");
  });
  await expect(eraseLocalData("APAGAR", f.db)).rejects.toThrow(
    "delete-write-failed",
  );
  expect(await rawSnapshot(f.db)).toEqual(before);
});
it("o schema continua v4 sem migrations destrutivas", async () => {
  expect(f.db.verno).toBe(4);
  expect(defaultDb.verno).toBe(4);
  const reopened = new AppDatabase(f.db.name);
  f.db.close();
  await reopened.open();
  expect(await reopened.financeAccounts.count()).toBe(3);
  reopened.close();
});

it("campos futuros dentro de cenários financeiros são rejeitados", async () => {
  const file = await exportBackup(f.db);
  const settings = JSON.parse(
    JSON.stringify({ ...financeDefaults, updatedAt: new Date().toISOString() }),
  );
  settings.scenarios.base.futureParameter = true;
  file.data.financeSettings = [settings];
  await expect(validateBackup(await resign(file))).rejects.toThrow(
    "campos desconhecidos",
  );
});
it("pagamento concorrente de fatura usa idempotência persistente", async () => {
  await saveCard(f.card, uid(), f.db);
  await addPurchase(f.purchase, uid(), f.db);
  const invoice = (await f.db.financeInvoices.toArray()).sort((a, b) =>
    a.dueDate.localeCompare(b.dueDate),
  )[0];
  const payment = {
      id: uid(),
      targetType: "invoice" as const,
      targetId: invoice.id,
      accountId: f.bank.id,
      amount: 1000,
      date: refDate,
      eligibilityConfirmed: false,
    },
    op = uid();
  await Promise.all([
    payTarget(payment, op, f.db),
    payTarget(payment, op, f.db),
  ]);
  f.db.close();
  await f.db.open();
  await payTarget(payment, op, f.db);
  expect(await f.db.financePayments.count()).toBe(1);
  expect(bankBalance(await readFinance(f.db), refDate)).toBe(99000);
});

it("conflito em ponto de recuperação importado reverte inclusive o novo ponto", async () => {
  const original = await exportBackup(f.db);
  await restoreBackup(original, "RESTAURAR", f.db);
  const file = await exportBackup(f.db),
    point = (await f.db.recoverySnapshots.toArray())[0];
  await f.db.recoverySnapshots.update(point.id, {
    createdAt: "2024-01-01T00:00:00.000Z",
  });
  const before = await rawSnapshot(f.db);
  await expect(restoreBackup(file, "RESTAURAR", f.db)).rejects.toThrow(
    "em conflito",
  );
  expect(await rawSnapshot(f.db)).toEqual(before);
});

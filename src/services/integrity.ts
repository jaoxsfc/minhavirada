import { db, type AppDatabase } from "../db/database";
import { backupTables, assertBackupCoverage } from "../db/backup-registry";
import {
  rawSnapshot,
  validateBackup,
  backupChecksum,
  APP_VERSION,
} from "./backup";
import { structuralIssues, type IntegrityIssue } from "./integrity-checks";
import { readFinance } from "../repositories/finance-data";
import {
  accountBalance,
  bankBalance,
  benefitBalance,
} from "./finance/calculations";
import { localDate } from "../lib/date";
export interface IntegrityReport {
  status: "ok" | "issues" | "unavailable";
  checkedAt: string;
  tables: number;
  records: number;
  issues: IntegrityIssue[];
}
export async function auditIntegrity(
  database: AppDatabase = db,
): Promise<IntegrityReport> {
  const checkedAt = new Date().toISOString();
  try {
    assertBackupCoverage(database);
    const { data, finance } = await database.transaction(
      "r",
      backupTables.map((n) => database.table(n)),
      async () => ({
        data: await rawSnapshot(database),
        finance: await readFinance(database),
      }),
    );
    const issues = structuralIssues(data);
    try {
      const body = {
        format: "minha-virada",
        formatVersion: 1,
        appVersion: APP_VERSION,
        schemaVersion: 4,
        backupId: crypto.randomUUID(),
        createdAt: checkedAt,
        data,
        recordCounts: Object.fromEntries(
          Object.entries(data).map(([n, r]) => [n, r.length]),
        ),
      };
      await validateBackup({ ...body, checksum: await backupChecksum(body) });
    } catch {
      if (!issues.length)
        issues.push({
          code: "consistência-dos-históricos",
          severity: "error",
          entity: "finanças, metas e históricos",
          count: 1,
          guidance:
            "Guarde uma cópia externa e compare com uma cópia anterior validada. Não foram feitas correções automáticas.",
        });
    }
    const derived = [
      bankBalance(finance, localDate()),
      benefitBalance(finance, localDate()),
      ...finance.accounts.map((a) =>
        accountBalance(finance, a.id, localDate()),
      ),
    ];
    if (derived.some((n) => !Number.isSafeInteger(n)))
      issues.push({
        code: "saldo-derivado-inválido",
        severity: "error",
        entity: "financeAccounts",
        count: derived.filter((n) => !Number.isSafeInteger(n)).length,
        guidance:
          "Confira os lançamentos e restaure uma cópia validada. Nenhum saldo foi reescrito.",
      });
    return {
      status: issues.length ? "issues" : "ok",
      checkedAt,
      tables: backupTables.length,
      records: Object.values(data).reduce((n, r) => n + r.length, 0),
      issues,
    };
  } catch {
    return {
      status: "unavailable",
      checkedAt,
      tables: 0,
      records: 0,
      issues: [
        {
          code: "armazenamento-indisponível",
          severity: "error",
          entity: "armazenamento local",
          count: 1,
          guidance:
            "Reabra o navegador e confira as permissões. Não limpe os dados; tente guardar uma cópia externa.",
        },
      ],
    };
  }
}

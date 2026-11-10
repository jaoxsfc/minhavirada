import { z } from "zod";
export const externalProofSchema = z
  .object({
    backupId: z.string().uuid(),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    confirmedAt: z.string().datetime(),
  })
  .strict();
export const backupStateSchema = z
  .object({
    id: z.literal("local"),
    lastConfirmedAt: z.string().datetime().optional(),
    lastRestoreChecksum: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    lastRestoreContentHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    lastExternal: externalProofSchema.optional(),
  })
  .strict();
export type BackupState = z.infer<typeof backupStateSchema>;
export const recoverySchema = z
  .object({
    id: z.string().uuid(),
    createdAt: z.string().datetime(),
    json: z.string().max(20 * 1024 * 1024),
  })
  .strict();

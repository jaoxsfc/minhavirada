import { z } from "zod";
import { validateBackup, MAX_BACKUP_BYTES, type Backup } from "./backup";
export const PBKDF2_ITERATIONS = 600000;
export const MAX_IMPORT_BYTES = 28 * 1024 * 1024;
const base64 = z
  .string()
  .regex(/^[A-Za-z0-9+/]*={0,2}$/)
  .refine((text) => text.length % 4 === 0, "Base64 inválido.");
const encryptedSchema = z
  .object({
    format: z.literal("minha-virada-encrypted"),
    formatVersion: z.literal(1),
    kdf: z
      .object({
        name: z.literal("PBKDF2"),
        hash: z.literal("SHA-256"),
        iterations: z.literal(PBKDF2_ITERATIONS),
        salt: base64.length(24),
      })
      .strict(),
    cipher: z
      .object({
        name: z.literal("AES-GCM"),
        keyBits: z.literal(256),
        tagBits: z.literal(128),
        iv: base64.length(16),
      })
      .strict(),
    ciphertext: base64.min(24).max(Math.ceil((MAX_BACKUP_BYTES + 16) / 3) * 4),
  })
  .strict();
export type EncryptedBackup = z.infer<typeof encryptedSchema>;
function encode(bytes: Uint8Array) {
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 8192)
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
  return btoa(chunks.join(""));
}
function decode(text: string) {
  const binary = atob(text),
    bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  if (encode(bytes) !== text) throw new Error("Codificação inválida.");
  return bytes;
}
export function inspectEncryptedBackup(input: unknown): EncryptedBackup {
  if (
    input &&
    typeof input === "object" &&
    (input as { formatVersion?: unknown }).formatVersion !== 1
  )
    throw new Error(
      "Versão criptografada não suportada. Use uma versão compatível do aplicativo.",
    );
  const file = encryptedSchema.parse(input);
  if (
    decode(file.kdf.salt).length !== 16 ||
    decode(file.cipher.iv).length !== 12
  )
    throw new Error("Parâmetros de criptografia inválidos.");
  return file;
}
function api() {
  if (!globalThis.crypto?.subtle)
    throw new Error(
      "A criptografia precisa de HTTPS ou localhost e Web Crypto disponível.",
    );
  return crypto.subtle;
}
async function key(password: string, salt: Uint8Array<ArrayBuffer>) {
  const bytes = new TextEncoder().encode(password);
  if (!bytes.length || bytes.length > 1024)
    throw new Error("Use uma senha de até 1024 bytes.");
  try {
    const material = await api().importKey("raw", bytes, "PBKDF2", false, [
      "deriveKey",
    ]);
    return await api().deriveKey(
      { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  } finally {
    bytes.fill(0);
  }
}
function additionalData(file: Omit<EncryptedBackup, "ciphertext">) {
  return new TextEncoder().encode(
    JSON.stringify({
      format: file.format,
      formatVersion: file.formatVersion,
      kdf: file.kdf,
      cipher: file.cipher,
    }),
  );
}
export async function encryptBackup(
  input: unknown,
  password: string,
): Promise<EncryptedBackup> {
  if ([...password].length < 12)
    throw new Error("Use uma frase-senha com pelo menos 12 caracteres.");
  api();
  const backup = await validateBackup(input);
  const plain = new TextEncoder().encode(JSON.stringify(backup));
  if (plain.length > MAX_BACKUP_BYTES)
    throw new Error("O conteúdo excede 20 MB.");
  const salt = crypto.getRandomValues(new Uint8Array(16)),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const header: Omit<EncryptedBackup, "ciphertext"> = {
    format: "minha-virada-encrypted" as const,
    formatVersion: 1 as const,
    kdf: {
      name: "PBKDF2" as const,
      hash: "SHA-256" as const,
      iterations: PBKDF2_ITERATIONS,
      salt: encode(salt),
    },
    cipher: {
      name: "AES-GCM" as const,
      keyBits: 256 as const,
      tagBits: 128 as const,
      iv: encode(iv),
    },
  };
  try {
    const ciphertext = await api().encrypt(
      {
        name: "AES-GCM",
        iv,
        tagLength: 128,
        additionalData: additionalData(header),
      },
      await key(password, salt),
      plain,
    );
    return { ...header, ciphertext: encode(new Uint8Array(ciphertext)) };
  } finally {
    plain.fill(0);
  }
}
export async function decryptBackup(
  input: unknown,
  password: string,
): Promise<Backup> {
  const file = inspectEncryptedBackup(input),
    iv = decode(file.cipher.iv),
    salt = decode(file.kdf.salt);
  api();
  let plain: ArrayBuffer;
  try {
    plain = await api().decrypt(
      {
        name: "AES-GCM",
        iv,
        tagLength: 128,
        additionalData: additionalData(file),
      },
      await key(password, salt),
      decode(file.ciphertext),
    );
  } catch {
    throw new Error(
      "Não foi possível abrir a cópia: senha incorreta ou arquivo alterado/incompleto.",
    );
  }
  const bytes = new Uint8Array(plain);
  try {
    if (bytes.byteLength > MAX_BACKUP_BYTES)
      throw new Error("O conteúdo excede 20 MB.");
    return await validateBackup(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
    );
  } finally {
    bytes.fill(0);
  }
}
export function parseBackupText(text: string): unknown {
  if (new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES)
    throw new Error("Use um arquivo de até 28 MB (conteúdo de até 20 MB).");
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      "Arquivo JSON incompleto ou inválido. Nenhum dado foi alterado.",
    );
  }
}
export function isEncrypted(input: unknown): boolean {
  return (
    input !== null &&
    typeof input === "object" &&
    (input as { format?: unknown }).format === "minha-virada-encrypted"
  );
}

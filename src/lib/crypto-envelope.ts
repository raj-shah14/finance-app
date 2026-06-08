import crypto from "crypto";
import { db } from "@/lib/db";
import { wrapDek, unwrapDek } from "@/lib/key-vault";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;
const PREFIX = "enc:v1:";
const DEK_LEN = 32;

// LRU-ish: simple Map with TTL eviction. Small N, no need for a real LRU.
const DEK_TTL_MS = 5 * 60 * 1000;
type CachedDek = { dek: Buffer; expiresAt: number };
const dekCache = new Map<string, CachedDek>();
const inflight = new Map<string, Promise<Buffer>>();

function evictExpired() {
  const now = Date.now();
  for (const [k, v] of dekCache) {
    if (v.expiresAt < now) dekCache.delete(k);
  }
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export async function ensureUserDek(userId: string): Promise<Buffer> {
  evictExpired();
  const cached = dekCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.dek;

  const existing = inflight.get(userId);
  if (existing) return existing;

  const promise = (async () => {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { wrappedDek: true },
    });
    if (!user) throw new Error(`User ${userId} not found while resolving DEK`);

    let dek: Buffer;
    if (user.wrappedDek) {
      dek = await unwrapDek(Buffer.from(user.wrappedDek));
    } else {
      dek = crypto.randomBytes(DEK_LEN);
      const wrapped = await wrapDek(dek);
      const ab = new ArrayBuffer(wrapped.byteLength);
      new Uint8Array(ab).set(wrapped);
      await db.user.update({
        where: { id: userId },
        data: { wrappedDek: new Uint8Array(ab) },
      });
    }
    dekCache.set(userId, { dek, expiresAt: Date.now() + DEK_TTL_MS });
    return dek;
  })().finally(() => inflight.delete(userId));

  inflight.set(userId, promise);
  return promise;
}

export async function encryptForUser(
  userId: string,
  plaintext: string | null | undefined
): Promise<string | null> {
  if (plaintext === null || plaintext === undefined || plaintext === "") return plaintext ?? null;
  if (isEncrypted(plaintext)) return plaintext;
  const dek = await ensureUserDek(userId);
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, dek, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, enc]).toString("base64");
  return PREFIX + payload;
}

export async function decryptForUser(
  userId: string,
  ciphertext: string | null | undefined
): Promise<string | null> {
  if (ciphertext === null || ciphertext === undefined || ciphertext === "") return ciphertext ?? null;
  if (!isEncrypted(ciphertext)) return ciphertext; // legacy plaintext passthrough
  const dek = await ensureUserDek(userId);
  const raw = Buffer.from(ciphertext.slice(PREFIX.length), "base64");
  const iv = raw.subarray(0, IV_LEN);
  const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = raw.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGO, dek, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

export async function decryptRowFields<T extends Record<string, unknown>>(
  userId: string,
  row: T,
  fields: (keyof T)[]
): Promise<T> {
  const out = { ...row };
  await Promise.all(
    fields.map(async (f) => {
      const v = row[f];
      if (typeof v === "string") {
        (out as Record<string, unknown>)[f as string] = await decryptForUser(userId, v);
      }
    })
  );
  return out;
}

export async function encryptManyForUser(
  userId: string,
  values: (string | null | undefined)[]
): Promise<(string | null)[]> {
  // Single DEK fetch, parallel field encrypts
  await ensureUserDek(userId);
  return Promise.all(values.map((v) => encryptForUser(userId, v)));
}

export function clearDekCache(userId?: string) {
  if (userId) dekCache.delete(userId);
  else dekCache.clear();
}

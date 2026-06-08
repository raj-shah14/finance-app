import { encryptForUser, decryptForUser, ensureUserDek } from "./crypto-envelope";

// Centralized field lists per entity. Add new encrypted columns here.
export const ENCRYPTED_FIELDS = {
  account: ["name", "officialName", "mask", "institutionName", "notes"] as const,
  transaction: ["name", "merchantName", "notes"] as const,
  goal: ["name", "description"] as const,
  // household.name intentionally NOT encrypted — shared across users would
  // require a household-level DEK; the label has low sensitivity.
} as const;

type FieldList = readonly string[];

async function encryptObj<T extends Record<string, unknown>>(
  userId: string,
  obj: T,
  fields: FieldList
): Promise<T> {
  await ensureUserDek(userId);
  const out: Record<string, unknown> = { ...obj };
  await Promise.all(
    fields.map(async (f) => {
      const v = obj[f];
      if (typeof v === "string") {
        out[f] = await encryptForUser(userId, v);
      }
    })
  );
  return out as T;
}

async function decryptObj<T extends Record<string, unknown>>(
  userId: string,
  obj: T,
  fields: FieldList
): Promise<T> {
  await ensureUserDek(userId);
  const out: Record<string, unknown> = { ...obj };
  await Promise.all(
    fields.map(async (f) => {
      const v = obj[f];
      if (typeof v === "string") {
        out[f] = await decryptForUser(userId, v);
      }
    })
  );
  return out as T;
}

export const encryptAccountInput = <T extends Record<string, unknown>>(uid: string, o: T) =>
  encryptObj(uid, o, ENCRYPTED_FIELDS.account);
export const decryptAccount = <T extends Record<string, unknown>>(uid: string, o: T) =>
  decryptObj(uid, o, ENCRYPTED_FIELDS.account);

export const encryptTransactionInput = <T extends Record<string, unknown>>(uid: string, o: T) =>
  encryptObj(uid, o, ENCRYPTED_FIELDS.transaction);
export const decryptTransaction = <T extends Record<string, unknown>>(uid: string, o: T) =>
  decryptObj(uid, o, ENCRYPTED_FIELDS.transaction);

export const encryptGoalInput = <T extends Record<string, unknown>>(uid: string, o: T) =>
  encryptObj(uid, o, ENCRYPTED_FIELDS.goal);
export const decryptGoal = <T extends Record<string, unknown>>(uid: string, o: T) =>
  decryptObj(uid, o, ENCRYPTED_FIELDS.goal);

export async function decryptAccountsByOwner<T extends Record<string, unknown> & { userId: string }>(
  rows: T[]
): Promise<T[]> {
  return Promise.all(rows.map((r) => decryptAccount(r.userId, r)));
}

export async function decryptTransactionsByOwner<T extends Record<string, unknown> & { userId: string }>(
  rows: T[]
): Promise<T[]> {
  return Promise.all(rows.map((r) => decryptTransaction(r.userId, r)));
}

export async function decryptGoalsByOwner<T extends Record<string, unknown> & { userId: string }>(
  rows: T[]
): Promise<T[]> {
  return Promise.all(rows.map((r) => decryptGoal(r.userId, r)));
}

// Client-side PWA lock — PIN (PBKDF2-hashed) plus optional WebAuthn
// platform-authenticator (Face ID / Touch ID / Windows Hello) for
// quick unlock. All state lives in localStorage; no server roundtrip.
//
// Threat model: this gates the rendered UI on a personal device. It
// is NOT a server-side authorization boundary — the backend session
// is still controlled by Clerk. The intent is to keep the app's
// financial data hidden from anyone who picks up an unlocked phone.

const LS = {
  pinHash: "pwa.pin.hash",
  pinSalt: "pwa.pin.salt",
  credentialId: "pwa.biometric.credentialId",
  lastActive: "pwa.lock.lastActive",
} as const;

export const LOCK_TIMEOUT_MS = 5 * 60 * 1000;

// ─── PIN crypto ──────────────────────────────────────────────────────

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const arr = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s);
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

// Some Web Crypto / WebAuthn type defs require BufferSource backed by
// ArrayBuffer (not SharedArrayBuffer). Copy into a fresh ArrayBuffer
// so the typed-array satisfies the stricter type.
function fromB64Buf(s: string): ArrayBuffer {
  const u8 = fromB64(s);
  const buf = new ArrayBuffer(u8.byteLength);
  new Uint8Array(buf).set(u8);
  return buf;
}

async function hashPin(pin: string, saltB64: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: fromB64Buf(saltB64),
      iterations: 250_000,
      hash: "SHA-256",
    },
    key,
    256
  );
  return toB64(bits);
}

// ─── Public API ──────────────────────────────────────────────────────

export function hasPinSet(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(LS.pinHash);
}

export async function setPin(pin: string): Promise<void> {
  if (!/^\d{4,8}$/.test(pin)) throw new Error("PIN must be 4–8 digits");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltB64 = toB64(salt);
  const hash = await hashPin(pin, saltB64);
  localStorage.setItem(LS.pinSalt, saltB64);
  localStorage.setItem(LS.pinHash, hash);
  markActive();
}

export async function verifyPin(pin: string): Promise<boolean> {
  const salt = localStorage.getItem(LS.pinSalt);
  const stored = localStorage.getItem(LS.pinHash);
  if (!salt || !stored) return false;
  const candidate = await hashPin(pin, salt);
  return candidate === stored;
}

export function clearLock(): void {
  localStorage.removeItem(LS.pinHash);
  localStorage.removeItem(LS.pinSalt);
  localStorage.removeItem(LS.credentialId);
  localStorage.removeItem(LS.lastActive);
}

// ─── Activity tracker ────────────────────────────────────────────────

export function markActive(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS.lastActive, String(Date.now()));
}

export function isLocked(): boolean {
  if (typeof window === "undefined") return false;
  if (!hasPinSet()) return false;
  const last = parseInt(localStorage.getItem(LS.lastActive) || "0", 10);
  if (!last) return true;
  return Date.now() - last > LOCK_TIMEOUT_MS;
}

// ─── WebAuthn (Face ID / Touch ID) ───────────────────────────────────

export function biometricSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    !!navigator.credentials
  );
}

export function hasBiometricEnrolled(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(LS.credentialId);
}

// Register a platform credential. The user MUST already have a PIN
// set (so we always have a fallback). Throws on cancellation/error.
export async function enrollBiometric(userLabel: string): Promise<void> {
  if (!biometricSupported()) throw new Error("Biometric not supported");
  if (!hasPinSet()) throw new Error("Set a PIN first");
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "FinancialFlow", id: window.location.hostname },
      user: {
        id: userId,
        name: userLabel || "user",
        displayName: userLabel || "FinancialFlow",
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },   // ES256
        { type: "public-key", alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60_000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Enrollment cancelled");
  localStorage.setItem(LS.credentialId, toB64(new Uint8Array(cred.rawId)));
}

export function clearBiometric(): void {
  localStorage.removeItem(LS.credentialId);
}

// Trigger Face ID / Touch ID. Returns true if the user successfully
// completed the biometric prompt against the enrolled credential.
// Since this app has no server-side WebAuthn endpoint, we treat
// successful completion of the platform prompt as the trust signal.
export async function verifyBiometric(): Promise<boolean> {
  if (!biometricSupported()) return false;
  const credIdB64 = localStorage.getItem(LS.credentialId);
  if (!credIdB64) return false;
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: window.location.hostname,
        allowCredentials: [
          {
            id: fromB64Buf(credIdB64),
            type: "public-key",
            transports: ["internal"],
          },
        ],
        userVerification: "required",
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;
    return !!assertion;
  } catch {
    return false;
  }
}

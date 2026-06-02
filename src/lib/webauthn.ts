/**
 * Server-side WebAuthn helpers built on @simplewebauthn/server.
 *
 * Architecture: registration / authentication options are generated on
 * the server, sent to the browser, the browser calls navigator.
 * credentials.create / get (Safari triggers Face ID automatically),
 * the resulting attestation/assertion is sent back to the server for
 * verification.
 *
 * Required env:
 *   - WEBAUTHN_RP_ID    e.g. "thefinancialflows.net" (bare host, no
 *                       scheme, no port). Must match window.location.host.
 *   - WEBAUTHN_RP_NAME  Human-friendly RP name shown in the prompt.
 *   - WEBAUTHN_ORIGIN   Full https URL (e.g. https://thefinancialflows.net).
 */

export const rpID = process.env.WEBAUTHN_RP_ID || "localhost";
export const rpName = process.env.WEBAUTHN_RP_NAME || "Financial Flows";
export const origin = process.env.WEBAUTHN_ORIGIN || "http://localhost:3000";

export function webauthnConfigured(): boolean {
  return Boolean(
    process.env.WEBAUTHN_RP_ID &&
      process.env.WEBAUTHN_RP_NAME &&
      process.env.WEBAUTHN_ORIGIN
  );
}

/**
 * Base64url encode/decode helpers. WebAuthn IDs flow as Uint8Array on
 * the wire but we persist as base64url strings in Postgres.
 */
export function bufToB64Url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64UrlToBuf(b64url: string): Uint8Array {
  const padded = b64url
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(b64url.length + ((4 - (b64url.length % 4)) % 4), "=");
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

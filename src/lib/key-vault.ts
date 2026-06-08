import { DefaultAzureCredential } from "@azure/identity";
import { KeyClient, CryptographyClient, KnownEncryptionAlgorithms } from "@azure/keyvault-keys";

const VAULT_URL = process.env.AZURE_KEY_VAULT_URL;
const KEY_NAME = process.env.AZURE_KEY_VAULT_KEY_NAME;
const DEV_KEK_BASE64 = process.env.DEV_KEK_BASE64;

const credential = VAULT_URL ? new DefaultAzureCredential() : null;
let cryptoClientPromise: Promise<CryptographyClient> | null = null;

function getCryptoClient(): Promise<CryptographyClient> {
  if (!cryptoClientPromise) {
    if (!VAULT_URL || !KEY_NAME || !credential) {
      throw new Error("AZURE_KEY_VAULT_URL and AZURE_KEY_VAULT_KEY_NAME are required for Key Vault operations");
    }
    const keyClient = new KeyClient(VAULT_URL, credential);
    cryptoClientPromise = keyClient.getKey(KEY_NAME).then((key) => {
      if (!key.id) throw new Error(`Key Vault key '${KEY_NAME}' has no id`);
      return new CryptographyClient(key.id, credential);
    });
  }
  return cryptoClientPromise;
}

function devKek(): Buffer {
  if (!DEV_KEK_BASE64) {
    throw new Error("No Key Vault configured and DEV_KEK_BASE64 is not set");
  }
  const buf = Buffer.from(DEV_KEK_BASE64, "base64");
  if (buf.length !== 32) throw new Error("DEV_KEK_BASE64 must decode to 32 bytes");
  return buf;
}

// AES key-wrap (RFC 3394) substitute using AES-256-GCM with fixed IV for dev fallback only.
async function devWrap(plain: Buffer): Promise<Buffer> {
  const crypto = await import("crypto");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", devKek(), iv);
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([0x44]), iv, tag, enc]); // 0x44 = 'D' prefix
}

async function devUnwrap(wrapped: Buffer): Promise<Buffer> {
  const crypto = await import("crypto");
  if (wrapped[0] !== 0x44) throw new Error("Wrapped DEK was not produced by dev KEK");
  const iv = wrapped.subarray(1, 13);
  const tag = wrapped.subarray(13, 29);
  const enc = wrapped.subarray(29);
  const decipher = crypto.createDecipheriv("aes-256-gcm", devKek(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]);
}

export async function wrapDek(dek: Buffer): Promise<Buffer> {
  if (!VAULT_URL) return devWrap(dek);
  const client = await getCryptoClient();
  const result = await client.wrapKey(KnownEncryptionAlgorithms.RSAOaep256, dek);
  return Buffer.from(result.result);
}

export async function unwrapDek(wrapped: Buffer): Promise<Buffer> {
  if (!VAULT_URL || wrapped[0] === 0x44) return devUnwrap(wrapped);
  const client = await getCryptoClient();
  const result = await client.unwrapKey(KnownEncryptionAlgorithms.RSAOaep256, wrapped);
  return Buffer.from(result.result);
}

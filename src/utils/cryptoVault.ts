/**
 * Skima Cryptographic Vault Engine
 * 
 * Provides client-side, zero-knowledge AES-GCM 256-bit encryption and PBKDF2 key derivation.
 * Guarantees that exported database backups are securely encrypted with a user-defined
 * one-time export password, completely decoupled from rigid company identity.
 */

export interface EncryptedVaultEnvelope {
  vaultVersion: 'SKIMA_VAULT_V1';
  algorithm: 'AES-GCM-256';
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;       // Hex encoded 16-byte salt
  iv: string;         // Hex encoded 12-byte IV
  ciphertext: string; // Base64 encoded ciphertext + auth tag
  checksum: string;   // SHA-256 hex of original plaintext for integrity verification
  exportedAt: string;
  payloadType?: string;
}

const VAULT_ITERATIONS = 100000;

// Helper: Convert ArrayBuffer to Hex string
function bufToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper: Convert Hex string to Uint8Array
function hexToBuf(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return bytes;
}

// Helper: Convert ArrayBuffer to Base64
function bufToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper: Convert Base64 to Uint8Array
function base64ToBuf(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Helper: Derive AES-GCM 256-bit Key from Password and Salt
async function deriveAesKey(password: string, salt: Uint8Array, iterations: number = VAULT_ITERATIONS): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Helper: Compute SHA-256 hash of text
async function computeSha256(text: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return bufToHex(digest);
}

/**
 * Encrypts any serializable JavaScript object/data using AES-GCM 256-bit with the provided password.
 */
export async function encryptPayload(data: any, password: string, payloadType: string = 'database_backup'): Promise<EncryptedVaultEnvelope> {
  if (!password || password.trim().length === 0) {
    throw new Error('An export encryption password is required to protect the database archive.');
  }

  const jsonString = typeof data === 'string' ? data : JSON.stringify(data);
  const enc = new TextEncoder();
  const plaintextBytes = enc.encode(jsonString);

  // Generate 16-byte random salt and 12-byte random IV
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Derive AES-GCM key
  const aesKey = await deriveAesKey(password, salt, VAULT_ITERATIONS);

  // Encrypt with AES-GCM (produces ciphertext with 128-bit authentication tag appended)
  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    aesKey,
    plaintextBytes
  );

  const checksum = await computeSha256(jsonString);

  return {
    vaultVersion: 'SKIMA_VAULT_V1',
    algorithm: 'AES-GCM-256',
    kdf: 'PBKDF2-SHA256',
    iterations: VAULT_ITERATIONS,
    salt: bufToHex(salt),
    iv: bufToHex(iv),
    ciphertext: bufToBase64(ciphertextBuffer),
    checksum,
    exportedAt: new Date().toISOString(),
    payloadType,
  };
}

/**
 * Decrypts an EncryptedVaultEnvelope using the user's password.
 * Throws a clear error if the password is wrong or the data is tampered with.
 */
export async function decryptPayload<T = any>(
  envelopeOrJson: EncryptedVaultEnvelope | string,
  password: string
): Promise<T> {
  if (!password || password.trim().length === 0) {
    throw new Error('Decryption password is required.');
  }

  let envelope: EncryptedVaultEnvelope;
  if (typeof envelopeOrJson === 'string') {
    try {
      envelope = JSON.parse(envelopeOrJson);
    } catch {
      throw new Error('Invalid encrypted vault file format.');
    }
  } else {
    envelope = envelopeOrJson;
  }

  if (envelope.vaultVersion !== 'SKIMA_VAULT_V1' || !envelope.ciphertext || !envelope.salt || !envelope.iv) {
    throw new Error('Unrecognized vault structure. This file is not a valid Skima encrypted archive.');
  }

  const salt = hexToBuf(envelope.salt);
  const iv = hexToBuf(envelope.iv);
  const ciphertext = base64ToBuf(envelope.ciphertext);
  const iterations = envelope.iterations || VAULT_ITERATIONS;

  let aesKey: CryptoKey;
  try {
    aesKey = await deriveAesKey(password, salt, iterations);
  } catch (err: any) {
    throw new Error(`Key derivation failed: ${err.message}`);
  }

  let decryptedBuffer: ArrayBuffer;
  try {
    decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      aesKey,
      ciphertext
    );
  } catch {
    throw new Error('Incorrect password or corrupted backup file. Verification failed.');
  }

  const dec = new TextDecoder();
  const plaintext = dec.decode(decryptedBuffer);

  // Verify SHA-256 checksum if present
  if (envelope.checksum) {
    const computedChecksum = await computeSha256(plaintext);
    if (computedChecksum !== envelope.checksum) {
      throw new Error('Data integrity checksum mismatch: archive may be corrupt.');
    }
  }

  try {
    return JSON.parse(plaintext) as T;
  } catch {
    return plaintext as unknown as T;
  }
}

/**
 * Inspects whether a given object or JSON string is a Skima encrypted vault.
 */
export function isEncryptedVault(data: any): boolean {
  if (!data) return false;
  if (typeof data === 'object') {
    return data.vaultVersion === 'SKIMA_VAULT_V1' && typeof data.ciphertext === 'string';
  }
  if (typeof data === 'string') {
    return data.includes('"vaultVersion":"SKIMA_VAULT_V1"') || data.includes('"vaultVersion": "SKIMA_VAULT_V1"');
  }
  return false;
}

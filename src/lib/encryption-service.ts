/**
 * Encryption Service
 * Encrypts and decrypts sensitive data (exchange API credentials) using AES-256-GCM.
 * Uses NEXTAUTH_SECRET as the base key material (derived via PBKDF2).
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT = 'btc-tracker-exchange-credentials'; // Static salt for key derivation
const KEY_LENGTH = 32; // 256 bits

export class EncryptionService {
  private static derivedKey: Buffer | null = null;

  /**
   * Derive an encryption key from the app secret using PBKDF2
   */
  private static getKey(): Buffer {
    if (this.derivedKey) {
      return this.derivedKey;
    }

    const secret = process.env.NEXTAUTH_SECRET || process.env.ENCRYPTION_KEY;
    if (!secret) {
      throw new Error('NEXTAUTH_SECRET or ENCRYPTION_KEY environment variable is required for credential encryption');
    }

    this.derivedKey = crypto.pbkdf2Sync(secret, SALT, 100000, KEY_LENGTH, 'sha256');
    return this.derivedKey;
  }

  /**
   * Encrypt a plaintext string
   * Returns a base64-encoded string containing: IV + AuthTag + Ciphertext
   */
  static encrypt(plaintext: string): string {
    const key = this.getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Combine IV + AuthTag + Ciphertext into a single buffer
    const combined = Buffer.concat([iv, authTag, encrypted]);
    return combined.toString('base64');
  }

  /**
   * Decrypt a base64-encoded encrypted string
   * Expects format: IV (16 bytes) + AuthTag (16 bytes) + Ciphertext
   */
  static decrypt(encryptedBase64: string): string {
    const key = this.getKey();
    const combined = Buffer.from(encryptedBase64, 'base64');

    if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
      throw new Error('Invalid encrypted data: too short');
    }

    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
  }

  /**
   * Clear the cached derived key (useful for testing)
   */
  static clearCache(): void {
    this.derivedKey = null;
  }
}

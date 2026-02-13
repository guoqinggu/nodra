/**
 * API Key Authentication System
 *
 * Provides programmatic access to the API without user credentials.
 * Uses key:secret pairs with Argon2 hashing for secure storage.
 */

import { hash, verify } from 'argon2';
import { AuthenticationError } from '../core/errors.js';

/**
 * API Key configuration
 */
export interface APIKeyConfig {
  /** Key prefix (e.g., 'nodra') */
  prefix: string;
  /** Length of the random key part */
  keyLength: number;
  /** Length of the secret */
  secretLength: number;
}

/**
 * API Key record stored in database
 */
export interface APIKeyRecord {
  /** Hashed key (identifier) */
  keyHash: string;
  /** Hashed secret */
  secretHash: string;
  /** User email associated with this key */
  userEmail: string;
  /** User roles */
  userRoles: string[];
  /** Creation timestamp */
  createdAt: Date;
  /** Expiration timestamp (null = never) */
  expiresAt: Date | null;
  /** Last used timestamp */
  lastUsedAt: Date | null;
  /** Whether key is active */
  isActive: boolean;
  /** Permission scopes */
  scopes: string[];
  /** Description */
  description: string;
  /** Revocation timestamp */
  revokedAt?: Date;
}

/**
 * API Key pair (returned once on generation)
 */
export interface APIKeyPair {
  /** The API key (public identifier) */
  key: string;
  /** The secret (private, shown only once) */
  secret: string;
}

/**
 * API Key storage interface
 */
export interface APIKeyStore {
  save(record: APIKeyRecord): Promise<void>;
  findByHash(keyHash: string): Promise<APIKeyRecord | undefined>;
  findByUser(userEmail: string): Promise<APIKeyRecord[]>;
  revoke(keyHash: string): Promise<void>;
  update(record: APIKeyRecord): Promise<void>;
}

/** Default configuration */
export const DEFAULT_API_KEY_CONFIG: APIKeyConfig = {
  prefix: 'nodra',
  keyLength: 32,
  secretLength: 32,
};

/**
 * Generate a cryptographically secure random string
 */
function generateRandomString(length: number): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charsetLength = charset.length;

  const randomValues = new Uint8Array(length);
  if (typeof crypto !== 'undefined') {
    crypto.getRandomValues(randomValues);
  } else {
    // Fallback for environments without crypto
    for (let i = 0; i < length; i++) {
      randomValues[i] = Math.floor(Math.random() * 256);
    }
  }

  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset[randomValues[i]! % charsetLength];
  }

  return result;
}

/**
 * Generate a new API key pair
 *
 * @param config - API key configuration
 * @returns Object containing the key and secret (shown only once!)
 */
export function generateAPIKey(config: APIKeyConfig = DEFAULT_API_KEY_CONFIG): APIKeyPair {
  const randomKey = generateRandomString(config.keyLength);
  const secret = generateRandomString(config.secretLength);

  return {
    key: `${config.prefix}_${randomKey}`,
    secret,
  };
}

/**
 * Hash an API key for storage lookup
 * Uses SHA-256 for deterministic hashing (same key = same hash)
 *
 * @param key - The API key to hash
 * @returns SHA-256 hash string
 */
export async function hashAPIKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash an API secret using Argon2 (for secure storage)
 *
 * @param secret - The API secret to hash
 * @returns Argon2 hash string
 */
export async function hashAPISecret(secret: string): Promise<string> {
  return hash(secret, {
    type: 2,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

/**
 * Verify an API key and secret
 *
 * @param key - The API key
 * @param secret - The API secret
 * @param store - API key storage
 * @returns The API key record if valid
 * @throws {AuthenticationError} If key is invalid, revoked, or expired
 */
export async function verifyAPIKey(
  key: string,
  secret: string,
  store: APIKeyStore
): Promise<APIKeyRecord> {
  const keyHash = await hashAPIKey(key);

  const record = await store.findByHash(keyHash);

  if (!record) {
    throw new AuthenticationError('Invalid API key');
  }

  if (!record.isActive) {
    throw new AuthenticationError('API key has been revoked');
  }

  if (record.expiresAt && record.expiresAt < new Date()) {
    throw new AuthenticationError('API key has expired');
  }

  const isValidSecret = await verify(record.secretHash, secret);

  if (!isValidSecret) {
    throw new AuthenticationError('Invalid API key');
  }

  record.lastUsedAt = new Date();
  await store.update(record);

  return record;
}

/**
 * Revoke an API key
 *
 * @param keyHash - The hashed key to revoke
 * @param store - API key storage
 * @throws {AuthenticationError} If key not found
 */
export async function revokeAPIKey(
  keyHash: string,
  store: APIKeyStore
): Promise<void> {
  const record = await store.findByHash(keyHash);

  if (!record) {
    throw new AuthenticationError('API key not found');
  }

  await store.revoke(keyHash);
}

/**
 * List all active API keys for a user
 *
 * @param userEmail - User's email
 * @param store - API key storage
 * @returns Array of active API key records
 */
export async function listUserAPIKeys(
  userEmail: string,
  store: APIKeyStore
): Promise<APIKeyRecord[]> {
  const keys = await store.findByUser(userEmail);
  return keys.filter((key) => key.isActive);
}

/**
 * Get permission scopes for an API key
 *
 * @param keyHash - The hashed key
 * @param store - API key storage
 * @returns Array of permission scopes
 * @throws {AuthenticationError} If key not found or revoked
 */
export async function getAPIKeyPermissions(
  keyHash: string,
  store: APIKeyStore
): Promise<string[]> {
  const record = await store.findByHash(keyHash);

  if (!record) {
    throw new AuthenticationError('API key not found');
  }

  if (!record.isActive) {
    throw new AuthenticationError('API key has been revoked');
  }

  return record.scopes;
}

/**
 * Rotate (replace) an API key with a new one
 * Preserves permissions and user association
 *
 * @param oldKeyHash - The hashed key to rotate
 * @param config - API key configuration
 * @param store - API key storage
 * @returns New API key pair
 * @throws {AuthenticationError} If old key not found
 */
export async function rotateAPIKey(
  oldKeyHash: string,
  config: APIKeyConfig,
  store: APIKeyStore
): Promise<APIKeyPair> {
  const oldRecord = await store.findByHash(oldKeyHash);

  if (!oldRecord) {
    throw new AuthenticationError('API key not found');
  }

  await store.revoke(oldKeyHash);

  const newKeyPair = generateAPIKey(config);

  const newRecord: APIKeyRecord = {
    keyHash: await hashAPIKey(newKeyPair.key),
    secretHash: await hashAPISecret(newKeyPair.secret),
    userEmail: oldRecord.userEmail,
    userRoles: oldRecord.userRoles,
    createdAt: new Date(),
    expiresAt: oldRecord.expiresAt,
    lastUsedAt: null,
    isActive: true,
    scopes: oldRecord.scopes,
    description: oldRecord.description,
  };

  await store.save(newRecord);

  return newKeyPair;
}

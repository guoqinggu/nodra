/**
 * Tests for API Key Authentication
 *
 * API Keys provide programmatic access to the API without user credentials.
 * Essential for third-party integrations and external system access.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateAPIKey,
  hashAPIKey,
  verifyAPIKey,
  revokeAPIKey,
  getAPIKeyPermissions,
  listUserAPIKeys,
  rotateAPIKey,
  type APIKeyConfig,
  type APIKeyRecord,
} from '../../../src/auth/api-key.js';
import { AuthenticationError } from '../../../src/core/errors.js';

// ---------------------------------------------------------------------------
// Test configuration
// ---------------------------------------------------------------------------

const testConfig: APIKeyConfig = {
  prefix: 'nodra',
  keyLength: 32,
  secretLength: 32,
};

// Mock database for API key storage
class MockAPIKeyStore {
  private keys = new Map<string, APIKeyRecord>();

  async save(record: APIKeyRecord): Promise<void> {
    this.keys.set(record.keyHash, record);
  }

  async findByHash(keyHash: string): Promise<APIKeyRecord | undefined> {
    return this.keys.get(keyHash);
  }

  async findByUser(userEmail: string): Promise<APIKeyRecord[]> {
    return Array.from(this.keys.values()).filter(
      (k) => k.userEmail === userEmail && !k.revokedAt,
    );
  }

  async revoke(keyHash: string): Promise<void> {
    const key = this.keys.get(keyHash);
    if (key) {
      key.revokedAt = new Date();
      key.isActive = false;
    }
  }

  async update(record: APIKeyRecord): Promise<void> {
    this.keys.set(record.keyHash, record);
  }

  clear(): void {
    this.keys.clear();
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('API Key Generation', () => {
  it('should generate a valid API key pair', () => {
    const keyPair = generateAPIKey(testConfig);

    expect(keyPair.key).toBeDefined();
    expect(keyPair.secret).toBeDefined();
    expect(typeof keyPair.key).toBe('string');
    expect(typeof keyPair.secret).toBe('string');
    expect(keyPair.key.length).toBeGreaterThan(0);
    expect(keyPair.secret.length).toBeGreaterThan(0);
  });

  it('should generate unique keys each time', () => {
    const keyPair1 = generateAPIKey(testConfig);
    const keyPair2 = generateAPIKey(testConfig);

    expect(keyPair1.key).not.toBe(keyPair2.key);
    expect(keyPair1.secret).not.toBe(keyPair2.secret);
  });

  it('should include prefix in generated key', () => {
    const keyPair = generateAPIKey(testConfig);

    expect(keyPair.key.startsWith(testConfig.prefix)).toBe(true);
  });

  it('should generate keys with correct length', () => {
    const keyPair = generateAPIKey(testConfig);
    // Key format: prefix_randomString (prefix + underscore + random)
    const randomPart = keyPair.key.slice(testConfig.prefix.length + 1);
    expect(randomPart.length).toBe(testConfig.keyLength);
  });

  it('should generate URL-safe keys', () => {
    const keyPair = generateAPIKey(testConfig);

    // Should not contain characters that need URL encoding
    expect(keyPair.key).not.toMatch(/[+/=]/);
    expect(keyPair.secret).not.toMatch(/[+/=]/);
  });
});

describe('API Key Hashing', () => {
  it('should hash API key consistently', async () => {
    const keyPair = generateAPIKey(testConfig);
    const hash1 = await hashAPIKey(keyPair.key);
    const hash2 = await hashAPIKey(keyPair.key);

    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different keys', async () => {
    const keyPair1 = generateAPIKey(testConfig);
    const keyPair2 = generateAPIKey(testConfig);

    const hash1 = await hashAPIKey(keyPair1.key);
    const hash2 = await hashAPIKey(keyPair2.key);

    expect(hash1).not.toBe(hash2);
  });

  it('should use secure hashing algorithm', async () => {
    const keyPair = generateAPIKey(testConfig);
    const hash = await hashAPIKey(keyPair.key);

    // Argon2 hashes start with $argon2
    expect(hash).toMatch(/^\$argon2/);
  });
});

describe('API Key Verification', () => {
  let keyStore: MockAPIKeyStore;

  beforeEach(() => {
    keyStore = new MockAPIKeyStore();
  });

  it('should verify valid API key', async () => {
    const keyPair = generateAPIKey(testConfig);
    const keyHash = await hashAPIKey(keyPair.key);

    const record: APIKeyRecord = {
      keyHash,
      secretHash: await hashAPIKey(keyPair.secret),
      userEmail: 'test@example.com',
      userRoles: ['User'],
      createdAt: new Date(),
      expiresAt: null,
      lastUsedAt: null,
      isActive: true,
      scopes: ['read', 'write'],
      description: 'Test key',
    };

    await keyStore.save(record);

    const result = await verifyAPIKey(keyPair.key, keyPair.secret, keyStore);

    expect(result).toBeDefined();
    expect(result?.userEmail).toBe('test@example.com');
    expect(result?.userRoles).toContain('User');
  });

  it('should reject invalid API key', async () => {
    const keyPair = generateAPIKey(testConfig);

    await expect(
      verifyAPIKey(keyPair.key, keyPair.secret, keyStore),
    ).rejects.toThrow(AuthenticationError);
  });

  it('should reject revoked API key', async () => {
    const keyPair = generateAPIKey(testConfig);
    const keyHash = await hashAPIKey(keyPair.key);

    const record: APIKeyRecord = {
      keyHash,
      secretHash: await hashAPIKey(keyPair.secret),
      userEmail: 'test@example.com',
      userRoles: ['User'],
      createdAt: new Date(),
      expiresAt: null,
      lastUsedAt: null,
      isActive: false, // Revoked
      scopes: ['read'],
      description: 'Revoked key',
      revokedAt: new Date(),
    };

    await keyStore.save(record);

    await expect(
      verifyAPIKey(keyPair.key, keyPair.secret, keyStore),
    ).rejects.toThrow('API key has been revoked');
  });

  it('should reject expired API key', async () => {
    const keyPair = generateAPIKey(testConfig);
    const keyHash = await hashAPIKey(keyPair.key);

    const record: APIKeyRecord = {
      keyHash,
      secretHash: await hashAPIKey(keyPair.secret),
      userEmail: 'test@example.com',
      userRoles: ['User'],
      createdAt: new Date(Date.now() - 86400000 * 30), // 30 days ago
      expiresAt: new Date(Date.now() - 86400000), // Expired yesterday
      lastUsedAt: null,
      isActive: true,
      scopes: ['read'],
      description: 'Expired key',
    };

    await keyStore.save(record);

    await expect(
      verifyAPIKey(keyPair.key, keyPair.secret, keyStore),
    ).rejects.toThrow('API key has expired');
  });

  it('should reject incorrect secret', async () => {
    const keyPair = generateAPIKey(testConfig);
    const wrongKeyPair = generateAPIKey(testConfig);
    const keyHash = await hashAPIKey(keyPair.key);

    const record: APIKeyRecord = {
      keyHash,
      secretHash: await hashAPIKey(keyPair.secret),
      userEmail: 'test@example.com',
      userRoles: ['User'],
      createdAt: new Date(),
      expiresAt: null,
      lastUsedAt: null,
      isActive: true,
      scopes: ['read'],
      description: 'Test key',
    };

    await keyStore.save(record);

    await expect(
      verifyAPIKey(keyPair.key, wrongKeyPair.secret, keyStore),
    ).rejects.toThrow('Invalid API key');
  });

  it('should update lastUsedAt on successful verification', async () => {
    const keyPair = generateAPIKey(testConfig);
    const keyHash = await hashAPIKey(keyPair.key);

    const record: APIKeyRecord = {
      keyHash,
      secretHash: await hashAPIKey(keyPair.secret),
      userEmail: 'test@example.com',
      userRoles: ['User'],
      createdAt: new Date(),
      expiresAt: null,
      lastUsedAt: null,
      isActive: true,
      scopes: ['read'],
      description: 'Test key',
    };

    await keyStore.save(record);

    await verifyAPIKey(keyPair.key, keyPair.secret, keyStore);

    const updated = await keyStore.findByHash(keyHash);
    expect(updated?.lastUsedAt).toBeDefined();
    expect(updated?.lastUsedAt).toBeInstanceOf(Date);
  });
});

describe('API Key Revocation', () => {
  let keyStore: MockAPIKeyStore;

  beforeEach(() => {
    keyStore = new MockAPIKeyStore();
  });

  it('should revoke active API key', async () => {
    const keyPair = generateAPIKey(testConfig);
    const keyHash = await hashAPIKey(keyPair.key);

    const record: APIKeyRecord = {
      keyHash,
      secretHash: await hashAPIKey(keyPair.secret),
      userEmail: 'test@example.com',
      userRoles: ['User'],
      createdAt: new Date(),
      expiresAt: null,
      lastUsedAt: null,
      isActive: true,
      scopes: ['read'],
      description: 'Test key',
    };

    await keyStore.save(record);
    await revokeAPIKey(keyHash, keyStore);

    const revoked = await keyStore.findByHash(keyHash);
    expect(revoked?.isActive).toBe(false);
    expect(revoked?.revokedAt).toBeDefined();
  });

  it('should throw when revoking non-existent key', async () => {
    await expect(
      revokeAPIKey('nonexistent-hash', keyStore),
    ).rejects.toThrow('API key not found');
  });
});

describe('List User API Keys', () => {
  let keyStore: MockAPIKeyStore;

  beforeEach(() => {
    keyStore = new MockAPIKeyStore();
  });

  it('should list only active keys for user', async () => {
    const user1 = 'user1@example.com';
    const user2 = 'user2@example.com';

    // Create keys for user1
    for (let i = 0; i < 3; i++) {
      const keyPair = generateAPIKey(testConfig);
      const record: APIKeyRecord = {
        keyHash: await hashAPIKey(keyPair.key),
        secretHash: await hashAPIKey(keyPair.secret),
        userEmail: user1,
        userRoles: ['User'],
        createdAt: new Date(),
        expiresAt: null,
        lastUsedAt: null,
        isActive: true,
        scopes: ['read'],
        description: `Key ${i}`,
      };
      await keyStore.save(record);
    }

    // Create revoked key for user1
    const revokedKeyPair = generateAPIKey(testConfig);
    const revokedRecord: APIKeyRecord = {
      keyHash: await hashAPIKey(revokedKeyPair.key),
      secretHash: await hashAPIKey(revokedKeyPair.secret),
      userEmail: user1,
      userRoles: ['User'],
      createdAt: new Date(),
      expiresAt: null,
      lastUsedAt: null,
      isActive: false,
      scopes: ['read'],
      description: 'Revoked key',
      revokedAt: new Date(),
    };
    await keyStore.save(revokedRecord);

    // Create key for user2
    const user2KeyPair = generateAPIKey(testConfig);
    const user2Record: APIKeyRecord = {
      keyHash: await hashAPIKey(user2KeyPair.key),
      secretHash: await hashAPIKey(user2KeyPair.secret),
      userEmail: user2,
      userRoles: ['User'],
      createdAt: new Date(),
      expiresAt: null,
      lastUsedAt: null,
      isActive: true,
      scopes: ['read'],
      description: 'User2 key',
    };
    await keyStore.save(user2Record);

    const user1Keys = await listUserAPIKeys(user1, keyStore);

    expect(user1Keys).toHaveLength(3);
    expect(user1Keys.every((k) => k.userEmail === user1)).toBe(true);
    expect(user1Keys.every((k) => k.isActive)).toBe(true);
  });

  it('should return empty array for user with no keys', async () => {
    const keys = await listUserAPIKeys('nokeys@example.com', keyStore);
    expect(keys).toHaveLength(0);
  });
});

describe('API Key Permissions', () => {
  let keyStore: MockAPIKeyStore;

  beforeEach(() => {
    keyStore = new MockAPIKeyStore();
  });

  it('should return scopes for valid key', async () => {
    const keyPair = generateAPIKey(testConfig);
    const keyHash = await hashAPIKey(keyPair.key);

    const record: APIKeyRecord = {
      keyHash,
      secretHash: await hashAPIKey(keyPair.secret),
      userEmail: 'test@example.com',
      userRoles: ['User'],
      createdAt: new Date(),
      expiresAt: null,
      lastUsedAt: null,
      isActive: true,
      scopes: ['read', 'write', 'delete'],
      description: 'Test key',
    };

    await keyStore.save(record);

    const permissions = await getAPIKeyPermissions(keyHash, keyStore);

    expect(permissions).toContain('read');
    expect(permissions).toContain('write');
    expect(permissions).toContain('delete');
  });

  it('should throw for non-existent key', async () => {
    await expect(
      getAPIKeyPermissions('nonexistent-hash', keyStore),
    ).rejects.toThrow('API key not found');
  });

  it('should throw for revoked key', async () => {
    const keyPair = generateAPIKey(testConfig);
    const keyHash = await hashAPIKey(keyPair.key);

    const record: APIKeyRecord = {
      keyHash,
      secretHash: await hashAPIKey(keyPair.secret),
      userEmail: 'test@example.com',
      userRoles: ['User'],
      createdAt: new Date(),
      expiresAt: null,
      lastUsedAt: null,
      isActive: false,
      scopes: ['read'],
      description: 'Revoked key',
      revokedAt: new Date(),
    };

    await keyStore.save(record);

    await expect(
      getAPIKeyPermissions(keyHash, keyStore),
    ).rejects.toThrow('API key has been revoked');
  });
});

describe('API Key Rotation', () => {
  let keyStore: MockAPIKeyStore;

  beforeEach(() => {
    keyStore = new MockAPIKeyStore();
  });

  it('should rotate API key and return new key pair', async () => {
    const oldKeyPair = generateAPIKey(testConfig);
    const oldKeyHash = await hashAPIKey(oldKeyPair.key);

    const record: APIKeyRecord = {
      keyHash: oldKeyHash,
      secretHash: await hashAPIKey(oldKeyPair.secret),
      userEmail: 'test@example.com',
      userRoles: ['User'],
      createdAt: new Date(),
      expiresAt: null,
      lastUsedAt: null,
      isActive: true,
      scopes: ['read', 'write'],
      description: 'Test key',
    };

    await keyStore.save(record);

    const newKeyPair = await rotateAPIKey(oldKeyHash, testConfig, keyStore);

    expect(newKeyPair.key).toBeDefined();
    expect(newKeyPair.secret).toBeDefined();
    expect(newKeyPair.key).not.toBe(oldKeyPair.key);
    expect(newKeyPair.secret).not.toBe(oldKeyPair.secret);
  });

  it('should revoke old key after rotation', async () => {
    const oldKeyPair = generateAPIKey(testConfig);
    const oldKeyHash = await hashAPIKey(oldKeyPair.key);

    const record: APIKeyRecord = {
      keyHash: oldKeyHash,
      secretHash: await hashAPIKey(oldKeyPair.secret),
      userEmail: 'test@example.com',
      userRoles: ['User'],
      createdAt: new Date(),
      expiresAt: null,
      lastUsedAt: null,
      isActive: true,
      scopes: ['read'],
      description: 'Test key',
    };

    await keyStore.save(record);
    await rotateAPIKey(oldKeyHash, testConfig, keyStore);

    const oldRecord = await keyStore.findByHash(oldKeyHash);
    expect(oldRecord?.isActive).toBe(false);
    expect(oldRecord?.revokedAt).toBeDefined();
  });

  it('should preserve permissions in rotated key', async () => {
    const oldKeyPair = generateAPIKey(testConfig);
    const oldKeyHash = await hashAPIKey(oldKeyPair.key);

    const record: APIKeyRecord = {
      keyHash: oldKeyHash,
      secretHash: await hashAPIKey(oldKeyPair.secret),
      userEmail: 'test@example.com',
      userRoles: ['Admin'],
      createdAt: new Date(),
      expiresAt: null,
      lastUsedAt: null,
      isActive: true,
      scopes: ['read', 'write', 'admin'],
      description: 'Admin key',
    };

    await keyStore.save(record);
    const newKeyPair = await rotateAPIKey(oldKeyHash, testConfig, keyStore);

    // Verify new key works and has same permissions
    const newKeyHash = await hashAPIKey(newKeyPair.key);
    const newRecord = await keyStore.findByHash(newKeyHash);

    expect(newRecord?.userRoles).toContain('Admin');
    expect(newRecord?.scopes).toContain('admin');
  });

  it('should throw when rotating non-existent key', async () => {
    await expect(
      rotateAPIKey('nonexistent-hash', testConfig, keyStore),
    ).rejects.toThrow('API key not found');
  });
});

describe('API Key Scopes', () => {
  let keyStore: MockAPIKeyStore;

  beforeEach(() => {
    keyStore = new MockAPIKeyStore();
  });

  it('should validate scope requirements', async () => {
    const keyPair = generateAPIKey(testConfig);
    const keyHash = await hashAPIKey(keyPair.key);

    const record: APIKeyRecord = {
      keyHash,
      secretHash: await hashAPIKey(keyPair.secret),
      userEmail: 'test@example.com',
      userRoles: ['User'],
      createdAt: new Date(),
      expiresAt: null,
      lastUsedAt: null,
      isActive: true,
      scopes: ['read'],
      description: 'Read-only key',
    };

    await keyStore.save(record);

    const verified = await verifyAPIKey(keyPair.key, keyPair.secret, keyStore);

    expect(verified?.scopes).toContain('read');
    expect(verified?.scopes).not.toContain('write');
  });

  it('should support wildcard scopes', async () => {
    const keyPair = generateAPIKey(testConfig);
    const keyHash = await hashAPIKey(keyPair.key);

    const record: APIKeyRecord = {
      keyHash,
      secretHash: await hashAPIKey(keyPair.secret),
      userEmail: 'test@example.com',
      userRoles: ['Admin'],
      createdAt: new Date(),
      expiresAt: null,
      lastUsedAt: null,
      isActive: true,
      scopes: ['*'], // Wildcard - all permissions
      description: 'Admin key',
    };

    await keyStore.save(record);

    const verified = await verifyAPIKey(keyPair.key, keyPair.secret, keyStore);

    expect(verified?.scopes).toContain('*');
  });
});

describe('API Key Header Parsing', () => {
  it('should extract key and secret from Authorization header', () => {
    const keyPair = generateAPIKey(testConfig);
    const authHeader = `ApiKey ${keyPair.key}:${keyPair.secret}`;

    const parsed = parseAPIKeyHeader(authHeader);

    expect(parsed).toEqual({
      key: keyPair.key,
      secret: keyPair.secret,
    });
  });

  it('should return null for invalid header format', () => {
    expect(parseAPIKeyHeader('Bearer token123')).toBeNull();
    expect(parseAPIKeyHeader('Invalid')).toBeNull();
    expect(parseAPIKeyHeader('')).toBeNull();
    expect(parseAPIKeyHeader(undefined)).toBeNull();
  });

  it('should return null for missing secret', () => {
    const keyPair = generateAPIKey(testConfig);
    const authHeader = `ApiKey ${keyPair.key}`;

    expect(parseAPIKeyHeader(authHeader)).toBeNull();
  });
});

// Helper function for header parsing tests
function parseAPIKeyHeader(header: string | undefined): { key: string; secret: string } | null {
  if (!header || !header.startsWith('ApiKey ')) {
    return null;
  }

  const parts = header.slice(7).split(':');
  if (parts.length !== 2) {
    return null;
  }

  return {
    key: parts[0],
    secret: parts[1],
  };
}

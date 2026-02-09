/**
 * Tests for password hashing and verification
 */

import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../../../src/auth/password.js';

describe('Password Hashing', () => {
  it('should hash a password', async () => {
    const password = 'SecurePassword123';
    const hash = await hashPassword(password);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);
    expect(hash.length).toBeGreaterThan(0);
  });

  it('should generate different hashes for same password', async () => {
    const password = 'SecurePassword123';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    expect(hash1).not.toBe(hash2); // Different salts
  });

  it('should hash contain argon2id identifier', async () => {
    const password = 'SecurePassword123';
    const hash = await hashPassword(password);

    expect(hash).toContain('$argon2id$');
  });
});

describe('Password Verification', () => {
  it('should verify correct password', async () => {
    const password = 'SecurePassword123';
    const hash = await hashPassword(password);

    const isValid = await verifyPassword(hash, password);
    expect(isValid).toBe(true);
  });

  it('should reject incorrect password', async () => {
    const password = 'SecurePassword123';
    const hash = await hashPassword(password);

    const isValid = await verifyPassword(hash, 'WrongPassword');
    expect(isValid).toBe(false);
  });

  it('should reject empty password', async () => {
    const password = 'SecurePassword123';
    const hash = await hashPassword(password);

    const isValid = await verifyPassword(hash, '');
    expect(isValid).toBe(false);
  });

  it('should handle invalid hash format', async () => {
    const isValid = await verifyPassword('invalid-hash', 'password');
    expect(isValid).toBe(false);
  });
});

describe('Password Strength Validation', () => {
  it('should accept valid password', () => {
    const result = validatePasswordStrength('SecurePassword123');
    expect(result.valid).toBe(true);
    expect(result.message).toBeUndefined();
  });

  it('should reject empty password', () => {
    const result = validatePasswordStrength('');
    expect(result.valid).toBe(false);
    expect(result.message).toBe('Password is required');
  });

  it('should reject password shorter than 8 characters', () => {
    const result = validatePasswordStrength('Short1');
    expect(result.valid).toBe(false);
    expect(result.message).toBe('Password must be at least 8 characters long');
  });

  it('should accept exactly 8 characters', () => {
    const result = validatePasswordStrength('12345678');
    expect(result.valid).toBe(true);
  });

  it('should accept long password', () => {
    const result = validatePasswordStrength('VeryLongSecurePassword123!@#$%');
    expect(result.valid).toBe(true);
  });
});

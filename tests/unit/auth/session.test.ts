/**
 * Tests for JWT session management
 */

import { describe, it, expect } from 'vitest';
import {
  generateToken,
  verifyToken,
  decodeToken,
  extractTokenFromHeader,
  type SessionPayload,
  type SessionConfig,
} from '../../../src/auth/session.js';
import { AuthenticationError } from '../../../src/core/errors.js';

const testConfig: SessionConfig = {
  secret: 'test-secret-key-12345',
  expiresIn: '1h',
};

const testPayload: SessionPayload = {
  email: 'test@example.com',
  fullName: 'Test User',
  userType: 'System User',
};

describe('Token Generation', () => {
  it('should generate a valid JWT token', () => {
    const token = generateToken(testPayload, testConfig);

    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
  });

  it('should include payload data in token', () => {
    const token = generateToken(testPayload, testConfig);
    const decoded = decodeToken(token);

    expect(decoded).toBeDefined();
    expect(decoded?.email).toBe(testPayload.email);
    expect(decoded?.fullName).toBe(testPayload.fullName);
    expect(decoded?.userType).toBe(testPayload.userType);
  });

  it('should set expiration time', () => {
    const token = generateToken(testPayload, testConfig);
    const decoded = decodeToken(token);

    expect(decoded?.exp).toBeDefined();
    expect(decoded?.iat).toBeDefined();
    expect(decoded!.exp! > decoded!.iat!).toBe(true);
  });
});

describe('Token Verification', () => {
  it('should verify valid token', () => {
    const token = generateToken(testPayload, testConfig);
    const verified = verifyToken(token, testConfig.secret as string);

    expect(verified.email).toBe(testPayload.email);
    expect(verified.fullName).toBe(testPayload.fullName);
    expect(verified.userType).toBe(testPayload.userType);
  });

  it('should reject token with wrong secret', () => {
    const token = generateToken(testPayload, testConfig);

    expect(() => verifyToken(token, 'wrong-secret')).toThrow(AuthenticationError);
    expect(() => verifyToken(token, 'wrong-secret')).toThrow('Invalid token');
  });

  it('should reject expired token', () => {
    const expiredConfig: SessionConfig = {
      secret: testConfig.secret,
      expiresIn: '-1s', // Already expired
    };

    const token = generateToken(testPayload, expiredConfig);

    expect(() => verifyToken(token, testConfig.secret as string)).toThrow(AuthenticationError);
    expect(() => verifyToken(token, testConfig.secret as string)).toThrow('Token has expired');
  });

  it('should reject malformed token', () => {
    expect(() => verifyToken('invalid.token.here', testConfig.secret as string)).toThrow(
      AuthenticationError,
    );
  });

  it('should reject empty token', () => {
    expect(() => verifyToken('', testConfig.secret as string)).toThrow(AuthenticationError);
  });
});

describe('Token Decoding', () => {
  it('should decode token without verification', () => {
    const token = generateToken(testPayload, testConfig);
    const decoded = decodeToken(token);

    expect(decoded).toBeDefined();
    expect(decoded?.email).toBe(testPayload.email);
  });

  it('should return null for invalid token', () => {
    const decoded = decodeToken('invalid-token');
    expect(decoded).toBeNull();
  });
});

describe('Token Extraction from Header', () => {
  it('should extract token from valid Bearer header', () => {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token';
    const authHeader = `Bearer ${token}`;

    const extracted = extractTokenFromHeader(authHeader);
    expect(extracted).toBe(token);
  });

  it('should return null for missing header', () => {
    const extracted = extractTokenFromHeader(undefined);
    expect(extracted).toBeNull();
  });

  it('should return null for invalid format', () => {
    const extracted = extractTokenFromHeader('InvalidFormat token');
    expect(extracted).toBeNull();
  });

  it('should return null for missing Bearer prefix', () => {
    const extracted = extractTokenFromHeader('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token');
    expect(extracted).toBeNull();
  });

  it('should return null for empty header', () => {
    const extracted = extractTokenFromHeader('');
    expect(extracted).toBeNull();
  });
});

/**
 * JWT session management
 */

import jwt from 'jsonwebtoken';
import { AuthenticationError } from '../core/errors.js';

export interface SessionPayload {
  /** User email (primary key) */
  email: string;
  /** User's full name */
  fullName?: string;
  /** User type (System User or Website User) */
  userType: string;
  /** Token issued at timestamp */
  iat?: number;
  /** Token expiration timestamp */
  exp?: number;
}

export interface SessionConfig {
  /** Secret key for signing tokens */
  secret: string;
  /** Token expiry (e.g., '24h', '7d') */
  expiresIn: string;
}

/**
 * Generate a JWT access token for a user
 *
 * @param payload - User session data
 * @param config - JWT configuration
 * @returns Signed JWT token
 */
export function generateToken(payload: SessionPayload, config: SessionConfig): string {
  return jwt.sign(payload, config.secret, {
    expiresIn: config.expiresIn,
  });
}

/**
 * Verify and decode a JWT token
 *
 * @param token - JWT token to verify
 * @param secret - Secret key used to sign the token
 * @returns Decoded session payload
 * @throws {AuthenticationError} If token is invalid or expired
 */
export function verifyToken(token: string, secret: string): SessionPayload {
  try {
    const decoded = jwt.verify(token, secret) as SessionPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthenticationError('Token has expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthenticationError('Invalid token');
    } else {
      throw new AuthenticationError('Token verification failed');
    }
  }
}

/**
 * Decode a JWT token without verification (useful for debugging)
 *
 * @param token - JWT token to decode
 * @returns Decoded payload or null if invalid
 */
export function decodeToken(token: string): SessionPayload | null {
  try {
    const decoded = jwt.decode(token) as SessionPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Extract token from Authorization header
 *
 * @param authHeader - Authorization header value
 * @returns Token string or null
 */
export function extractTokenFromHeader(authHeader?: string): string | null {
  if (!authHeader) {
    return null;
  }

  // Expected format: "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer') {
    return parts[1];
  }

  return null;
}

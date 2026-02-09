/**
 * Password hashing and verification using argon2
 */

import argon2 from 'argon2';

/**
 * Hash a plain text password using argon2id
 *
 * @param password - Plain text password
 * @returns Hashed password string
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,       // Number of iterations
    parallelism: 4,    // Threads
  });
}

/**
 * Verify a password against a hash
 *
 * @param hash - Hashed password from database
 * @param password - Plain text password to verify
 * @returns True if password matches hash
 */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    // Invalid hash format or verification error
    return false;
  }
}

/**
 * Check if a password meets minimum strength requirements
 *
 * @param password - Password to validate
 * @returns Validation result with error message if invalid
 */
export function validatePasswordStrength(password: string): { valid: boolean; message?: string } {
  if (!password) {
    return { valid: false, message: 'Password is required' };
  }

  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }

  // Optional: Add more strength requirements
  // - At least one uppercase letter
  // - At least one lowercase letter
  // - At least one number
  // - At least one special character

  return { valid: true };
}

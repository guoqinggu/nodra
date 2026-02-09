/**
 * User DocType Controller
 *
 * Handles user-specific business logic including:
 * - Password hashing
 * - Full name generation
 * - API key management
 */

import { Document } from '../../../src/core/document/document.js';
import { ValidationError } from '../../../src/core/errors.js';
import { hashPassword, validatePasswordStrength } from '../../../src/auth/password.js';

export class User extends Document {
  email!: string;
  first_name!: string;
  last_name?: string;
  full_name?: string;
  enabled!: boolean;
  password?: string;
  user_type!: string;

  /**
   * Before validate: generate full name from first and last name
   */
  async beforeValidate(): Promise<void> {
    // Generate full name
    const firstName = (this.get('first_name') ?? this.first_name) as string;
    const lastName = (this.get('last_name') ?? this.last_name) as string | undefined;
    
    if (firstName) {
      const fullName = lastName ? `${firstName} ${lastName}` : firstName;
      this.set('full_name', fullName);
    }
  }

  /**
   * Validate: ensure email is valid format and password meets requirements
   */
  async validate(): Promise<void> {
    const email = (this.get('email') ?? this.email) as string;
    const password = (this.get('password') ?? this.password) as string | undefined;

    // Basic email validation
    if (email && !this.isValidEmail(email)) {
      throw new ValidationError('Invalid email format');
    }

    // Ensure password is set for new users
    if (this.isNew() && !password) {
      throw new ValidationError('Password is required for new users');
    }

    // Validate password strength if password is being set/changed
    if (this.hasChanged('password') && password) {
      const validation = validatePasswordStrength(password);
      if (!validation.valid) {
        throw new ValidationError(validation.message ?? 'Invalid password');
      }
    }
  }

  /**
   * Before save: hash password if changed
   */
  async beforeSave(): Promise<void> {
    const password = (this.get('password') ?? this.password) as string | undefined;
    
    if (this.hasChanged('password') && password) {
      const hashedPassword = await hashPassword(password);
      this.set('password', hashedPassword);
    }
  }

  /**
   * Simple email validation
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

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
    if (this.first_name) {
      this.full_name = this.last_name
        ? `${this.first_name} ${this.last_name}`
        : this.first_name;
    }
  }

  /**
   * Validate: ensure email is valid format
   */
  async validate(): Promise<void> {
    // Basic email validation
    if (this.email && !this.isValidEmail(this.email)) {
      throw new ValidationError('Invalid email format');
    }

    // Ensure password is set for new users
    if (this.isNew() && !this.password) {
      throw new ValidationError('Password is required for new users');
    }
  }

  /**
   * Before save: hash password if changed
   */
  async beforeSave(): Promise<void> {
    // TODO: Hash password using argon2 when auth module is implemented
    // For now, we'll leave password handling for Phase 6
    if (this.hasChanged('password') && this.password) {
      // Placeholder: will be implemented in auth module
      // this.password = await hashPassword(this.password);
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

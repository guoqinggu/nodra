/**
 * Role DocType Controller
 *
 * Handles role-specific business logic
 */

import { Document } from '../../../src/core/document/document.js';
import { ValidationError } from '../../../src/core/errors.js';

export class Role extends Document {
  role_name!: string;
  disabled!: boolean;
  desk_access!: boolean;
  is_custom!: boolean;

  /**
   * Validate: ensure system roles cannot be modified
   */
  override async validate(): Promise<void> {
    // System roles that cannot be deleted or disabled
    const systemRoles = ['System Manager', 'All', 'Guest'];

    // Get role_name from data
    const roleName = (this.get('role_name') ?? this.role_name) as string;

    if (systemRoles.includes(roleName) && !this.isNew()) {
      // Get the disabled value
      const disabledValue = this.get('disabled') ?? this.disabled;
      const hasDisabledChanged = this.hasChanged('disabled');

      if (hasDisabledChanged && disabledValue) {
        throw new ValidationError(`System role '${roleName}' cannot be disabled`);
      }
    }
  }

  /**
   * Before delete: prevent deletion of system roles
   */
  override async beforeDelete(): Promise<void> {
    const systemRoles = ['System Manager', 'All', 'Guest'];

    // Get role_name from data
    const roleName = (this.get('role_name') ?? this.role_name) as string;

    if (systemRoles.includes(roleName)) {
      throw new ValidationError(`System role '${roleName}' cannot be deleted`);
    }
  }
}

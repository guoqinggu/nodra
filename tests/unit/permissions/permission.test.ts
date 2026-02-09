/**
 * Tests for permission system
 */

import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  assertPermission,
  getAccessibleDocTypes,
  hasAnyPermission,
  type UserContext,
  type PermissionAction,
} from '../../../src/permissions/permission.js';
import type { DocTypeDefinition } from '../../../src/core/doctype/schema.js';
import { PermissionError } from '../../../src/core/errors.js';

// Test DocType with various permission rules
const testDocType: DocTypeDefinition = {
  name: 'TestDoc',
  module: 'Test',
  naming_rule: 'autoincrement',
  is_submittable: false,
  is_child: false,
  is_single: false,
  is_tree: false,
  is_virtual: false,
  fields: [],
  permissions: [
    {
      role: 'Admin',
      read: true,
      write: true,
      create: true,
      delete: true,
      submit: false,
      cancel: false,
      amend: false,
      if_owner: false,
    },
    {
      role: 'User',
      read: true,
      write: true,
      create: true,
      delete: false,
      submit: false,
      cancel: false,
      amend: false,
      if_owner: false,
    },
    {
      role: 'Guest',
      read: true,
      write: false,
      create: false,
      delete: false,
      submit: false,
      cancel: false,
      amend: false,
      if_owner: false,
    },
    {
      role: 'Owner',
      read: true,
      write: true,
      create: false,
      delete: true,
      submit: false,
      cancel: false,
      amend: false,
      if_owner: true,
    },
  ],
};

const adminUser: UserContext = {
  email: 'admin@example.com',
  roles: ['Admin'],
};

const regularUser: UserContext = {
  email: 'user@example.com',
  roles: ['User'],
};

const guestUser: UserContext = {
  email: 'guest@example.com',
  roles: ['Guest'],
};

const ownerUser: UserContext = {
  email: 'owner@example.com',
  roles: ['Owner'],
};

const systemManager: UserContext = {
  email: 'sysadmin@example.com',
  roles: ['System Manager'],
};

describe('Permission Checking - Basic Actions', () => {
  it('should allow Admin to read', () => {
    expect(hasPermission(testDocType, 'read', adminUser)).toBe(true);
  });

  it('should allow Admin to write', () => {
    expect(hasPermission(testDocType, 'write', adminUser)).toBe(true);
  });

  it('should allow Admin to create', () => {
    expect(hasPermission(testDocType, 'create', adminUser)).toBe(true);
  });

  it('should allow Admin to delete', () => {
    expect(hasPermission(testDocType, 'delete', adminUser)).toBe(true);
  });

  it('should allow User to read', () => {
    expect(hasPermission(testDocType, 'read', regularUser)).toBe(true);
  });

  it('should allow User to write', () => {
    expect(hasPermission(testDocType, 'write', regularUser)).toBe(true);
  });

  it('should allow User to create', () => {
    expect(hasPermission(testDocType, 'create', regularUser)).toBe(true);
  });

  it('should deny User to delete', () => {
    expect(hasPermission(testDocType, 'delete', regularUser)).toBe(false);
  });
});

describe('Permission Checking - Guest Role', () => {
  it('should allow Guest to read', () => {
    expect(hasPermission(testDocType, 'read', guestUser)).toBe(true);
  });

  it('should deny Guest to write', () => {
    expect(hasPermission(testDocType, 'write', guestUser)).toBe(false);
  });

  it('should deny Guest to create', () => {
    expect(hasPermission(testDocType, 'create', guestUser)).toBe(false);
  });

  it('should deny Guest to delete', () => {
    expect(hasPermission(testDocType, 'delete', guestUser)).toBe(false);
  });
});

describe('Permission Checking - Owner-based Permissions', () => {
  it('should allow owner to delete when if_owner is true', () => {
    expect(hasPermission(testDocType, 'delete', ownerUser, 'owner@example.com')).toBe(true);
  });

  it('should deny owner to delete if not document owner', () => {
    expect(hasPermission(testDocType, 'delete', ownerUser, 'someone@example.com')).toBe(false);
  });

  it('should deny owner role to create (if_owner only applies when is owner)', () => {
    expect(hasPermission(testDocType, 'create', ownerUser)).toBe(false);
  });
});

describe('Permission Checking - System Manager', () => {
  it('should allow System Manager all permissions', () => {
    expect(hasPermission(testDocType, 'read', systemManager)).toBe(true);
    expect(hasPermission(testDocType, 'write', systemManager)).toBe(true);
    expect(hasPermission(testDocType, 'create', systemManager)).toBe(true);
    expect(hasPermission(testDocType, 'delete', systemManager)).toBe(true);
    expect(hasPermission(testDocType, 'submit', systemManager)).toBe(true);
    expect(hasPermission(testDocType, 'cancel', systemManager)).toBe(true);
  });
});

describe('Permission Checking - No Permissions', () => {
  it('should deny user with no matching roles', () => {
    const unknownUser: UserContext = {
      email: 'unknown@example.com',
      roles: ['UnknownRole'],
    };

    expect(hasPermission(testDocType, 'read', unknownUser)).toBe(false);
    expect(hasPermission(testDocType, 'write', unknownUser)).toBe(false);
    expect(hasPermission(testDocType, 'create', unknownUser)).toBe(false);
    expect(hasPermission(testDocType, 'delete', unknownUser)).toBe(false);
  });

  it('should deny when DocType has no permissions defined', () => {
    const noPermDocType: DocTypeDefinition = {
      ...testDocType,
      permissions: [],
    };

    expect(hasPermission(noPermDocType, 'read', regularUser)).toBe(false);
  });
});

describe('Assert Permission', () => {
  it('should not throw when user has permission', () => {
    expect(() => assertPermission(testDocType, 'read', adminUser)).not.toThrow();
  });

  it('should throw PermissionError when user lacks permission', () => {
    expect(() => assertPermission(testDocType, 'delete', regularUser)).toThrow(PermissionError);
  });

  it('should throw with descriptive message', () => {
    expect(() => assertPermission(testDocType, 'delete', guestUser)).toThrow(
      'You do not have permission to delete TestDoc'
    );
  });
});

describe('Get Accessible DocTypes', () => {
  const docTypes: DocTypeDefinition[] = [
    testDocType,
    {
      name: 'PrivateDoc',
      module: 'Test',
      naming_rule: 'autoincrement',
      is_submittable: false,
      is_child: false,
      is_single: false,
      is_tree: false,
      is_virtual: false,
      fields: [],
      permissions: [
        {
          role: 'Admin',
          read: true,
          write: true,
          create: true,
          delete: true,
          submit: false,
          cancel: false,
          amend: false,
          if_owner: false,
        },
      ],
    },
  ];

  it('should return DocTypes user can read', () => {
    const accessible = getAccessibleDocTypes(docTypes, regularUser);
    expect(accessible).toContain('TestDoc');
    expect(accessible).not.toContain('PrivateDoc');
  });

  it('should return all DocTypes for System Manager', () => {
    const accessible = getAccessibleDocTypes(docTypes, systemManager);
    expect(accessible).toContain('TestDoc');
    expect(accessible).toContain('PrivateDoc');
  });

  it('should return empty array for user with no permissions', () => {
    const unknownUser: UserContext = {
      email: 'unknown@example.com',
      roles: ['UnknownRole'],
    };
    const accessible = getAccessibleDocTypes(docTypes, unknownUser);
    expect(accessible).toHaveLength(0);
  });
});

describe('Has Any Permission', () => {
  it('should return true if user has at least one permission', () => {
    expect(hasAnyPermission(testDocType, guestUser)).toBe(true); // Has read
  });

  it('should return false if user has no permissions', () => {
    const unknownUser: UserContext = {
      email: 'unknown@example.com',
      roles: ['UnknownRole'],
    };
    expect(hasAnyPermission(testDocType, unknownUser)).toBe(false);
  });

  it('should return true for System Manager', () => {
    expect(hasAnyPermission(testDocType, systemManager)).toBe(true);
  });
});

describe('Multiple Roles', () => {
  it('should grant permission if any role has permission', () => {
    const multiRoleUser: UserContext = {
      email: 'multi@example.com',
      roles: ['Guest', 'User'], // Guest can't write, but User can
    };

    expect(hasPermission(testDocType, 'write', multiRoleUser)).toBe(true);
  });

  it('should grant highest permission from multiple roles', () => {
    const multiRoleUser: UserContext = {
      email: 'multi@example.com',
      roles: ['Guest', 'Admin'], // Admin has all permissions
    };

    expect(hasPermission(testDocType, 'delete', multiRoleUser)).toBe(true);
  });
});

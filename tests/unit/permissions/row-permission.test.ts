/**
 * Tests for Row-Level Permissions (User Permissions)
 *
 * Row-level permissions restrict which records a user can access based on
 * conditions, Link field values, and document ownership.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  hasRowPermission,
  getRowPermissionFilter,
  applyRowPermissions,
  checkUserPermission,
  type UserPermissionRule,
  type RowPermissionContext,
} from '../../../src/permissions/row-permission.js';
import { PermissionError } from '../../../src/core/errors.js';
import type { UserContext } from '../../../src/permissions/permission.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const salesUser: UserContext = {
  email: 'sales1@example.com',
  roles: ['Sales User'],
};

const salesManager: UserContext = {
  email: 'manager@example.com',
  roles: ['Sales Manager'],
};

const adminUser: UserContext = {
  email: 'admin@example.com',
  roles: ['System Manager'],
};

// Sample documents for testing
const documents = [
  {
    name: 'LEAD-001',
    doctype: 'Lead',
    owner: 'sales1@example.com',
    assigned_to: 'sales1@example.com',
    territory: 'North America',
    status: 'Open',
    company: 'Acme Corp',
  },
  {
    name: 'LEAD-002',
    doctype: 'Lead',
    owner: 'sales2@example.com',
    assigned_to: 'sales2@example.com',
    territory: 'Europe',
    status: 'Open',
    company: 'Globex',
  },
  {
    name: 'LEAD-003',
    doctype: 'Lead',
    owner: 'sales1@example.com',
    assigned_to: 'sales3@example.com',
    territory: 'North America',
    status: 'Converted',
    company: 'Initech',
  },
  {
    name: 'CUST-001',
    doctype: 'Customer',
    owner: 'admin@example.com',
    customer_group: 'Commercial',
    territory: 'North America',
  },
];

// ---------------------------------------------------------------------------
// Tests - Basic Row Permission Checking
// ---------------------------------------------------------------------------

describe('Row Permission - Ownership Based', () => {
  it('should allow owner to access their own document', () => {
    const doc = documents[0]; // owned by sales1
    const context: RowPermissionContext = {
      doctype: 'Lead',
      action: 'read',
      user: salesUser,
      document: doc,
    };

    expect(hasRowPermission(context)).toBe(true);
  });

  it('should deny non-owner access to document without other permissions', () => {
    const doc = documents[1]; // owned by sales2
    const context: RowPermissionContext = {
      doctype: 'Lead',
      action: 'read',
      user: salesUser, // sales1 trying to access sales2's doc
      document: doc,
    };

    expect(hasRowPermission(context)).toBe(false);
  });

  it('should allow assigned user to access document', () => {
    const doc = documents[2]; // assigned to sales3
    const sales3User: UserContext = {
      email: 'sales3@example.com',
      roles: ['Sales User'],
    };

    const context: RowPermissionContext = {
      doctype: 'Lead',
      action: 'read',
      user: sales3User,
      document: doc,
    };

    expect(hasRowPermission(context)).toBe(true);
  });
});

describe('Row Permission - User Permission Rules', () => {
  const userPermissions: UserPermissionRule[] = [
    {
      doctype: 'Lead',
      field: 'territory',
      allowed_values: ['North America'],
      applicable_for: ['Sales User'],
      apply_to_all_doctypes: false,
    },
  ];

  it('should allow access to document matching user permission', () => {
    const doc = documents[0]; // North America territory
    const context: RowPermissionContext = {
      doctype: 'Lead',
      action: 'read',
      user: salesUser,
      document: doc,
      userPermissions,
    };

    expect(hasRowPermission(context)).toBe(true);
  });

  it('should deny access to document not matching user permission', () => {
    const doc = documents[1]; // Europe territory
    const context: RowPermissionContext = {
      doctype: 'Lead',
      action: 'read',
      user: salesUser,
      document: doc,
      userPermissions,
    };

    expect(hasRowPermission(context)).toBe(false);
  });

  it('should ignore user permissions for System Manager', () => {
    const doc = documents[1]; // Europe territory
    const context: RowPermissionContext = {
      doctype: 'Lead',
      action: 'read',
      user: adminUser,
      document: doc,
      userPermissions,
    };

    expect(hasRowPermission(context)).toBe(true);
  });
});

describe('Row Permission - Multiple Field Restrictions', () => {
  const userPermissions: UserPermissionRule[] = [
    {
      doctype: 'Lead',
      field: 'territory',
      allowed_values: ['North America', 'Europe'],
      applicable_for: ['Sales Manager'],
      apply_to_all_doctypes: false,
    },
    {
      doctype: 'Lead',
      field: 'status',
      allowed_values: ['Open', 'Working'],
      applicable_for: ['Sales Manager'],
      apply_to_all_doctypes: false,
    },
  ];

  it('should allow access when all field conditions are met', () => {
    const doc = documents[0]; // North America, Open
    const context: RowPermissionContext = {
      doctype: 'Lead',
      action: 'read',
      user: salesManager,
      document: doc,
      userPermissions,
    };

    expect(hasRowPermission(context)).toBe(true);
  });

  it('should deny access when any field condition is not met', () => {
    const doc = documents[2]; // North America but Converted status
    const context: RowPermissionContext = {
      doctype: 'Lead',
      action: 'read',
      user: salesManager,
      document: doc,
      userPermissions,
    };

    expect(hasRowPermission(context)).toBe(false);
  });
});

describe('Row Permission - Conditional Permissions', () => {
  it('should evaluate custom condition for access', () => {
    const doc = documents[0];
    const context: RowPermissionContext = {
      doctype: 'Lead',
      action: 'read',
      user: salesUser,
      document: doc,
      condition: 'doc.status == "Open" && doc.territory == user.territory',
      userTerritory: 'North America',
    };

    expect(hasRowPermission(context)).toBe(true);
  });

  it('should deny access when condition evaluates to false', () => {
    const doc = documents[1]; // Europe territory
    const context: RowPermissionContext = {
      doctype: 'Lead',
      action: 'read',
      user: salesUser,
      document: doc,
      condition: 'doc.territory == user.territory',
      userTerritory: 'North America',
    };

    expect(hasRowPermission(context)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests - Filter Generation
// ---------------------------------------------------------------------------

describe('Row Permission - Get Filter', () => {
  const userPermissions: UserPermissionRule[] = [
    {
      doctype: 'Lead',
      field: 'territory',
      allowed_values: ['North America'],
      applicable_for: ['Sales User'],
      apply_to_all_doctypes: false,
    },
    {
      doctype: 'Lead',
      field: 'assigned_to',
      allowed_values: ['sales1@example.com'],
      applicable_for: ['Sales User'],
      apply_to_all_doctypes: false,
    },
  ];

  it('should generate filter for single field restriction', () => {
    const filter = getRowPermissionFilter({
      doctype: 'Lead',
      user: salesUser,
      userPermissions: [userPermissions[0]],
    });

    expect(filter).toEqual({
      territory: ['in', ['North America']],
    });
  });

  it('should generate OR filter for multiple field restrictions', () => {
    const filter = getRowPermissionFilter({
      doctype: 'Lead',
      user: salesUser,
      userPermissions,
    });

    expect(filter).toHaveProperty('or');
    expect(filter.or).toHaveLength(2);
  });

  it('should return empty filter for System Manager', () => {
    const filter = getRowPermissionFilter({
      doctype: 'Lead',
      user: adminUser,
      userPermissions,
    });

    expect(filter).toEqual({});
  });

  it('should return deny-all filter when no permissions match', () => {
    const otherUser: UserContext = {
      email: 'other@example.com',
      roles: ['Other Role'],
    };

    const filter = getRowPermissionFilter({
      doctype: 'Lead',
      user: otherUser,
      userPermissions,
    });

    expect(filter).toEqual({ name: ['in', []] }); // Impossible condition
  });
});

// ---------------------------------------------------------------------------
// Tests - Apply Permissions to Lists
// ---------------------------------------------------------------------------

describe('Row Permission - Apply to Document List', () => {
  const userPermissions: UserPermissionRule[] = [
    {
      doctype: 'Lead',
      field: 'territory',
      allowed_values: ['North America'],
      applicable_for: ['Sales User'],
      apply_to_all_doctypes: false,
    },
  ];

  it('should filter list to only allowed documents', () => {
    const allowed = applyRowPermissions({
      documents,
      doctype: 'Lead',
      user: salesUser,
      userPermissions,
    });

    expect(allowed).toHaveLength(2); // LEAD-001 and LEAD-003 are North America
    expect(allowed.map((d) => d.name)).toContain('LEAD-001');
    expect(allowed.map((d) => d.name)).toContain('LEAD-003');
    expect(allowed.map((d) => d.name)).not.toContain('LEAD-002');
  });

  it('should include owned documents even if not matching filter', () => {
    const ownedDoc = {
      name: 'LEAD-004',
      doctype: 'Lead',
      owner: 'sales1@example.com',
      territory: 'Asia', // Not in allowed territories
    };

    const allDocs = [...documents, ownedDoc];

    const allowed = applyRowPermissions({
      documents: allDocs,
      doctype: 'Lead',
      user: salesUser,
      userPermissions,
    });

    expect(allowed.map((d) => d.name)).toContain('LEAD-004'); // Owned by user
  });

  it('should return all documents for System Manager', () => {
    const allowed = applyRowPermissions({
      documents,
      doctype: 'Lead',
      user: adminUser,
      userPermissions,
    });

    expect(allowed).toHaveLength(documents.length);
  });
});

// ---------------------------------------------------------------------------
// Tests - Permission Checking with Actions
// ---------------------------------------------------------------------------

describe('Row Permission - Action-Specific Permissions', () => {
  const userPermissions: UserPermissionRule[] = [
    {
      doctype: 'Lead',
      field: 'territory',
      allowed_values: ['North America'],
      applicable_for: ['Sales User'],
      apply_to_all_doctypes: false,
      permissions: {
        read: true,
        write: false, // Can only read, not write
      },
    },
  ];

  it('should allow read action when permitted', () => {
    const doc = documents[0];
    const context: RowPermissionContext = {
      doctype: 'Lead',
      action: 'read',
      user: salesUser,
      document: doc,
      userPermissions,
    };

    expect(hasRowPermission(context)).toBe(true);
  });

  it('should deny write action when not permitted', () => {
    const doc = documents[0];
    const context: RowPermissionContext = {
      doctype: 'Lead',
      action: 'write',
      user: salesUser,
      document: doc,
      userPermissions,
    };

    expect(hasRowPermission(context)).toBe(false);
  });

  it('should allow owner to write their own document', () => {
    const doc = documents[0]; // owned by sales1
    const context: RowPermissionContext = {
      doctype: 'Lead',
      action: 'write',
      user: salesUser,
      document: doc,
      userPermissions,
      allowOwnerWrite: true,
    };

    expect(hasRowPermission(context)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests - Check User Permission Helper
// ---------------------------------------------------------------------------

describe('Row Permission - Check User Permission Helper', () => {
  const userPermissions: UserPermissionRule[] = [
    {
      doctype: 'Lead',
      field: 'territory',
      allowed_values: ['North America'],
      applicable_for: ['Sales User'],
      apply_to_all_doctypes: false,
    },
  ];

  it('should return true when user has specific permission', () => {
    const hasPerm = checkUserPermission({
      user: salesUser,
      doctype: 'Lead',
      field: 'territory',
      value: 'North America',
      userPermissions,
    });

    expect(hasPerm).toBe(true);
  });

  it('should return false when user does not have specific permission', () => {
    const hasPerm = checkUserPermission({
      user: salesUser,
      doctype: 'Lead',
      field: 'territory',
      value: 'Europe',
      userPermissions,
    });

    expect(hasPerm).toBe(false);
  });

  it('should return true for System Manager regardless of permissions', () => {
    const hasPerm = checkUserPermission({
      user: adminUser,
      doctype: 'Lead',
      field: 'territory',
      value: 'Any Value',
      userPermissions,
    });

    expect(hasPerm).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests - Edge Cases
// ---------------------------------------------------------------------------

describe('Row Permission - Edge Cases', () => {
  it('should handle empty document list', () => {
    const allowed = applyRowPermissions({
      documents: [],
      doctype: 'Lead',
      user: salesUser,
    });

    expect(allowed).toHaveLength(0);
  });

  it('should handle null document', () => {
    const context: RowPermissionContext = {
      doctype: 'Lead',
      action: 'read',
      user: salesUser,
      document: null as unknown as Record<string, unknown>,
    };

    expect(hasRowPermission(context)).toBe(false);
  });

  it('should handle missing field in document', () => {
    const doc = { name: 'LEAD-005', doctype: 'Lead' }; // missing territory
    const userPermissions: UserPermissionRule[] = [
      {
        doctype: 'Lead',
        field: 'territory',
        allowed_values: ['North America'],
        applicable_for: ['Sales User'],
        apply_to_all_doctypes: false,
      },
    ];

    const context: RowPermissionContext = {
      doctype: 'Lead',
      action: 'read',
      user: salesUser,
      document: doc,
      userPermissions,
    };

    expect(hasRowPermission(context)).toBe(false);
  });

  it('should handle wildcard permissions', () => {
    const userPermissions: UserPermissionRule[] = [
      {
        doctype: 'Lead',
        field: 'territory',
        allowed_values: ['*'], // Wildcard - all values
        applicable_for: ['Sales Manager'],
        apply_to_all_doctypes: false,
      },
    ];

    const doc = documents[1]; // Europe territory
    const context: RowPermissionContext = {
      doctype: 'Lead',
      action: 'read',
      user: salesManager,
      document: doc,
      userPermissions,
    };

    expect(hasRowPermission(context)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests - Permission Inheritance
// ---------------------------------------------------------------------------

describe('Row Permission - Cross DocType Permissions', () => {
  const userPermissions: UserPermissionRule[] = [
    {
      doctype: 'Territory',
      field: 'name',
      allowed_values: ['North America'],
      applicable_for: ['Sales User'],
      apply_to_all_doctypes: true, // Applies to all doctypes with territory field
    },
  ];

  it('should apply cross-doctype permission to Lead', () => {
    const doc = documents[0]; // North America
    const context: RowPermissionContext = {
      doctype: 'Lead',
      action: 'read',
      user: salesUser,
      document: doc,
      userPermissions,
    };

    expect(hasRowPermission(context)).toBe(true);
  });

  it('should apply cross-doctype permission to Customer', () => {
    const doc = documents[3]; // North America customer
    const context: RowPermissionContext = {
      doctype: 'Customer',
      action: 'read',
      user: salesUser,
      document: doc,
      userPermissions,
    };

    expect(hasRowPermission(context)).toBe(true);
  });
});

describe('Row Permission - Permission Precedence', () => {
  it('should prioritize explicit document permission over general rule', () => {
    const userPermissions: UserPermissionRule[] = [
      {
        doctype: 'Lead',
        field: 'territory',
        allowed_values: ['North America'],
        applicable_for: ['Sales User'],
        apply_to_all_doctypes: false,
      },
    ];

    const doc = documents[1]; // Europe - not matching territory rule
    const context: RowPermissionContext = {
      doctype: 'Lead',
      action: 'read',
      user: salesUser,
      document: doc,
      userPermissions,
      explicitPermissions: ['LEAD-002'], // Explicitly allowed
    };

    expect(hasRowPermission(context)).toBe(true);
  });
});

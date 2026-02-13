/**
 * Tests for Field-Level Permissions (Plan A - Direct Field List Model)
 */

import { describe, it, expect } from 'vitest';
import {
  hasFieldPermission,
  getVisibleFields,
  getEditableFields,
  filterDocumentByFieldPermissions,
  assertFieldPermission,
  type FieldPermissionRule,
} from '../../../src/permissions/field-permission.js';
import { PermissionError } from '../../../src/core/errors.js';
import type { DocTypeDefinition, FieldDefinition } from '../../../src/core/doctype/schema.js';
import type { UserContext } from '../../../src/permissions/permission.js';

const testFields: FieldDefinition[] = [
  { fieldname: 'name', fieldtype: 'Data', label: 'Name', reqd: true },
  { fieldname: 'email', fieldtype: 'Data', label: 'Email', reqd: true },
  { fieldname: 'phone', fieldtype: 'Data', label: 'Phone' },
  { fieldname: 'salary', fieldtype: 'Currency', label: 'Salary' },
  { fieldname: 'ssn', fieldtype: 'Data', label: 'SSN' },
  { fieldname: 'department', fieldtype: 'Link', label: 'Department', options: 'Department' },
  { fieldname: 'notes', fieldtype: 'Text', label: 'Notes' },
  { fieldname: 'created_by', fieldtype: 'Data', label: 'Created By', read_only: true },
];

const fieldPermissionRules: FieldPermissionRule[] = [
  { role: 'Admin', read: ['*'], write: ['*'] },
  { role: 'HR', read: ['name', 'email', 'phone', 'department', 'salary', 'notes', 'created_by'], write: ['name', 'email', 'phone', 'department', 'salary'] },
  { role: 'Manager', read: ['name', 'email', 'phone', 'department', 'notes', 'created_by'], write: ['name', 'email', 'notes'] },
  { role: 'Employee', read: ['name', 'email'], write: [] },
];

const testDocType: DocTypeDefinition = {
  name: 'Employee',
  module: 'HR',
  naming_rule: 'autoincrement',
  is_submittable: false,
  is_child: false,
  is_single: false,
  is_tree: false,
  is_virtual: false,
  fields: testFields,
  permissions: [],
  field_permissions: fieldPermissionRules,
};

const adminUser: UserContext = { email: 'admin@example.com', roles: ['Admin'] };
const hrUser: UserContext = { email: 'hr@example.com', roles: ['HR'] };
const managerUser: UserContext = { email: 'manager@example.com', roles: ['Manager'] };
const employeeUser: UserContext = { email: 'employee@example.com', roles: ['Employee'] };

describe('Field Permission - Basic Read Access', () => {
  it('should allow Admin to read all fields', () => {
    testFields.forEach((field) => {
      expect(hasFieldPermission(testDocType, field.fieldname, 'read', adminUser)).toBe(true);
    });
  });

  it('should allow HR to read all fields including sensitive', () => {
    expect(hasFieldPermission(testDocType, 'name', 'read', hrUser)).toBe(true);
    expect(hasFieldPermission(testDocType, 'salary', 'read', hrUser)).toBe(true);
    expect(hasFieldPermission(testDocType, 'ssn', 'read', hrUser)).toBe(false);
  });

  it('should allow Manager to read basic and department fields', () => {
    expect(hasFieldPermission(testDocType, 'name', 'read', managerUser)).toBe(true);
    expect(hasFieldPermission(testDocType, 'department', 'read', managerUser)).toBe(true);
    expect(hasFieldPermission(testDocType, 'salary', 'read', managerUser)).toBe(false);
    expect(hasFieldPermission(testDocType, 'ssn', 'read', managerUser)).toBe(false);
  });

  it('should allow Employee to read only basic fields', () => {
    expect(hasFieldPermission(testDocType, 'name', 'read', employeeUser)).toBe(true);
    expect(hasFieldPermission(testDocType, 'email', 'read', employeeUser)).toBe(true);
    expect(hasFieldPermission(testDocType, 'salary', 'read', employeeUser)).toBe(false);
    expect(hasFieldPermission(testDocType, 'ssn', 'read', employeeUser)).toBe(false);
  });
});

describe('Field Permission - Write Access', () => {
  it('should allow Admin to write all fields', () => {
    testFields.forEach((field) => {
      if (!field.read_only) {
        expect(hasFieldPermission(testDocType, field.fieldname, 'write', adminUser)).toBe(true);
      }
    });
  });

  it('should deny HR write access to sensitive fields', () => {
    expect(hasFieldPermission(testDocType, 'ssn', 'write', hrUser)).toBe(false);
    expect(hasFieldPermission(testDocType, 'name', 'write', hrUser)).toBe(true);
  });

  it('should allow Manager to write basic fields', () => {
    expect(hasFieldPermission(testDocType, 'name', 'write', managerUser)).toBe(true);
    expect(hasFieldPermission(testDocType, 'notes', 'write', managerUser)).toBe(true);
    expect(hasFieldPermission(testDocType, 'salary', 'write', managerUser)).toBe(false);
  });

  it('should deny Employee write access to all fields', () => {
    testFields.forEach((field) => {
      expect(hasFieldPermission(testDocType, field.fieldname, 'write', employeeUser)).toBe(false);
    });
  });
});

describe('Field Permission - Read-Only Fields', () => {
  it('should deny write access to read-only fields', () => {
    expect(hasFieldPermission(testDocType, 'created_by', 'write', adminUser)).toBe(false);
    expect(hasFieldPermission(testDocType, 'created_by', 'write', managerUser)).toBe(false);
  });

  it('should allow read access to read-only fields based on permissions', () => {
    expect(hasFieldPermission(testDocType, 'created_by', 'read', adminUser)).toBe(true);
    expect(hasFieldPermission(testDocType, 'created_by', 'read', managerUser)).toBe(true);
  });
});

describe('Field Permission - Get Visible Fields', () => {
  it('should return all fields for Admin', () => {
    const visible = getVisibleFields(testDocType, adminUser);
    expect(visible).toHaveLength(testFields.length);
    expect(visible).toContain('name');
    expect(visible).toContain('ssn');
    expect(visible).toContain('salary');
  });

  it('should return all fields except ssn for HR', () => {
    const visible = getVisibleFields(testDocType, hrUser);
    expect(visible).toContain('name');
    expect(visible).toContain('salary');
    expect(visible).not.toContain('ssn');
  });

  it('should return only basic fields for Manager', () => {
    const visible = getVisibleFields(testDocType, managerUser);
    expect(visible).toContain('name');
    expect(visible).toContain('email');
    expect(visible).toContain('department');
    expect(visible).not.toContain('salary');
    expect(visible).not.toContain('ssn');
  });

  it('should return only basic fields for Employee', () => {
    const visible = getVisibleFields(testDocType, employeeUser);
    expect(visible).toContain('name');
    expect(visible).toContain('email');
    expect(visible).not.toContain('salary');
    expect(visible).not.toContain('ssn');
  });
});

describe('Field Permission - Get Editable Fields', () => {
  it('should return all non-read-only fields for Admin', () => {
    const editable = getEditableFields(testDocType, adminUser);
    expect(editable).toContain('name');
    expect(editable).toContain('salary');
    expect(editable).not.toContain('created_by');
  });

  it('should return writable fields for HR', () => {
    const editable = getEditableFields(testDocType, hrUser);
    expect(editable).toContain('name');
    expect(editable).toContain('salary');
    expect(editable).not.toContain('ssn');
  });

  it('should return basic fields for Manager', () => {
    const editable = getEditableFields(testDocType, managerUser);
    expect(editable).toContain('name');
    expect(editable).toContain('email');
    expect(editable).toContain('notes');
    expect(editable).not.toContain('salary');
    expect(editable).not.toContain('ssn');
    expect(editable).not.toContain('created_by');
  });

  it('should return empty array for Employee', () => {
    const editable = getEditableFields(testDocType, employeeUser);
    expect(editable).toHaveLength(0);
  });
});

describe('Field Permission - Document Filtering', () => {
  const document = {
    name: 'John Doe',
    email: 'john@example.com',
    phone: '555-1234',
    salary: 100000,
    ssn: '123-45-6789',
    department: 'Engineering',
    notes: 'Great employee',
    created_by: 'admin@example.com',
  };

  it('should return full document for Admin', () => {
    const filtered = filterDocumentByFieldPermissions(testDocType, document, adminUser);
    expect(filtered).toEqual(document);
  });

  it('should filter out ssn for HR', () => {
    const filtered = filterDocumentByFieldPermissions(testDocType, document, hrUser);
    expect(filtered).toHaveProperty('name');
    expect(filtered).toHaveProperty('salary');
    expect(filtered).not.toHaveProperty('ssn');
  });

  it('should filter out sensitive fields for Manager', () => {
    const filtered = filterDocumentByFieldPermissions(testDocType, document, managerUser);
    expect(filtered).toHaveProperty('name');
    expect(filtered).toHaveProperty('department');
    expect(filtered).not.toHaveProperty('salary');
    expect(filtered).not.toHaveProperty('ssn');
  });

  it('should only include basic fields for Employee', () => {
    const filtered = filterDocumentByFieldPermissions(testDocType, document, employeeUser);
    expect(filtered).toHaveProperty('name');
    expect(filtered).toHaveProperty('email');
    expect(filtered).not.toHaveProperty('salary');
    expect(filtered).not.toHaveProperty('ssn');
  });
});

describe('Field Permission - Assert Permission', () => {
  it('should not throw when user has field permission', () => {
    expect(() => assertFieldPermission(testDocType, 'name', 'read', adminUser)).not.toThrow();
  });

  it('should throw PermissionError when user lacks field permission', () => {
    expect(() => assertFieldPermission(testDocType, 'ssn', 'read', employeeUser)).toThrow(PermissionError);
  });

  it('should throw with descriptive message', () => {
    expect(() => assertFieldPermission(testDocType, 'salary', 'read', employeeUser)).toThrow(
      'You do not have permission to read field "salary"',
    );
  });
});

describe('Field Permission - Multiple Roles', () => {
  it('should grant highest permission from multiple roles', () => {
    const multiRoleUser: UserContext = {
      email: 'multi@example.com',
      roles: ['Employee', 'Manager'],
    };
    expect(hasFieldPermission(testDocType, 'notes', 'write', multiRoleUser)).toBe(true);
  });

  it('should grant Admin permissions if any role is Admin', () => {
    const multiRoleUser: UserContext = {
      email: 'multi@example.com',
      roles: ['Employee', 'Admin'],
    };
    expect(hasFieldPermission(testDocType, 'ssn', 'read', multiRoleUser)).toBe(true);
  });
});

describe('Field Permission - No Permission Rules', () => {
  it('should deny all access when no field permissions defined', () => {
    const docTypeWithoutFieldPerms: DocTypeDefinition = {
      ...testDocType,
      field_permissions: [],
    };
    testFields.forEach((field) => {
      expect(hasFieldPermission(docTypeWithoutFieldPerms, field.fieldname, 'read', hrUser)).toBe(false);
    });
  });
});

describe('Field Permission - Non-existent Field', () => {
  it('should return false for non-existent field', () => {
    expect(hasFieldPermission(testDocType, 'nonexistent', 'read', adminUser)).toBe(false);
  });

  it('should throw when asserting permission on non-existent field', () => {
    expect(() => assertFieldPermission(testDocType, 'nonexistent', 'read', adminUser)).toThrow(
      'Field "nonexistent" not found',
    );
  });
});

describe('Field Permission - Conditional Permissions', () => {
  const conditionalRules: FieldPermissionRule[] = [
    {
      role: 'Manager',
      read: ['*'],
      write: ['salary'],
      condition: 'doc.department == user.department',
    },
  ];

  const docTypeWithConditions: DocTypeDefinition = {
    ...testDocType,
    field_permissions: conditionalRules,
  };

  it('should evaluate condition for field access', () => {
    const document = { department: 'Engineering' };
    const user: UserContext = {
      email: 'manager@example.com',
      roles: ['Manager'],
      department: 'Engineering',
    };
    expect(hasFieldPermission(docTypeWithConditions, 'salary', 'write', user, document)).toBe(true);
  });

  it('should deny access when condition not met', () => {
    const document = { department: 'Sales' };
    const user: UserContext = {
      email: 'manager@example.com',
      roles: ['Manager'],
      department: 'Engineering',
    };
    expect(hasFieldPermission(docTypeWithConditions, 'salary', 'write', user, document)).toBe(false);
  });
});

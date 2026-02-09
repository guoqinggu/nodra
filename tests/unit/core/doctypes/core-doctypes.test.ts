/**
 * Tests for core DocTypes: User, Role, UserRole, File
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DocTypeRegistry } from '../../../../src/core/doctype/registry.js';
import { loadDocTypeFromFile } from '../../../../src/core/doctype/loader.js';
import { User } from '../../../../doctypes/core/user/user.js';
import { Role } from '../../../../doctypes/core/role/role.js';
import { File } from '../../../../doctypes/core/file/file.js';
import { ValidationError } from '../../../../src/core/errors.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Core DocTypes - User', () => {
  let registry: DocTypeRegistry;

  beforeEach(async () => {
    registry = new DocTypeRegistry();
    const userDocType = await loadDocTypeFromFile(
      path.join(__dirname, '../../../../doctypes/core/user/user.json')
    );
    registry.register(userDocType);
  });

  it('should load User DocType successfully', () => {
    const userDocType = registry.get('User');
    expect(userDocType).toBeDefined();
    expect(userDocType.name).toBe('User');
    expect(userDocType.naming_rule).toBe('field');
  });

  it('should have all required fields', () => {
    const userDocType = registry.get('User');
    const fieldNames = userDocType.fields.map((f) => f.fieldname);

    expect(fieldNames).toContain('email');
    expect(fieldNames).toContain('first_name');
    expect(fieldNames).toContain('last_name');
    expect(fieldNames).toContain('full_name');
    expect(fieldNames).toContain('enabled');
    expect(fieldNames).toContain('password');
    expect(fieldNames).toContain('roles');
  });

  it('should generate full_name from first_name and last_name', async () => {
    const userDocType = registry.get('User');
    const user = new User(userDocType);
    user.set('email', 'test@example.com');
    user.set('first_name', 'John');
    user.set('last_name', 'Doe');
    user.set('password', 'password123');

    await user.beforeValidate();

    expect(user.get('full_name')).toBe('John Doe');
  });

  it('should generate full_name from first_name only', async () => {
    const userDocType = registry.get('User');
    const user = new User(userDocType);
    user.set('email', 'test@example.com');
    user.set('first_name', 'John');
    user.set('password', 'password123');

    await user.beforeValidate();

    expect(user.get('full_name')).toBe('John');
  });

  it('should validate email format', async () => {
    const userDocType = registry.get('User');
    const user = new User(userDocType);
    user.set('email', 'invalid-email');
    user.set('first_name', 'John');
    user.set('password', 'password123');

    await expect(user.validate()).rejects.toThrow(ValidationError);
    await expect(user.validate()).rejects.toThrow('Invalid email format');
  });

  it('should require password for new users', async () => {
    const userDocType = registry.get('User');
    const user = new User(userDocType);
    user.set('email', 'test@example.com');
    user.set('first_name', 'John');
    // No password set

    await expect(user.validate()).rejects.toThrow(ValidationError);
    await expect(user.validate()).rejects.toThrow('Password is required for new users');
  });

  it('should accept valid email format', async () => {
    const userDocType = registry.get('User');
    const user = new User(userDocType);
    user.set('email', 'test@example.com');
    user.set('first_name', 'John');
    user.set('password', 'password123');

    await expect(user.validate()).resolves.not.toThrow();
  });
});

describe('Core DocTypes - Role', () => {
  let registry: DocTypeRegistry;

  beforeEach(async () => {
    registry = new DocTypeRegistry();
    const roleDocType = await loadDocTypeFromFile(
      path.join(__dirname, '../../../../doctypes/core/role/role.json')
    );
    registry.register(roleDocType);
  });

  it('should load Role DocType successfully', () => {
    const roleDocType = registry.get('Role');
    expect(roleDocType).toBeDefined();
    expect(roleDocType.name).toBe('Role');
    expect(roleDocType.naming_rule).toBe('field');
  });

  it('should have all required fields', () => {
    const roleDocType = registry.get('Role');
    const fieldNames = roleDocType.fields.map((f) => f.fieldname);

    expect(fieldNames).toContain('role_name');
    expect(fieldNames).toContain('disabled');
    expect(fieldNames).toContain('desk_access');
    expect(fieldNames).toContain('is_custom');
  });

  it('should prevent disabling system roles', async () => {
    const roleDocType = registry.get('Role');
    const role = new Role(roleDocType, {
      role_name: 'System Manager',
      name: 'System Manager',
      disabled: false,
      _isNew: false,
    });

    // Mark as clean to enable change tracking
    role.markAsClean();

    // Try to disable - need to access through role_name to populate it
    const roleName = role.get('role_name') as string;
    role.set('disabled', true);

    // The validate method needs role_name to be accessible
    await expect(role.validate()).rejects.toThrow(ValidationError);
  });

  it('should prevent deleting system roles', async () => {
    const roleDocType = registry.get('Role');
    const role = new Role(roleDocType, {
      role_name: 'System Manager',
      name: 'System Manager',
    });

    await expect(role.beforeDelete()).rejects.toThrow(ValidationError);
  });

  it('should allow disabling custom roles', async () => {
    const roleDocType = registry.get('Role');
    const role = new Role(roleDocType, {
      role_name: 'Custom Role',
      name: 'Custom Role',
      disabled: true,
      _isNew: false,
    });

    await expect(role.validate()).resolves.not.toThrow();
  });
});

describe('Core DocTypes - User Role', () => {
  let registry: DocTypeRegistry;

  beforeEach(async () => {
    registry = new DocTypeRegistry();
    const userRoleDocType = await loadDocTypeFromFile(
      path.join(__dirname, '../../../../doctypes/core/user_role/user_role.json')
    );
    registry.register(userRoleDocType);
  });

  it('should load User Role DocType successfully', () => {
    const userRoleDocType = registry.get('User Role');
    expect(userRoleDocType).toBeDefined();
    expect(userRoleDocType.name).toBe('User Role');
    expect(userRoleDocType.is_child).toBe(true);
  });

  it('should have role field as Link to Role', () => {
    const userRoleDocType = registry.get('User Role');
    const roleField = userRoleDocType.fields.find((f) => f.fieldname === 'role');

    expect(roleField).toBeDefined();
    expect(roleField?.fieldtype).toBe('Link');
    expect(roleField?.options).toBe('Role');
    expect(roleField?.reqd).toBe(true);
  });
});

describe('Core DocTypes - File', () => {
  let registry: DocTypeRegistry;

  beforeEach(async () => {
    registry = new DocTypeRegistry();
    const fileDocType = await loadDocTypeFromFile(
      path.join(__dirname, '../../../../doctypes/core/file/file.json')
    );
    registry.register(fileDocType);
  });

  it('should load File DocType successfully', () => {
    const fileDocType = registry.get('File');
    expect(fileDocType).toBeDefined();
    expect(fileDocType.name).toBe('File');
    expect(fileDocType.naming_rule).toBe('hash');
  });

  it('should have all required fields', () => {
    const fileDocType = registry.get('File');
    const fieldNames = fileDocType.fields.map((f) => f.fieldname);

    expect(fieldNames).toContain('file_name');
    expect(fieldNames).toContain('file_url');
    expect(fieldNames).toContain('file_size');
    expect(fieldNames).toContain('file_type');
    expect(fieldNames).toContain('is_private');
    expect(fieldNames).toContain('is_folder');
  });

  it('should require file_url for non-folder files', async () => {
    const fileDocType = registry.get('File');
    const file = new File(fileDocType);
    file.file_name = 'test.pdf';
    file.is_folder = false;
    // No file_url set

    await expect(file.validate()).rejects.toThrow(ValidationError);
    await expect(file.validate()).rejects.toThrow('File URL is required for non-folder files');
  });

  it('should not require file_url for folders', async () => {
    const fileDocType = registry.get('File');
    const file = new File(fileDocType);
    file.file_name = 'My Folder';
    file.is_folder = true;
    // No file_url needed

    await expect(file.validate()).resolves.not.toThrow();
  });

  it('should prevent file from being its own parent', async () => {
    const fileDocType = registry.get('File');
    const file = new File(fileDocType, {
      name: 'file-001',
    });
    file.file_name = 'test.pdf';
    file.file_url = '/files/test.pdf';
    file.folder = 'file-001'; // Same as own name

    await expect(file.validate()).rejects.toThrow(ValidationError);
    await expect(file.validate()).rejects.toThrow('File cannot be its own parent folder');
  });
});

describe('Core DocTypes - DocType', () => {
  let registry: DocTypeRegistry;

  beforeEach(async () => {
    registry = new DocTypeRegistry();
    const docTypeDocType = await loadDocTypeFromFile(
      path.join(__dirname, '../../../../doctypes/core/doctype/doctype.json')
    );
    registry.register(docTypeDocType);
  });

  it('should load DocType DocType successfully', () => {
    const docTypeDocType = registry.get('DocType');
    expect(docTypeDocType).toBeDefined();
    expect(docTypeDocType.name).toBe('DocType');
    expect(docTypeDocType.naming_rule).toBe('field');
  });

  it('should have all required fields', () => {
    const docTypeDocType = registry.get('DocType');
    const fieldNames = docTypeDocType.fields.map((f) => f.fieldname);

    expect(fieldNames).toContain('name');
    expect(fieldNames).toContain('module');
    expect(fieldNames).toContain('naming_rule');
    expect(fieldNames).toContain('is_submittable');
    expect(fieldNames).toContain('is_child');
    expect(fieldNames).toContain('fields');
    expect(fieldNames).toContain('permissions');
  });

  it('should have fields as Table field', () => {
    const docTypeDocType = registry.get('DocType');
    const fieldsField = docTypeDocType.fields.find((f) => f.fieldname === 'fields');

    expect(fieldsField).toBeDefined();
    expect(fieldsField?.fieldtype).toBe('Table');
    expect(fieldsField?.options).toBe('DocField');
  });

  it('should have permissions as Table field', () => {
    const docTypeDocType = registry.get('DocType');
    const permsField = docTypeDocType.fields.find((f) => f.fieldname === 'permissions');

    expect(permsField).toBeDefined();
    expect(permsField?.fieldtype).toBe('Table');
    expect(permsField?.options).toBe('DocPerm');
  });
});

describe('Core DocTypes - DocField', () => {
  let registry: DocTypeRegistry;

  beforeEach(async () => {
    registry = new DocTypeRegistry();
    const docFieldDocType = await loadDocTypeFromFile(
      path.join(__dirname, '../../../../doctypes/core/docfield/docfield.json')
    );
    registry.register(docFieldDocType);
  });

  it('should load DocField DocType successfully', () => {
    const docFieldDocType = registry.get('DocField');
    expect(docFieldDocType).toBeDefined();
    expect(docFieldDocType.name).toBe('DocField');
    expect(docFieldDocType.is_child).toBe(true);
  });

  it('should have all required fields', () => {
    const docFieldDocType = registry.get('DocField');
    const fieldNames = docFieldDocType.fields.map((f) => f.fieldname);

    expect(fieldNames).toContain('fieldname');
    expect(fieldNames).toContain('fieldtype');
    expect(fieldNames).toContain('label');
    expect(fieldNames).toContain('options');
    expect(fieldNames).toContain('reqd');
    expect(fieldNames).toContain('unique');
  });
});

describe('Core DocTypes - DocPerm', () => {
  let registry: DocTypeRegistry;

  beforeEach(async () => {
    registry = new DocTypeRegistry();
    const docPermDocType = await loadDocTypeFromFile(
      path.join(__dirname, '../../../../doctypes/core/docperm/docperm.json')
    );
    registry.register(docPermDocType);
  });

  it('should load DocPerm DocType successfully', () => {
    const docPermDocType = registry.get('DocPerm');
    expect(docPermDocType).toBeDefined();
    expect(docPermDocType.name).toBe('DocPerm');
    expect(docPermDocType.is_child).toBe(true);
  });

  it('should have all permission fields', () => {
    const docPermDocType = registry.get('DocPerm');
    const fieldNames = docPermDocType.fields.map((f) => f.fieldname);

    expect(fieldNames).toContain('role');
    expect(fieldNames).toContain('read');
    expect(fieldNames).toContain('write');
    expect(fieldNames).toContain('create');
    expect(fieldNames).toContain('delete');
    expect(fieldNames).toContain('submit');
    expect(fieldNames).toContain('cancel');
    expect(fieldNames).toContain('if_owner');
  });

  it('should have role field as Link to Role', () => {
    const docPermDocType = registry.get('DocPerm');
    const roleField = docPermDocType.fields.find((f) => f.fieldname === 'role');

    expect(roleField).toBeDefined();
    expect(roleField?.fieldtype).toBe('Link');
    expect(roleField?.options).toBe('Role');
    expect(roleField?.reqd).toBe(true);
  });
});

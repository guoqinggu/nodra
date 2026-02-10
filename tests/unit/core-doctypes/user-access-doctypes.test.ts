/**
 * Tests for User & Access DocTypes: User, Role, User Role
 */

import { describe, it, expect } from 'vitest';
import { loadDocTypeFromFile } from '../../../src/core/doctype/loader.js';
import path from 'node:path';

const DOCTYPES_DIR = path.resolve(process.cwd(), 'doctypes/core');

describe('User & Access DocTypes', () => {
	describe('User', () => {
		it('should load User definition', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'user/user.json'));

			expect(doctype.name).toBe('User');
			expect(doctype.module).toBe('Core');
			expect(doctype.naming_rule).toBe('field');
			expect(doctype.is_child).toBe(false);
			expect(doctype.is_submittable).toBe(false);
		});

		it('should have email as naming field', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'user/user.json'));
			const fieldnames = doctype.fields.map((f) => f.fieldname);

			expect(fieldnames).toContain('email');

			const emailField = doctype.fields.find((f) => f.fieldname === 'email');
			expect(emailField?.reqd).toBe(true);
			expect(emailField?.unique).toBe(true);
			expect(emailField?.fieldtype).toBe('Data');
		});

		it('should have user identity fields', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'user/user.json'));
			const fieldnames = doctype.fields.map((f) => f.fieldname);

			expect(fieldnames).toContain('first_name');
			expect(fieldnames).toContain('last_name');
			expect(fieldnames).toContain('full_name');
			expect(fieldnames).toContain('enabled');
		});

		it('should have password field with Password type', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'user/user.json'));

			const passwordField = doctype.fields.find((f) => f.fieldname === 'password');
			expect(passwordField).toBeDefined();
			expect(passwordField?.fieldtype).toBe('Password');
			expect(passwordField?.hidden).toBe(true);
		});

		it('should have API credentials fields', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'user/user.json'));
			const fieldnames = doctype.fields.map((f) => f.fieldname);

			expect(fieldnames).toContain('api_key');
			expect(fieldnames).toContain('api_secret');
		});

		it('should have roles as Table field', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'user/user.json'));

			const rolesField = doctype.fields.find((f) => f.fieldname === 'roles');
			expect(rolesField).toBeDefined();
			expect(rolesField?.fieldtype).toBe('Table');
			expect(rolesField?.options).toBe('User Role');
		});

		it('should have tracking fields', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'user/user.json'));
			const fieldnames = doctype.fields.map((f) => f.fieldname);

			expect(fieldnames).toContain('last_login');
			expect(fieldnames).toContain('last_ip');
		});

		it('should have valid permissions', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'user/user.json'));

			expect(doctype.permissions.length).toBeGreaterThan(0);

			const sysMgrPerm = doctype.permissions.find((p) => p.role === 'System Manager');
			expect(sysMgrPerm).toBeDefined();
			expect(sysMgrPerm?.read).toBe(true);
			expect(sysMgrPerm?.write).toBe(true);
			expect(sysMgrPerm?.create).toBe(true);
			expect(sysMgrPerm?.delete).toBe(true);

			// Users can read their own data
			const allPerm = doctype.permissions.find((p) => p.role === 'All');
			expect(allPerm).toBeDefined();
			expect(allPerm?.read).toBe(true);
			expect(allPerm?.if_owner).toBe(true);
		});
	});

	describe('Role', () => {
		it('should load Role definition', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'role/role.json'));

			expect(doctype.name).toBe('Role');
			expect(doctype.module).toBe('Core');
			expect(doctype.naming_rule).toBe('field');
			expect(doctype.is_child).toBe(false);
			expect(doctype.is_submittable).toBe(false);
		});

		it('should have role_name as naming field', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'role/role.json'));
			const fieldnames = doctype.fields.map((f) => f.fieldname);

			expect(fieldnames).toContain('role_name');

			const roleNameField = doctype.fields.find((f) => f.fieldname === 'role_name');
			expect(roleNameField?.reqd).toBe(true);
			expect(roleNameField?.unique).toBe(true);
			expect(roleNameField?.fieldtype).toBe('Data');
		});

		it('should have role control fields', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'role/role.json'));
			const fieldnames = doctype.fields.map((f) => f.fieldname);

			expect(fieldnames).toContain('disabled');
			expect(fieldnames).toContain('desk_access');
			expect(fieldnames).toContain('is_custom');
		});

		it('should have valid permissions', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'role/role.json'));

			expect(doctype.permissions.length).toBeGreaterThan(0);

			const sysMgrPerm = doctype.permissions.find((p) => p.role === 'System Manager');
			expect(sysMgrPerm).toBeDefined();
			expect(sysMgrPerm?.read).toBe(true);
			expect(sysMgrPerm?.write).toBe(true);
			expect(sysMgrPerm?.create).toBe(true);
			expect(sysMgrPerm?.delete).toBe(true);

			// All users can read roles
			const allPerm = doctype.permissions.find((p) => p.role === 'All');
			expect(allPerm).toBeDefined();
			expect(allPerm?.read).toBe(true);
		});
	});

	describe('User Role', () => {
		it('should load User Role definition', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'user_role/user_role.json'));

			expect(doctype.name).toBe('User Role');
			expect(doctype.module).toBe('Core');
			expect(doctype.naming_rule).toBe('autoincrement');
			expect(doctype.is_child).toBe(true);
			expect(doctype.is_submittable).toBe(false);
		});

		it('should have child table fields', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'user_role/user_role.json'));
			const fieldnames = doctype.fields.map((f) => f.fieldname);

			// Child table fields (auto-injected)
			expect(fieldnames).toContain('parent');
			expect(fieldnames).toContain('parenttype');
			expect(fieldnames).toContain('parentfield');
		});

		it('should have role as Link to Role', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'user_role/user_role.json'));

			const roleField = doctype.fields.find((f) => f.fieldname === 'role');
			expect(roleField).toBeDefined();
			expect(roleField?.fieldtype).toBe('Link');
			expect(roleField?.options).toBe('Role');
			expect(roleField?.reqd).toBe(true);
		});
	});
});

/**
 * Tests for Meta DocTypes: DocType, DocField, DocPerm
 */

import { describe, it, expect } from 'vitest';
import { loadDocTypeFromFile } from '../../../src/core/doctype/loader.js';
import path from 'node:path';

const DOCTYPES_DIR = path.resolve(process.cwd(), 'doctypes/core');

describe('Meta DocTypes', () => {
	describe('DocType', () => {
		it('should load DocType definition', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'doctype/doctype.json'));

			expect(doctype.name).toBe('DocType');
			expect(doctype.module).toBe('Core');
			expect(doctype.naming_rule).toBe('field');
			expect(doctype.is_child).toBe(false);
			expect(doctype.is_submittable).toBe(false);
		});

		it('should have required fields', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'doctype/doctype.json'));
			const fieldnames = doctype.fields.map((f) => f.fieldname);

			// Standard fields (auto-injected)
			expect(fieldnames).toContain('name');
			expect(fieldnames).toContain('owner');
			expect(fieldnames).toContain('creation');
			expect(fieldnames).toContain('modified');
			expect(fieldnames).toContain('modified_by');
			expect(fieldnames).toContain('docstatus');
			expect(fieldnames).toContain('idx');

			// DocType-specific fields
			expect(fieldnames).toContain('module');
			expect(fieldnames).toContain('naming_rule');
			expect(fieldnames).toContain('is_submittable');
			expect(fieldnames).toContain('is_child');
			expect(fieldnames).toContain('fields'); // Table field
			expect(fieldnames).toContain('permissions'); // Table field
		});

		it('should have fields and permissions as Table fields', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'doctype/doctype.json'));

			const fieldsField = doctype.fields.find((f) => f.fieldname === 'fields');
			expect(fieldsField).toBeDefined();
			expect(fieldsField?.fieldtype).toBe('Table');
			expect(fieldsField?.options).toBe('DocField');

			const permsField = doctype.fields.find((f) => f.fieldname === 'permissions');
			expect(permsField).toBeDefined();
			expect(permsField?.fieldtype).toBe('Table');
			expect(permsField?.options).toBe('DocPerm');
		});

		it('should have valid permissions', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'doctype/doctype.json'));

			expect(doctype.permissions.length).toBeGreaterThan(0);

			const sysMgrPerm = doctype.permissions.find((p) => p.role === 'System Manager');
			expect(sysMgrPerm).toBeDefined();
			expect(sysMgrPerm?.read).toBe(true);
			expect(sysMgrPerm?.write).toBe(true);
			expect(sysMgrPerm?.create).toBe(true);
			expect(sysMgrPerm?.delete).toBe(true);
		});
	});

	describe('DocField', () => {
		it('should load DocField definition', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'docfield/docfield.json'));

			expect(doctype.name).toBe('DocField');
			expect(doctype.module).toBe('Core');
			expect(doctype.naming_rule).toBe('autoincrement');
			expect(doctype.is_child).toBe(true);
			expect(doctype.is_submittable).toBe(false);
		});

		it('should have child table fields', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'docfield/docfield.json'));
			const fieldnames = doctype.fields.map((f) => f.fieldname);

			// Child table fields (auto-injected)
			expect(fieldnames).toContain('parent');
			expect(fieldnames).toContain('parenttype');
			expect(fieldnames).toContain('parentfield');
		});

		it('should have required field definition fields', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'docfield/docfield.json'));
			const fieldnames = doctype.fields.map((f) => f.fieldname);

			expect(fieldnames).toContain('fieldname');
			expect(fieldnames).toContain('fieldtype');
			expect(fieldnames).toContain('label');
			expect(fieldnames).toContain('options');
			expect(fieldnames).toContain('reqd');
			expect(fieldnames).toContain('unique');
			expect(fieldnames).toContain('default');
			expect(fieldnames).toContain('max_length');
		});

		it('should have fieldtype as Select with valid options', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'docfield/docfield.json'));

			const fieldtypeField = doctype.fields.find((f) => f.fieldname === 'fieldtype');
			expect(fieldtypeField).toBeDefined();
			expect(fieldtypeField?.fieldtype).toBe('Select');
			expect(Array.isArray(fieldtypeField?.options)).toBe(true);

			const options = fieldtypeField?.options as string[];
			expect(options).toContain('Data');
			expect(options).toContain('Int');
			expect(options).toContain('Link');
			expect(options).toContain('Table');
			expect(options).toContain('Check');
		});
	});

	describe('DocPerm', () => {
		it('should load DocPerm definition', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'docperm/docperm.json'));

			expect(doctype.name).toBe('DocPerm');
			expect(doctype.module).toBe('Core');
			expect(doctype.naming_rule).toBe('autoincrement');
			expect(doctype.is_child).toBe(true);
			expect(doctype.is_submittable).toBe(false);
		});

		it('should have child table fields', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'docperm/docperm.json'));
			const fieldnames = doctype.fields.map((f) => f.fieldname);

			// Child table fields (auto-injected)
			expect(fieldnames).toContain('parent');
			expect(fieldnames).toContain('parenttype');
			expect(fieldnames).toContain('parentfield');
		});

		it('should have permission flag fields', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'docperm/docperm.json'));
			const fieldnames = doctype.fields.map((f) => f.fieldname);

			expect(fieldnames).toContain('role');
			expect(fieldnames).toContain('read');
			expect(fieldnames).toContain('write');
			expect(fieldnames).toContain('create');
			expect(fieldnames).toContain('delete');
			expect(fieldnames).toContain('submit');
			expect(fieldnames).toContain('cancel');
			expect(fieldnames).toContain('amend');
			expect(fieldnames).toContain('if_owner');
		});

		it('should have role as Link to Role', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'docperm/docperm.json'));

			const roleField = doctype.fields.find((f) => f.fieldname === 'role');
			expect(roleField).toBeDefined();
			expect(roleField?.fieldtype).toBe('Link');
			expect(roleField?.options).toBe('Role');
			expect(roleField?.reqd).toBe(true);
		});
	});
});

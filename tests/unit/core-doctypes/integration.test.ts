/**
 * Integration test: Load all core DocTypes from directory
 */

import { describe, it, expect } from 'vitest';
import { loadDocTypesFromDirectory } from '../../../src/core/doctype/loader.js';
import path from 'node:path';

const DOCTYPES_DIR = path.resolve(process.cwd(), 'doctypes/core');

describe('Load All Core DocTypes', () => {
	it('should load all core DocTypes from directory', async () => {
		const doctypes = await loadDocTypesFromDirectory(DOCTYPES_DIR);

		// Should have loaded all core DocTypes
		expect(doctypes.length).toBeGreaterThanOrEqual(10);

		const doctypeNames = doctypes.map((dt) => dt.name);

		// Meta DocTypes
		expect(doctypeNames).toContain('DocType');
		expect(doctypeNames).toContain('DocField');
		expect(doctypeNames).toContain('DocPerm');
		expect(doctypeNames).toContain('Module Def');

		// User & Access DocTypes
		expect(doctypeNames).toContain('User');
		expect(doctypeNames).toContain('Role');
		expect(doctypeNames).toContain('User Role');
		expect(doctypeNames).toContain('User Permission');

		// System DocTypes
		expect(doctypeNames).toContain('File');
		expect(doctypeNames).toContain('Workflow');
		expect(doctypeNames).toContain('Workflow State');
		expect(doctypeNames).toContain('Workflow Transition');
	});

	it('should have child DocTypes marked correctly', async () => {
		const doctypes = await loadDocTypesFromDirectory(DOCTYPES_DIR);

		const childDocTypes = doctypes.filter((dt) => dt.is_child);
		const childNames = childDocTypes.map((dt) => dt.name);

		expect(childNames).toContain('DocField');
		expect(childNames).toContain('DocPerm');
		expect(childNames).toContain('User Role');
		expect(childNames).toContain('Workflow State');
		expect(childNames).toContain('Workflow Transition');
	});

	it('should have parent DocTypes marked correctly', async () => {
		const doctypes = await loadDocTypesFromDirectory(DOCTYPES_DIR);

		const parentDocTypes = doctypes.filter((dt) => !dt.is_child);
		const parentNames = parentDocTypes.map((dt) => dt.name);

		expect(parentNames).toContain('DocType');
		expect(parentNames).toContain('Module Def');
		expect(parentNames).toContain('User');
		expect(parentNames).toContain('Role');
		expect(parentNames).toContain('User Permission');
		expect(parentNames).toContain('File');
		expect(parentNames).toContain('Workflow');
	});

	it('should inject standard fields in all DocTypes', async () => {
		const doctypes = await loadDocTypesFromDirectory(DOCTYPES_DIR);

		for (const doctype of doctypes) {
			const fieldnames = doctype.fields.map((f) => f.fieldname);

			// All DocTypes should have standard fields
			expect(fieldnames, `DocType "${doctype.name}" missing standard fields`).toContain('name');
			expect(fieldnames, `DocType "${doctype.name}" missing standard fields`).toContain('owner');
			expect(fieldnames, `DocType "${doctype.name}" missing standard fields`).toContain('creation');
			expect(fieldnames, `DocType "${doctype.name}" missing standard fields`).toContain('modified');
			expect(fieldnames, `DocType "${doctype.name}" missing standard fields`).toContain('modified_by');
			expect(fieldnames, `DocType "${doctype.name}" missing standard fields`).toContain('docstatus');
			expect(fieldnames, `DocType "${doctype.name}" missing standard fields`).toContain('idx');
		}
	});

	it('should inject child table fields in child DocTypes', async () => {
		const doctypes = await loadDocTypesFromDirectory(DOCTYPES_DIR);

		const childDocTypes = doctypes.filter((dt) => dt.is_child);

		for (const doctype of childDocTypes) {
			const fieldnames = doctype.fields.map((f) => f.fieldname);

			// Child DocTypes should have parent tracking fields
			expect(fieldnames, `Child DocType "${doctype.name}" missing parent fields`).toContain('parent');
			expect(fieldnames, `Child DocType "${doctype.name}" missing parent fields`).toContain('parenttype');
			expect(fieldnames, `Child DocType "${doctype.name}" missing parent fields`).toContain('parentfield');
		}
	});

	it('should have valid Table field references', async () => {
		const doctypes = await loadDocTypesFromDirectory(DOCTYPES_DIR);
		const doctypeNames = doctypes.map((dt) => dt.name);

		for (const doctype of doctypes) {
			const tableFields = doctype.fields.filter((f) => f.fieldtype === 'Table');

			for (const field of tableFields) {
				const targetDocType = field.options as string;
				expect(
					doctypeNames,
					`Table field "${field.fieldname}" in "${doctype.name}" references non-existent DocType "${targetDocType}"`
				).toContain(targetDocType);

				// Target should be a child DocType
				const target = doctypes.find((dt) => dt.name === targetDocType);
				expect(
					target?.is_child,
					`Table field "${field.fieldname}" in "${doctype.name}" references "${targetDocType}" which is not a child DocType`
				).toBe(true);
			}
		}
	});

	it('should have valid naming rules', async () => {
		const doctypes = await loadDocTypesFromDirectory(DOCTYPES_DIR);

		const validNamingRules = ['autoincrement', 'hash', 'field', 'format', 'prompt', 'expression'];

		for (const doctype of doctypes) {
			expect(
				validNamingRules,
				`DocType "${doctype.name}" has invalid naming_rule "${doctype.naming_rule}"`
			).toContain(doctype.naming_rule);
		}
	});
});

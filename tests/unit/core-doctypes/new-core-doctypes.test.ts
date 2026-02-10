/**
 * Tests for newly created core DocTypes: Module Def, User Permission, Workflow, Workflow State, Workflow Transition
 */

import { describe, it, expect } from 'vitest';
import { loadDocTypeFromFile } from '../../../src/core/doctype/loader.js';
import path from 'node:path';

const DOCTYPES_DIR = path.resolve(process.cwd(), 'doctypes/core');

describe('New Core DocTypes', () => {
	describe('Module Def', () => {
		it('should load Module Def definition', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'module_def/module_def.json'));

			expect(doctype.name).toBe('Module Def');
			expect(doctype.module).toBe('Core');
			expect(doctype.naming_rule).toBe('field');
			expect(doctype.is_child).toBe(false);
		});

		it('should have module metadata fields', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'module_def/module_def.json'));
			const fieldnames = doctype.fields.map((f) => f.fieldname);

			expect(fieldnames).toContain('name');
			expect(fieldnames).toContain('app');
			expect(fieldnames).toContain('package');
		});
	});

	describe('User Permission', () => {
		it('should load User Permission definition', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'user_permission/user_permission.json'));

			expect(doctype.name).toBe('User Permission');
			expect(doctype.module).toBe('Core');
			expect(doctype.naming_rule).toBe('autoincrement');
			expect(doctype.is_child).toBe(false);
		});

		it('should have permission restriction fields', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'user_permission/user_permission.json'));
			const fieldnames = doctype.fields.map((f) => f.fieldname);

			expect(fieldnames).toContain('user');
			expect(fieldnames).toContain('allow');
			expect(fieldnames).toContain('for_value');
			expect(fieldnames).toContain('applicable_for');
		});

		it('should have user as Link to User', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'user_permission/user_permission.json'));

			const userField = doctype.fields.find((f) => f.fieldname === 'user');
			expect(userField).toBeDefined();
			expect(userField?.fieldtype).toBe('Link');
			expect(userField?.options).toBe('User');
			expect(userField?.reqd).toBe(true);
		});
	});

	describe('Workflow', () => {
		it('should load Workflow definition', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'workflow/workflow.json'));

			expect(doctype.name).toBe('Workflow');
			expect(doctype.module).toBe('Core');
			expect(doctype.naming_rule).toBe('field');
			expect(doctype.is_child).toBe(false);
		});

		it('should have workflow configuration fields', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'workflow/workflow.json'));
			const fieldnames = doctype.fields.map((f) => f.fieldname);

			expect(fieldnames).toContain('name');
			expect(fieldnames).toContain('document_type');
			expect(fieldnames).toContain('workflow_state_field');
			expect(fieldnames).toContain('is_active');
		});

		it('should have states and transitions as Table fields', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'workflow/workflow.json'));

			const statesField = doctype.fields.find((f) => f.fieldname === 'states');
			expect(statesField).toBeDefined();
			expect(statesField?.fieldtype).toBe('Table');
			expect(statesField?.options).toBe('Workflow State');

			const transitionsField = doctype.fields.find((f) => f.fieldname === 'transitions');
			expect(transitionsField).toBeDefined();
			expect(transitionsField?.fieldtype).toBe('Table');
			expect(transitionsField?.options).toBe('Workflow Transition');
		});
	});

	describe('Workflow State', () => {
		it('should load Workflow State definition', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'workflow_state/workflow_state.json'));

			expect(doctype.name).toBe('Workflow State');
			expect(doctype.module).toBe('Core');
			expect(doctype.naming_rule).toBe('autoincrement');
			expect(doctype.is_child).toBe(true);
		});

		it('should have child table fields', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'workflow_state/workflow_state.json'));
			const fieldnames = doctype.fields.map((f) => f.fieldname);

			expect(fieldnames).toContain('parent');
			expect(fieldnames).toContain('parenttype');
			expect(fieldnames).toContain('parentfield');
		});

		it('should have state definition fields', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'workflow_state/workflow_state.json'));
			const fieldnames = doctype.fields.map((f) => f.fieldname);

			expect(fieldnames).toContain('state');
			expect(fieldnames).toContain('doc_status');
			expect(fieldnames).toContain('style');
			expect(fieldnames).toContain('allow_edit');
		});

		it('should have doc_status as Select with valid options', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'workflow_state/workflow_state.json'));

			const docStatusField = doctype.fields.find((f) => f.fieldname === 'doc_status');
			expect(docStatusField).toBeDefined();
			expect(docStatusField?.fieldtype).toBe('Select');
			expect(Array.isArray(docStatusField?.options)).toBe(true);

			const options = docStatusField?.options as string[];
			expect(options).toContain('Draft');
			expect(options).toContain('Submitted');
			expect(options).toContain('Cancelled');
		});
	});

	describe('Workflow Transition', () => {
		it('should load Workflow Transition definition', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'workflow_transition/workflow_transition.json'));

			expect(doctype.name).toBe('Workflow Transition');
			expect(doctype.module).toBe('Core');
			expect(doctype.naming_rule).toBe('autoincrement');
			expect(doctype.is_child).toBe(true);
		});

		it('should have child table fields', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'workflow_transition/workflow_transition.json'));
			const fieldnames = doctype.fields.map((f) => f.fieldname);

			expect(fieldnames).toContain('parent');
			expect(fieldnames).toContain('parenttype');
			expect(fieldnames).toContain('parentfield');
		});

		it('should have transition definition fields', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'workflow_transition/workflow_transition.json'));
			const fieldnames = doctype.fields.map((f) => f.fieldname);

			expect(fieldnames).toContain('state');
			expect(fieldnames).toContain('action');
			expect(fieldnames).toContain('next_state');
			expect(fieldnames).toContain('allowed');
			expect(fieldnames).toContain('condition');
			expect(fieldnames).toContain('allow_self_approval');
		});
	});
});

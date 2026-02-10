/**
 * Tests for System DocTypes: File
 */

import { describe, it, expect } from 'vitest';
import { loadDocTypeFromFile } from '../../../src/core/doctype/loader.js';
import path from 'node:path';

const DOCTYPES_DIR = path.resolve(process.cwd(), 'doctypes/core');

describe('System DocTypes', () => {
	describe('File', () => {
		it('should load File definition', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'file/file.json'));

			expect(doctype.name).toBe('File');
			expect(doctype.module).toBe('Core');
			expect(doctype.naming_rule).toBe('hash');
			expect(doctype.is_child).toBe(false);
			expect(doctype.is_submittable).toBe(false);
		});

		it('should have file metadata fields', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'file/file.json'));
			const fieldnames = doctype.fields.map((f) => f.fieldname);

			expect(fieldnames).toContain('file_name');
			expect(fieldnames).toContain('file_url');
			expect(fieldnames).toContain('file_size');
			expect(fieldnames).toContain('file_type');
		});

		it('should have privacy and folder fields', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'file/file.json'));
			const fieldnames = doctype.fields.map((f) => f.fieldname);

			expect(fieldnames).toContain('is_private');
			expect(fieldnames).toContain('is_folder');
			expect(fieldnames).toContain('folder');
		});

		it('should have attachment tracking fields', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'file/file.json'));
			const fieldnames = doctype.fields.map((f) => f.fieldname);

			expect(fieldnames).toContain('attached_to_doctype');
			expect(fieldnames).toContain('attached_to_name');
			expect(fieldnames).toContain('attached_to_field');
		});

		it('should have thumbnail_url field', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'file/file.json'));
			const fieldnames = doctype.fields.map((f) => f.fieldname);

			expect(fieldnames).toContain('thumbnail_url');
		});

		it('should have folder as self-referencing Link', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'file/file.json'));

			const folderField = doctype.fields.find((f) => f.fieldname === 'folder');
			expect(folderField).toBeDefined();
			expect(folderField?.fieldtype).toBe('Link');
			expect(folderField?.options).toBe('File');
		});

		it('should have valid permissions', async () => {
			const doctype = await loadDocTypeFromFile(path.join(DOCTYPES_DIR, 'file/file.json'));

			expect(doctype.permissions.length).toBeGreaterThan(0);

			const sysMgrPerm = doctype.permissions.find((p) => p.role === 'System Manager');
			expect(sysMgrPerm).toBeDefined();
			expect(sysMgrPerm?.read).toBe(true);
			expect(sysMgrPerm?.write).toBe(true);
			expect(sysMgrPerm?.create).toBe(true);
			expect(sysMgrPerm?.delete).toBe(true);

			// Users can manage their own files
			const allPerm = doctype.permissions.find((p) => p.role === 'All');
			expect(allPerm).toBeDefined();
			expect(allPerm?.read).toBe(true);
			expect(allPerm?.write).toBe(true);
			expect(allPerm?.create).toBe(true);
			expect(allPerm?.if_owner).toBe(true);
		});
	});
});

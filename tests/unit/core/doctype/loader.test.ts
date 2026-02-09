import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDocTypeFromFile, loadDocTypesFromDirectory, resolveDocTypePath } from '../../../../src/core/doctype/loader.js';
import { ValidationError, NotFoundError } from '../../../../src/core/errors.js';
import { STANDARD_FIELDS, CHILD_TABLE_FIELDS } from '../../../../src/core/doctype/schema.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.resolve(__dirname, '../../../fixtures/doctypes');

function fixturePath(filename: string): string {
  return path.join(FIXTURES_DIR, filename);
}

// ---------------------------------------------------------------------------
// loadDocTypeFromFile
// ---------------------------------------------------------------------------

describe('loadDocTypeFromFile', () => {
  it('should load and parse a valid DocType JSON file', async () => {
    const doctype = await loadDocTypeFromFile(fixturePath('todo.json'));

    expect(doctype.name).toBe('Todo');
    expect(doctype.module).toBe('Core');
    expect(doctype.naming_rule).toBe('autoincrement');
    expect(doctype.is_submittable).toBe(false);
    expect(doctype.is_child).toBe(false);
  });

  it('should have parsed custom fields from todo.json', async () => {
    const doctype = await loadDocTypeFromFile(fixturePath('todo.json'));

    // Custom fields should be present
    const fieldnames = doctype.fields.map((f) => f.fieldname);
    expect(fieldnames).toContain('title');
    expect(fieldnames).toContain('status');
    expect(fieldnames).toContain('description');

    // Check specific field properties
    const titleField = doctype.fields.find((f) => f.fieldname === 'title');
    expect(titleField).toBeDefined();
    expect(titleField!.fieldtype).toBe('Data');
    expect(titleField!.reqd).toBe(true);
    expect(titleField!.max_length).toBe(255);

    const statusField = doctype.fields.find((f) => f.fieldname === 'status');
    expect(statusField).toBeDefined();
    expect(statusField!.fieldtype).toBe('Select');
    expect(statusField!.options).toEqual(['Open', 'Closed']);
    expect(statusField!.default).toBe('Open');
  });

  it('should inject standard fields into a regular DocType', async () => {
    const doctype = await loadDocTypeFromFile(fixturePath('todo.json'));
    const fieldnames = doctype.fields.map((f) => f.fieldname);

    // All standard fields should be present
    for (const sf of STANDARD_FIELDS) {
      expect(fieldnames).toContain(sf.fieldname);
    }
  });

  it('should inject child table fields for a child DocType', async () => {
    const doctype = await loadDocTypeFromFile(fixturePath('note_item.json'));
    const fieldnames = doctype.fields.map((f) => f.fieldname);

    expect(doctype.is_child).toBe(true);

    // Standard fields should be present
    for (const sf of STANDARD_FIELDS) {
      expect(fieldnames).toContain(sf.fieldname);
    }

    // Child table fields should be present
    for (const cf of CHILD_TABLE_FIELDS) {
      expect(fieldnames).toContain(cf.fieldname);
    }
  });

  it('should load a DocType with a Table field', async () => {
    const doctype = await loadDocTypeFromFile(fixturePath('note.json'));

    expect(doctype.name).toBe('Note');
    const tableField = doctype.fields.find((f) => f.fieldname === 'items');
    expect(tableField).toBeDefined();
    expect(tableField!.fieldtype).toBe('Table');
    expect(tableField!.options).toBe('Note Item');
  });

  it('should throw NotFoundError for a nonexistent file', async () => {
    await expect(
      loadDocTypeFromFile(fixturePath('nonexistent.json')),
    ).rejects.toThrow(NotFoundError);
  });

  it('should throw ValidationError for an invalid DocType (missing name)', async () => {
    await expect(
      loadDocTypeFromFile(fixturePath('invalid.json')),
    ).rejects.toThrow(ValidationError);
  });
});

// ---------------------------------------------------------------------------
// loadDocTypesFromDirectory
// ---------------------------------------------------------------------------

describe('loadDocTypesFromDirectory', () => {
  it('should load all valid DocTypes from a directory', async () => {
    const doctypes = await loadDocTypesFromDirectory(FIXTURES_DIR);

    // Should load todo.json, note.json, note_item.json (skip invalid.json)
    expect(doctypes.length).toBe(3);

    const names = doctypes.map((dt) => dt.name).sort();
    expect(names).toEqual(['Note', 'Note Item', 'Todo']);
  });

  it('should skip invalid files and log a warning instead of throwing', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const doctypes = await loadDocTypesFromDirectory(FIXTURES_DIR);

    // invalid.json should have triggered a warning
    expect(consoleSpy).toHaveBeenCalled();
    const warningMessages = consoleSpy.mock.calls.map((call) => String(call[0]));
    const hasInvalidWarning = warningMessages.some((msg) => msg.includes('invalid.json'));
    expect(hasInvalidWarning).toBe(true);

    consoleSpy.mockRestore();
  });

  it('should return an empty array for an empty directory', async () => {
    // Use a temp directory that exists but has no JSON files
    const emptyDir = path.resolve(__dirname, '../../../fixtures/doctypes/../../../helpers');
    const doctypes = await loadDocTypesFromDirectory(emptyDir);
    expect(doctypes).toEqual([]);
  });

  it('should return an empty array for a nonexistent directory', async () => {
    const doctypes = await loadDocTypesFromDirectory('/tmp/nodra_nonexistent_dir_xyz');
    expect(doctypes).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// resolveDocTypePath
// ---------------------------------------------------------------------------

describe('resolveDocTypePath', () => {
  it('should find a DocType JSON file by name in base paths', () => {
    const result = resolveDocTypePath([FIXTURES_DIR], 'Todo');
    expect(result).toBeDefined();
    expect(result).toContain('todo.json');
  });

  it('should convert PascalCase name to snake_case for file lookup', () => {
    const result = resolveDocTypePath([FIXTURES_DIR], 'Note Item');
    expect(result).toBeDefined();
    expect(result).toContain('note_item.json');
  });

  it('should return undefined when DocType is not found in any base path', () => {
    const result = resolveDocTypePath([FIXTURES_DIR], 'Sales Invoice');
    expect(result).toBeUndefined();
  });

  it('should search multiple base paths and return the first match', () => {
    const result = resolveDocTypePath(['/tmp/nodra_nonexistent_dir', FIXTURES_DIR], 'Todo');
    expect(result).toBeDefined();
    expect(result).toContain('todo.json');
  });

  it('should return undefined when base paths array is empty', () => {
    const result = resolveDocTypePath([], 'Todo');
    expect(result).toBeUndefined();
  });
});

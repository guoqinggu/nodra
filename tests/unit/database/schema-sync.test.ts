/**
 * Nodra Framework - Schema Sync Engine Tests
 *
 * Unit tests for the SchemaSync class that generates SQL DDL
 * from DocType definitions. No database needed — we only test SQL generation.
 */

import { describe, it, expect } from 'vitest';
import type { DocTypeDefinition, FieldDefinition } from '../../../src/core/doctype/schema.js';
import { SchemaSync } from '../../../src/database/schema-sync.js';
import type { ColumnInfo } from '../../../src/database/schema-sync.js';

// --- Test helpers ---

function createSimpleDocType(overrides?: Partial<DocTypeDefinition>): DocTypeDefinition {
  return {
    name: 'Todo',
    module: 'Core',
    naming_rule: 'autoincrement',
    is_submittable: false,
    is_child: false,
    is_single: false,
    is_tree: false,
    is_virtual: false,
    fields: [
      { fieldname: 'title', fieldtype: 'Data', label: 'Title', reqd: true },
      { fieldname: 'status', fieldtype: 'Select', label: 'Status', options: ['Open', 'Closed'] },
      { fieldname: 'description', fieldtype: 'Text', label: 'Description' },
    ],
    permissions: [],
    ...overrides,
  };
}

// --- Tests ---

describe('SchemaSync', () => {
  const sync = new SchemaSync();

  describe('generateCreateTable()', () => {
    it('generates CREATE TABLE with standard columns and field columns', () => {
      const doctype = createSimpleDocType();
      const sql = sync.generateCreateTable(doctype);

      // Uses tab_ prefix
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS tab_todo');

      // Standard columns
      expect(sql).toContain('name VARCHAR(255) PRIMARY KEY');
      expect(sql).toContain('owner VARCHAR(255) NOT NULL');
      expect(sql).toContain('creation TIMESTAMPTZ NOT NULL DEFAULT NOW()');
      expect(sql).toContain('modified TIMESTAMPTZ NOT NULL DEFAULT NOW()');
      expect(sql).toContain('modified_by VARCHAR(255) NOT NULL');
      expect(sql).toContain('docstatus SMALLINT NOT NULL DEFAULT 0');
      expect(sql).toContain('idx INTEGER NOT NULL DEFAULT 0');

      // Custom field columns
      expect(sql).toContain('title VARCHAR(255)');
      expect(sql).toContain('status VARCHAR(255)');
      expect(sql).toContain('description TEXT');
    });

    it('uses "tab_" prefix for table names', () => {
      const doctype = createSimpleDocType({ name: 'Sales Invoice' });
      const sql = sync.generateCreateTable(doctype);

      expect(sql).toContain('CREATE TABLE IF NOT EXISTS tab_sales_invoice');
    });

    it('maps field types to correct PostgreSQL types', () => {
      const doctype = createSimpleDocType({
        fields: [
          { fieldname: 'title', fieldtype: 'Data', label: 'Title' },
          { fieldname: 'count', fieldtype: 'Int', label: 'Count' },
          { fieldname: 'amount', fieldtype: 'Float', label: 'Amount' },
          { fieldname: 'price', fieldtype: 'Currency', label: 'Price' },
          { fieldname: 'due_date', fieldtype: 'Date', label: 'Due Date' },
          { fieldname: 'created_at', fieldtype: 'Datetime', label: 'Created At' },
          { fieldname: 'start_time', fieldtype: 'Time', label: 'Start Time' },
          { fieldname: 'notes', fieldtype: 'Text', label: 'Notes' },
          { fieldname: 'content', fieldtype: 'LongText', label: 'Content' },
          { fieldname: 'summary', fieldtype: 'SmallText', label: 'Summary' },
          { fieldname: 'is_active', fieldtype: 'Check', label: 'Is Active' },
          { fieldname: 'category', fieldtype: 'Select', label: 'Category' },
          { fieldname: 'user', fieldtype: 'Link', label: 'User', options: 'User' },
          { fieldname: 'ref_type', fieldtype: 'DynamicLink', label: 'Ref Type' },
          { fieldname: 'file_url', fieldtype: 'Attach', label: 'File' },
          { fieldname: 'image_url', fieldtype: 'AttachImage', label: 'Image' },
          { fieldname: 'color', fieldtype: 'Color', label: 'Color' },
          { fieldname: 'metadata', fieldtype: 'JSON', label: 'Metadata' },
          { fieldname: 'secret', fieldtype: 'Password', label: 'Secret' },
          { fieldname: 'body', fieldtype: 'HTML', label: 'Body' },
        ],
      });
      const sql = sync.generateCreateTable(doctype);

      expect(sql).toContain('title VARCHAR(255)');
      expect(sql).toContain('count INTEGER');
      expect(sql).toContain('amount DOUBLE PRECISION');
      expect(sql).toContain('price NUMERIC(18,6)');
      expect(sql).toContain('due_date DATE');
      expect(sql).toContain('created_at TIMESTAMPTZ');
      expect(sql).toContain('start_time TIME');
      expect(sql).toContain('notes TEXT');
      expect(sql).toContain('content TEXT');
      expect(sql).toContain('summary TEXT');
      expect(sql).toContain('is_active BOOLEAN');
      expect(sql).toContain('category VARCHAR(255)');
      expect(sql).toContain('"user" VARCHAR(255)');
      expect(sql).toContain('ref_type VARCHAR(255)');
      expect(sql).toContain('file_url TEXT');
      expect(sql).toContain('image_url TEXT');
      expect(sql).toContain('color VARCHAR(7)');
      expect(sql).toContain('metadata JSONB');
      expect(sql).toContain('secret TEXT');
      expect(sql).toContain('body TEXT');
    });

    it('uses custom VARCHAR(n) when Data field has max_length', () => {
      const doctype = createSimpleDocType({
        fields: [
          { fieldname: 'short_code', fieldtype: 'Data', label: 'Short Code', max_length: 10 },
          { fieldname: 'title', fieldtype: 'Data', label: 'Title' },
        ],
      });
      const sql = sync.generateCreateTable(doctype);

      expect(sql).toContain('short_code VARCHAR(10)');
      expect(sql).toContain('title VARCHAR(255)');
    });

    it('skips virtual field types (Table, ReadOnly) that have no column', () => {
      const doctype = createSimpleDocType({
        fields: [
          { fieldname: 'title', fieldtype: 'Data', label: 'Title' },
          { fieldname: 'items', fieldtype: 'Table', label: 'Items', options: 'Todo Item' },
          { fieldname: 'computed', fieldtype: 'ReadOnly', label: 'Computed' },
        ],
      });
      const sql = sync.generateCreateTable(doctype);

      expect(sql).toContain('title VARCHAR(255)');
      expect(sql).not.toContain('items');
      expect(sql).not.toContain('computed');
    });

    it('adds parent/parenttype/parentfield columns for child DocTypes', () => {
      const doctype = createSimpleDocType({
        name: 'Todo Item',
        is_child: true,
        fields: [
          { fieldname: 'item_name', fieldtype: 'Data', label: 'Item Name' },
          { fieldname: 'qty', fieldtype: 'Int', label: 'Quantity' },
        ],
      });
      const sql = sync.generateCreateTable(doctype);

      expect(sql).toContain('CREATE TABLE IF NOT EXISTS tab_todo_item');
      expect(sql).toContain('parent VARCHAR(255)');
      expect(sql).toContain('parenttype VARCHAR(255)');
      expect(sql).toContain('parentfield VARCHAR(255)');
      expect(sql).toContain('item_name VARCHAR(255)');
      expect(sql).toContain('qty INTEGER');
    });

    it('does NOT add parent columns for non-child DocTypes', () => {
      const doctype = createSimpleDocType();
      const sql = sync.generateCreateTable(doctype);

      expect(sql).not.toContain('parenttype');
      expect(sql).not.toContain('parentfield');
      // 'parent' could match other words, so be more specific
      expect(sql).not.toMatch(/\bparent\b\s+VARCHAR/);
    });

    it('adds NOT NULL for reqd fields', () => {
      const doctype = createSimpleDocType({
        fields: [
          { fieldname: 'title', fieldtype: 'Data', label: 'Title', reqd: true },
          { fieldname: 'optional_field', fieldtype: 'Data', label: 'Optional' },
        ],
      });
      const sql = sync.generateCreateTable(doctype);

      expect(sql).toMatch(/title\s+VARCHAR\(255\)\s+NOT NULL/);
      expect(sql).not.toMatch(/optional_field\s+VARCHAR\(255\)\s+NOT NULL/);
    });

    it('adds UNIQUE constraint for unique fields', () => {
      const doctype = createSimpleDocType({
        fields: [
          { fieldname: 'email', fieldtype: 'Data', label: 'Email', unique: true },
        ],
      });
      const sql = sync.generateCreateTable(doctype);

      expect(sql).toMatch(/email\s+VARCHAR\(255\).*UNIQUE/);
    });

    it('adds DEFAULT for fields with default values', () => {
      const doctype = createSimpleDocType({
        fields: [
          { fieldname: 'status', fieldtype: 'Select', label: 'Status', default: 'Open' },
          { fieldname: 'is_active', fieldtype: 'Check', label: 'Active', default: true },
          { fieldname: 'count', fieldtype: 'Int', label: 'Count', default: 0 },
        ],
      });
      const sql = sync.generateCreateTable(doctype);

      expect(sql).toContain("DEFAULT 'Open'");
      expect(sql).toContain('DEFAULT true');
      expect(sql).toContain('DEFAULT 0');
    });
  });

  describe('generateIndexes()', () => {
    it('creates index on modified column', () => {
      const doctype = createSimpleDocType();
      const indexes = sync.generateIndexes(doctype);

      expect(indexes.some((sql) => sql.includes('modified') && sql.includes('CREATE INDEX'))).toBe(true);
    });

    it('creates index on owner column', () => {
      const doctype = createSimpleDocType();
      const indexes = sync.generateIndexes(doctype);

      expect(indexes.some((sql) => sql.includes('owner') && sql.includes('CREATE INDEX'))).toBe(true);
    });

    it('creates index on Link fields', () => {
      const doctype = createSimpleDocType({
        fields: [
          { fieldname: 'title', fieldtype: 'Data', label: 'Title' },
          { fieldname: 'assigned_to', fieldtype: 'Link', label: 'Assigned To', options: 'User' },
          { fieldname: 'project', fieldtype: 'Link', label: 'Project', options: 'Project' },
        ],
      });
      const indexes = sync.generateIndexes(doctype);

      expect(indexes.some((sql) => sql.includes('assigned_to'))).toBe(true);
      expect(indexes.some((sql) => sql.includes('project'))).toBe(true);
    });

    it('creates index on fields with search_index=true', () => {
      const doctype = createSimpleDocType({
        fields: [
          { fieldname: 'title', fieldtype: 'Data', label: 'Title', search_index: true },
          { fieldname: 'status', fieldtype: 'Select', label: 'Status' },
        ],
      });
      const indexes = sync.generateIndexes(doctype);

      expect(indexes.some((sql) => sql.includes('title'))).toBe(true);
    });

    it('uses IF NOT EXISTS in index creation', () => {
      const doctype = createSimpleDocType();
      const indexes = sync.generateIndexes(doctype);

      for (const sql of indexes) {
        expect(sql).toContain('IF NOT EXISTS');
      }
    });

    it('uses tab_ prefix in index table reference', () => {
      const doctype = createSimpleDocType();
      const indexes = sync.generateIndexes(doctype);

      for (const sql of indexes) {
        expect(sql).toContain('tab_todo');
      }
    });

    it('creates indexes on parent/parenttype for child DocTypes', () => {
      const doctype = createSimpleDocType({
        name: 'Todo Item',
        is_child: true,
        fields: [
          { fieldname: 'item_name', fieldtype: 'Data', label: 'Item Name' },
        ],
      });
      const indexes = sync.generateIndexes(doctype);

      expect(indexes.some((sql) => sql.includes('parent'))).toBe(true);
      expect(indexes.some((sql) => sql.includes('parenttype'))).toBe(true);
    });
  });

  describe('generateAlterTable()', () => {
    it('returns empty array when columns match (no changes needed)', () => {
      const doctype = createSimpleDocType({
        fields: [
          { fieldname: 'title', fieldtype: 'Data', label: 'Title' },
        ],
      });

      const existingColumns: ColumnInfo[] = [
        // Standard columns
        { column_name: 'name', data_type: 'character varying', is_nullable: 'NO', column_default: null },
        { column_name: 'owner', data_type: 'character varying', is_nullable: 'NO', column_default: null },
        { column_name: 'creation', data_type: 'timestamp with time zone', is_nullable: 'NO', column_default: 'now()' },
        { column_name: 'modified', data_type: 'timestamp with time zone', is_nullable: 'NO', column_default: 'now()' },
        { column_name: 'modified_by', data_type: 'character varying', is_nullable: 'NO', column_default: null },
        { column_name: 'docstatus', data_type: 'smallint', is_nullable: 'NO', column_default: '0' },
        { column_name: 'idx', data_type: 'integer', is_nullable: 'NO', column_default: '0' },
        // Custom field
        { column_name: 'title', data_type: 'character varying', is_nullable: 'YES', column_default: null },
      ];

      const alterStatements = sync.generateAlterTable(doctype, existingColumns);

      expect(alterStatements).toEqual([]);
    });

    it('generates ADD COLUMN for new fields', () => {
      const doctype = createSimpleDocType({
        fields: [
          { fieldname: 'title', fieldtype: 'Data', label: 'Title' },
          { fieldname: 'priority', fieldtype: 'Select', label: 'Priority' },
          { fieldname: 'due_date', fieldtype: 'Date', label: 'Due Date' },
        ],
      });

      const existingColumns: ColumnInfo[] = [
        { column_name: 'name', data_type: 'character varying', is_nullable: 'NO', column_default: null },
        { column_name: 'owner', data_type: 'character varying', is_nullable: 'NO', column_default: null },
        { column_name: 'creation', data_type: 'timestamp with time zone', is_nullable: 'NO', column_default: 'now()' },
        { column_name: 'modified', data_type: 'timestamp with time zone', is_nullable: 'NO', column_default: 'now()' },
        { column_name: 'modified_by', data_type: 'character varying', is_nullable: 'NO', column_default: null },
        { column_name: 'docstatus', data_type: 'smallint', is_nullable: 'NO', column_default: '0' },
        { column_name: 'idx', data_type: 'integer', is_nullable: 'NO', column_default: '0' },
        { column_name: 'title', data_type: 'character varying', is_nullable: 'YES', column_default: null },
      ];

      const alterStatements = sync.generateAlterTable(doctype, existingColumns);

      expect(alterStatements.length).toBe(2);
      expect(alterStatements.some((sql) => sql.includes('ADD COLUMN') && sql.includes('priority') && sql.includes('VARCHAR(255)'))).toBe(true);
      expect(alterStatements.some((sql) => sql.includes('ADD COLUMN') && sql.includes('due_date') && sql.includes('DATE'))).toBe(true);
    });

    it('uses ALTER TABLE with tab_ prefix', () => {
      const doctype = createSimpleDocType({
        fields: [
          { fieldname: 'title', fieldtype: 'Data', label: 'Title' },
          { fieldname: 'new_field', fieldtype: 'Int', label: 'New Field' },
        ],
      });

      const existingColumns: ColumnInfo[] = [
        { column_name: 'name', data_type: 'character varying', is_nullable: 'NO', column_default: null },
        { column_name: 'owner', data_type: 'character varying', is_nullable: 'NO', column_default: null },
        { column_name: 'creation', data_type: 'timestamp with time zone', is_nullable: 'NO', column_default: 'now()' },
        { column_name: 'modified', data_type: 'timestamp with time zone', is_nullable: 'NO', column_default: 'now()' },
        { column_name: 'modified_by', data_type: 'character varying', is_nullable: 'NO', column_default: null },
        { column_name: 'docstatus', data_type: 'smallint', is_nullable: 'NO', column_default: '0' },
        { column_name: 'idx', data_type: 'integer', is_nullable: 'NO', column_default: '0' },
        { column_name: 'title', data_type: 'character varying', is_nullable: 'YES', column_default: null },
      ];

      const alterStatements = sync.generateAlterTable(doctype, existingColumns);

      expect(alterStatements.length).toBe(1);
      expect(alterStatements[0]).toContain('ALTER TABLE tab_todo');
    });

    it('does NOT generate DROP COLUMN (safety)', () => {
      const doctype = createSimpleDocType({
        fields: [
          { fieldname: 'title', fieldtype: 'Data', label: 'Title' },
          // 'status' and 'description' removed from DocType definition
        ],
      });

      const existingColumns: ColumnInfo[] = [
        { column_name: 'name', data_type: 'character varying', is_nullable: 'NO', column_default: null },
        { column_name: 'owner', data_type: 'character varying', is_nullable: 'NO', column_default: null },
        { column_name: 'creation', data_type: 'timestamp with time zone', is_nullable: 'NO', column_default: 'now()' },
        { column_name: 'modified', data_type: 'timestamp with time zone', is_nullable: 'NO', column_default: 'now()' },
        { column_name: 'modified_by', data_type: 'character varying', is_nullable: 'NO', column_default: null },
        { column_name: 'docstatus', data_type: 'smallint', is_nullable: 'NO', column_default: '0' },
        { column_name: 'idx', data_type: 'integer', is_nullable: 'NO', column_default: '0' },
        { column_name: 'title', data_type: 'character varying', is_nullable: 'YES', column_default: null },
        { column_name: 'status', data_type: 'character varying', is_nullable: 'YES', column_default: null },
        { column_name: 'description', data_type: 'text', is_nullable: 'YES', column_default: null },
      ];

      const alterStatements = sync.generateAlterTable(doctype, existingColumns);

      // No statements should be generated — no DROP COLUMN
      expect(alterStatements).toEqual([]);
      for (const sql of alterStatements) {
        expect(sql).not.toContain('DROP COLUMN');
      }
    });

    it('skips virtual fields (Table, ReadOnly) in ALTER TABLE', () => {
      const doctype = createSimpleDocType({
        fields: [
          { fieldname: 'title', fieldtype: 'Data', label: 'Title' },
          { fieldname: 'items', fieldtype: 'Table', label: 'Items', options: 'Todo Item' },
          { fieldname: 'computed', fieldtype: 'ReadOnly', label: 'Computed' },
        ],
      });

      const existingColumns: ColumnInfo[] = [
        { column_name: 'name', data_type: 'character varying', is_nullable: 'NO', column_default: null },
        { column_name: 'owner', data_type: 'character varying', is_nullable: 'NO', column_default: null },
        { column_name: 'creation', data_type: 'timestamp with time zone', is_nullable: 'NO', column_default: 'now()' },
        { column_name: 'modified', data_type: 'timestamp with time zone', is_nullable: 'NO', column_default: 'now()' },
        { column_name: 'modified_by', data_type: 'character varying', is_nullable: 'NO', column_default: null },
        { column_name: 'docstatus', data_type: 'smallint', is_nullable: 'NO', column_default: '0' },
        { column_name: 'idx', data_type: 'integer', is_nullable: 'NO', column_default: '0' },
        { column_name: 'title', data_type: 'character varying', is_nullable: 'YES', column_default: null },
      ];

      const alterStatements = sync.generateAlterTable(doctype, existingColumns);

      // No ALTER statements — items and computed are virtual
      expect(alterStatements).toEqual([]);
    });
  });
});

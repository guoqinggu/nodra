import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Document } from '../../../../src/core/document/document.js';
import type { DocTypeDefinition } from '../../../../src/core/doctype/schema.js';

// ---------------------------------------------------------------------------
// Test helpers & fixtures
// ---------------------------------------------------------------------------

function makeMeta(overrides: Partial<DocTypeDefinition> = {}): DocTypeDefinition {
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
      { fieldname: 'title', fieldtype: 'Data', label: 'Title', reqd: true, max_length: 255 },
      { fieldname: 'status', fieldtype: 'Select', label: 'Status', options: ['Open', 'Closed'], default: 'Open' },
      { fieldname: 'description', fieldtype: 'Text', label: 'Description' },
      { fieldname: 'priority', fieldtype: 'Int', label: 'Priority' },
      { fieldname: 'is_active', fieldtype: 'Check', label: 'Is Active' },
      { fieldname: 'due_date', fieldtype: 'Date', label: 'Due Date' },
      { fieldname: 'amount', fieldtype: 'Float', label: 'Amount' },
    ],
    permissions: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Document', () => {
  let meta: DocTypeDefinition;

  beforeEach(() => {
    meta = makeMeta();
  });

  // --- Constructor ---

  describe('constructor', () => {
    it('should initialize with doctype name from meta', () => {
      const doc = new Document(meta);
      expect(doc.doctype).toBe('Todo');
    });

    it('should initialize standard fields with defaults', () => {
      const doc = new Document(meta);
      expect(doc.name).toBe('');
      expect(doc.owner).toBe('');
      expect(doc.creation).toBeNull();
      expect(doc.modified).toBeNull();
      expect(doc.modified_by).toBe('');
      expect(doc.docstatus).toBe(0);
      expect(doc.idx).toBe(0);
    });

    it('should be marked as new by default', () => {
      const doc = new Document(meta);
      expect(doc.isNew()).toBe(true);
    });

    it('should populate fields from initial data', () => {
      const doc = new Document(meta, {
        name: 'TODO-001',
        title: 'My Task',
        status: 'Open',
        priority: 5,
        is_active: true,
      });

      expect(doc.name).toBe('TODO-001');
      expect(doc.get('title')).toBe('My Task');
      expect(doc.get('status')).toBe('Open');
      expect(doc.get('priority')).toBe(5);
      expect(doc.get('is_active')).toBe(true);
    });

    it('should populate standard fields from initial data', () => {
      const now = new Date();
      const doc = new Document(meta, {
        name: 'TODO-001',
        owner: 'admin@example.com',
        creation: now,
        modified: now,
        modified_by: 'admin@example.com',
        docstatus: 1,
        idx: 3,
      });

      expect(doc.name).toBe('TODO-001');
      expect(doc.owner).toBe('admin@example.com');
      expect(doc.creation).toBe(now);
      expect(doc.modified).toBe(now);
      expect(doc.modified_by).toBe('admin@example.com');
      expect(doc.docstatus).toBe(1);
      expect(doc.idx).toBe(3);
    });

    it('should not track changes for initial data', () => {
      const doc = new Document(meta, {
        title: 'My Task',
        status: 'Open',
      });

      expect(doc.hasChanged('title')).toBe(false);
      expect(doc.hasChanged('status')).toBe(false);
      expect(doc.getChangedFields()).toEqual([]);
    });
  });

  // --- get / set ---

  describe('get() and set()', () => {
    it('should get and set string field values', () => {
      const doc = new Document(meta);
      doc.set('title', 'Test Task');
      expect(doc.get('title')).toBe('Test Task');
    });

    it('should get and set number field values', () => {
      const doc = new Document(meta);
      doc.set('priority', 42);
      expect(doc.get('priority')).toBe(42);
    });

    it('should get and set boolean field values', () => {
      const doc = new Document(meta);
      doc.set('is_active', true);
      expect(doc.get('is_active')).toBe(true);
    });

    it('should get and set date field values', () => {
      const doc = new Document(meta);
      const date = new Date('2025-12-31');
      doc.set('due_date', date);
      expect(doc.get('due_date')).toBe(date);
    });

    it('should get and set float field values', () => {
      const doc = new Document(meta);
      doc.set('amount', 99.95);
      expect(doc.get('amount')).toBe(99.95);
    });

    it('should return undefined for fields that have not been set', () => {
      const doc = new Document(meta);
      expect(doc.get('title')).toBeUndefined();
    });

    it('should allow setting null values', () => {
      const doc = new Document(meta, { title: 'Test' });
      doc.set('title', null);
      expect(doc.get('title')).toBeNull();
    });

    it('should allow setting standard fields via set()', () => {
      const doc = new Document(meta);
      doc.set('owner', 'user@example.com');
      expect(doc.owner).toBe('user@example.com');
    });
  });

  // --- Change tracking ---

  describe('change tracking', () => {
    it('should track that a field has changed after set()', () => {
      const doc = new Document(meta, { title: 'Original' });
      doc.set('title', 'Updated');
      expect(doc.hasChanged('title')).toBe(true);
    });

    it('should not report unchanged fields as changed', () => {
      const doc = new Document(meta, { title: 'Original', status: 'Open' });
      doc.set('title', 'Updated');
      expect(doc.hasChanged('status')).toBe(false);
    });

    it('should track changes on fields set from undefined', () => {
      const doc = new Document(meta);
      doc.set('title', 'New');
      expect(doc.hasChanged('title')).toBe(true);
    });

    it('should not mark as changed when set to the same value', () => {
      const doc = new Document(meta, { title: 'Same' });
      doc.set('title', 'Same');
      expect(doc.hasChanged('title')).toBe(false);
    });
  });

  // --- getPrevious ---

  describe('getPrevious()', () => {
    it('should return the original value before set()', () => {
      const doc = new Document(meta, { title: 'Original' });
      doc.set('title', 'Updated');
      expect(doc.getPrevious('title')).toBe('Original');
    });

    it('should return undefined for fields that had no original value', () => {
      const doc = new Document(meta);
      doc.set('title', 'New');
      expect(doc.getPrevious('title')).toBeUndefined();
    });

    it('should track the first previous value across multiple sets', () => {
      const doc = new Document(meta, { title: 'First' });
      doc.set('title', 'Second');
      doc.set('title', 'Third');
      expect(doc.getPrevious('title')).toBe('First');
    });
  });

  // --- getChangedFields ---

  describe('getChangedFields()', () => {
    it('should return an empty array when no fields have changed', () => {
      const doc = new Document(meta, { title: 'Test' });
      expect(doc.getChangedFields()).toEqual([]);
    });

    it('should list only changed fields', () => {
      const doc = new Document(meta, { title: 'Test', status: 'Open', priority: 1 });
      doc.set('title', 'Updated');
      doc.set('priority', 2);

      const changed = doc.getChangedFields();
      expect(changed).toHaveLength(2);
      expect(changed).toContain('title');
      expect(changed).toContain('priority');
      expect(changed).not.toContain('status');
    });

    it('should include standard fields if changed via set()', () => {
      const doc = new Document(meta, { owner: 'admin' });
      doc.set('owner', 'user');
      expect(doc.getChangedFields()).toContain('owner');
    });
  });

  // --- markAsClean ---

  describe('markAsClean()', () => {
    it('should reset change tracking', () => {
      const doc = new Document(meta, { title: 'Original' });
      doc.set('title', 'Updated');
      expect(doc.hasChanged('title')).toBe(true);

      doc.markAsClean();
      expect(doc.hasChanged('title')).toBe(false);
      expect(doc.getChangedFields()).toEqual([]);
    });

    it('should update previous values to current values after clean', () => {
      const doc = new Document(meta, { title: 'Original' });
      doc.set('title', 'Updated');
      doc.markAsClean();

      doc.set('title', 'Third');
      expect(doc.getPrevious('title')).toBe('Updated');
    });
  });

  // --- isNew ---

  describe('isNew()', () => {
    it('should return true for a newly created document', () => {
      const doc = new Document(meta);
      expect(doc.isNew()).toBe(true);
    });

    it('should return true when constructed with data but no _isNew override', () => {
      const doc = new Document(meta, { title: 'Test' });
      expect(doc.isNew()).toBe(true);
    });

    it('should return false when _isNew is explicitly set to false in data', () => {
      const doc = new Document(meta, { title: 'Test', _isNew: false });
      expect(doc.isNew()).toBe(false);
    });
  });

  // --- getData ---

  describe('getData()', () => {
    it('should return all field values as a plain object', () => {
      const doc = new Document(meta, {
        name: 'TODO-001',
        title: 'My Task',
        status: 'Open',
        priority: 3,
      });

      const data = doc.getData();
      expect(data).toBeTypeOf('object');
      expect(data['name']).toBe('TODO-001');
      expect(data['title']).toBe('My Task');
      expect(data['status']).toBe('Open');
      expect(data['priority']).toBe(3);
      expect(data['doctype']).toBe('Todo');
    });

    it('should include standard fields in getData()', () => {
      const now = new Date();
      const doc = new Document(meta, {
        name: 'TODO-001',
        owner: 'admin@example.com',
        creation: now,
        modified: now,
        modified_by: 'admin@example.com',
        docstatus: 0,
        idx: 0,
      });

      const data = doc.getData();
      expect(data['owner']).toBe('admin@example.com');
      expect(data['creation']).toBe(now);
      expect(data['modified']).toBe(now);
      expect(data['modified_by']).toBe('admin@example.com');
      expect(data['docstatus']).toBe(0);
    });

    it('should reflect changes after set()', () => {
      const doc = new Document(meta, { title: 'Original' });
      doc.set('title', 'Updated');
      expect(doc.getData()['title']).toBe('Updated');
    });

    it('should return a new object each time (not a reference)', () => {
      const doc = new Document(meta, { title: 'Test' });
      const data1 = doc.getData();
      const data2 = doc.getData();
      expect(data1).not.toBe(data2);
      expect(data1).toEqual(data2);
    });
  });

  // --- Lifecycle hooks ---

  describe('lifecycle hooks', () => {
    it('should have no-op default lifecycle hooks', async () => {
      const doc = new Document(meta);

      // These should all resolve without error
      await expect(doc.beforeValidate()).resolves.toBeUndefined();
      await expect(doc.validate()).resolves.toBeUndefined();
      await expect(doc.beforeSave()).resolves.toBeUndefined();
      await expect(doc.afterSave()).resolves.toBeUndefined();
      await expect(doc.beforeInsert()).resolves.toBeUndefined();
      await expect(doc.afterInsert()).resolves.toBeUndefined();
      await expect(doc.beforeDelete()).resolves.toBeUndefined();
      await expect(doc.afterDelete()).resolves.toBeUndefined();
      await expect(doc.onChange()).resolves.toBeUndefined();
    });

    it('should allow subclasses to override lifecycle hooks', async () => {
      const validateFn = vi.fn();
      const beforeSaveFn = vi.fn();

      class CustomDoc extends Document {
        override async validate(): Promise<void> {
          validateFn();
        }
        override async beforeSave(): Promise<void> {
          beforeSaveFn();
        }
      }

      const doc = new CustomDoc(meta);
      await doc.validate();
      await doc.beforeSave();

      expect(validateFn).toHaveBeenCalledOnce();
      expect(beforeSaveFn).toHaveBeenCalledOnce();
    });
  });
});

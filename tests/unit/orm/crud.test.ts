import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { ORM } from '../../../src/orm/crud.js';
import { Document } from '../../../src/core/document/document.js';
import type { DocTypeDefinition } from '../../../src/core/doctype/schema.js';
import type { DocTypeRegistry } from '../../../src/core/doctype/registry.js';
import type { Database } from '../../../src/database/connection.js';
import { NotFoundError, ValidationError } from '../../../src/core/errors.js';

// ---------------------------------------------------------------------------
// Test helpers & fixtures
// ---------------------------------------------------------------------------

function makeMeta(overrides: Partial<DocTypeDefinition> = {}): DocTypeDefinition {
  return {
    name: 'Todo',
    module: 'Core',
    naming_rule: 'hash',
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
    ],
    permissions: [],
    ...overrides,
  };
}

function createMockDb(): Database {
  return {
    query: vi.fn().mockResolvedValue([]),
    queryOne: vi.fn().mockResolvedValue(null),
    execute: vi.fn().mockResolvedValue(1),
    connect: vi.fn(),
    disconnect: vi.fn(),
    healthCheck: vi.fn().mockResolvedValue(true),
    isConnected: vi.fn().mockReturnValue(true),
    getPool: vi.fn().mockReturnValue(null),
  } as unknown as Database;
}

function createMockRegistry(meta: DocTypeDefinition): DocTypeRegistry {
  return {
    get: vi.fn().mockReturnValue(meta),
    has: vi.fn().mockReturnValue(true),
    register: vi.fn(),
    list: vi.fn().mockReturnValue([meta]),
    listByModule: vi.fn().mockReturnValue([meta]),
    getLinkedDocTypes: vi.fn().mockReturnValue([]),
    clear: vi.fn(),
  } as unknown as DocTypeRegistry;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ORM', () => {
  let db: Database;
  let meta: DocTypeDefinition;
  let registry: DocTypeRegistry;
  let orm: ORM;

  beforeEach(() => {
    meta = makeMeta();
    db = createMockDb();
    registry = createMockRegistry(meta);
    orm = new ORM(db, registry);
  });

  // --- insert ---

  describe('insert()', () => {
    it('should call the database with an INSERT query and return the document', async () => {
      const doc = new Document(meta, { title: 'My Task', status: 'Open' });

      // Mock DB to return the inserted row
      (db.query as Mock).mockResolvedValueOnce([{
        name: 'abc123',
        title: 'My Task',
        status: 'Open',
        owner: 'Administrator',
        creation: new Date('2025-01-01'),
        modified: new Date('2025-01-01'),
        modified_by: 'Administrator',
        docstatus: 0,
        idx: 0,
      }]);

      const result = await orm.insert(doc);

      expect(result).toBeInstanceOf(Document);
      expect(result.name).toBeTruthy();
      expect(db.query).toHaveBeenCalled();

      // The SQL should be an INSERT
      const callArgs = (db.query as Mock).mock.calls[0];
      expect(callArgs[0]).toContain('INSERT INTO');
      expect(callArgs[0]).toContain('tab_todo');
    });

    it('should auto-populate standard fields: owner, creation, modified, modified_by, docstatus', async () => {
      const doc = new Document(meta, { title: 'Task' });

      (db.query as Mock).mockResolvedValueOnce([{
        name: 'hash123',
        title: 'Task',
        status: undefined,
        owner: 'Administrator',
        creation: new Date(),
        modified: new Date(),
        modified_by: 'Administrator',
        docstatus: 0,
        idx: 0,
      }]);

      const result = await orm.insert(doc);

      // Standard fields should be populated
      expect(result.owner).toBeTruthy();
      expect(result.creation).toBeInstanceOf(Date);
      expect(result.modified).toBeInstanceOf(Date);
      expect(result.modified_by).toBeTruthy();
      expect(result.docstatus).toBe(0);
    });

    it('should run lifecycle hooks in correct order: beforeValidate→validate→beforeInsert→beforeSave→DB→afterSave→afterInsert', async () => {
      const callOrder: string[] = [];

      class TrackedDoc extends Document {
        override async beforeValidate() { callOrder.push('beforeValidate'); }
        override async validate() { callOrder.push('validate'); }
        override async beforeInsert() { callOrder.push('beforeInsert'); }
        override async beforeSave() { callOrder.push('beforeSave'); }
        override async afterSave() { callOrder.push('afterSave'); }
        override async afterInsert() { callOrder.push('afterInsert'); }
      }

      const doc = new TrackedDoc(meta, { title: 'Task' });

      (db.query as Mock).mockResolvedValueOnce([{
        name: 'abc123',
        title: 'Task',
        owner: 'Administrator',
        creation: new Date(),
        modified: new Date(),
        modified_by: 'Administrator',
        docstatus: 0,
        idx: 0,
      }]);

      await orm.insert(doc);

      expect(callOrder).toEqual([
        'beforeValidate',
        'validate',
        'beforeInsert',
        'beforeSave',
        'afterSave',
        'afterInsert',
      ]);
    });

    it('should mark document as not new after insert', async () => {
      const doc = new Document(meta, { title: 'Task' });
      expect(doc.isNew()).toBe(true);

      (db.query as Mock).mockResolvedValueOnce([{
        name: 'abc123',
        title: 'Task',
        owner: 'Administrator',
        creation: new Date(),
        modified: new Date(),
        modified_by: 'Administrator',
        docstatus: 0,
        idx: 0,
      }]);

      const result = await orm.insert(doc);
      expect(result.isNew()).toBe(false);
    });
  });

  // --- getDoc ---

  describe('getDoc()', () => {
    it('should return a Document instance when found', async () => {
      (db.queryOne as Mock).mockResolvedValueOnce({
        name: 'TODO-001',
        title: 'My Task',
        status: 'Open',
        owner: 'admin@example.com',
        creation: new Date('2025-01-01'),
        modified: new Date('2025-01-01'),
        modified_by: 'admin@example.com',
        docstatus: 0,
        idx: 0,
      });

      const doc = await orm.getDoc('Todo', 'TODO-001');

      expect(doc).toBeInstanceOf(Document);
      expect(doc.doctype).toBe('Todo');
      expect(doc.name).toBe('TODO-001');
      expect(doc.get('title')).toBe('My Task');
      expect(doc.get('status')).toBe('Open');
      expect(doc.isNew()).toBe(false);
    });

    it('should throw NotFoundError when document is not found', async () => {
      (db.queryOne as Mock).mockResolvedValueOnce(null);

      await expect(orm.getDoc('Todo', 'NONEXISTENT')).rejects.toThrow(NotFoundError);
    });

    it('should query the correct table with correct name', async () => {
      (db.queryOne as Mock).mockResolvedValueOnce({
        name: 'TODO-001',
        title: 'Task',
        owner: 'admin',
        creation: new Date(),
        modified: new Date(),
        modified_by: 'admin',
        docstatus: 0,
        idx: 0,
      });

      await orm.getDoc('Todo', 'TODO-001');

      const callArgs = (db.queryOne as Mock).mock.calls[0];
      expect(callArgs[0]).toContain('tab_todo');
      expect(callArgs[1]).toContain('TODO-001');
    });
  });

  // --- getList ---

  describe('getList()', () => {
    it('should return an array of Document instances', async () => {
      (db.query as Mock).mockResolvedValueOnce([
        {
          name: 'TODO-001', title: 'Task 1', status: 'Open',
          owner: 'admin', creation: new Date(), modified: new Date(),
          modified_by: 'admin', docstatus: 0, idx: 0,
        },
        {
          name: 'TODO-002', title: 'Task 2', status: 'Closed',
          owner: 'admin', creation: new Date(), modified: new Date(),
          modified_by: 'admin', docstatus: 0, idx: 0,
        },
      ]);

      const docs = await orm.getList('Todo');

      expect(docs).toHaveLength(2);
      expect(docs[0]).toBeInstanceOf(Document);
      expect(docs[1]).toBeInstanceOf(Document);
      expect(docs[0]!.name).toBe('TODO-001');
      expect(docs[1]!.name).toBe('TODO-002');
    });

    it('should pass filters to the query', async () => {
      (db.query as Mock).mockResolvedValueOnce([]);

      await orm.getList('Todo', { filters: { status: 'Open' } });

      const callArgs = (db.query as Mock).mock.calls[0];
      expect(callArgs[0]).toContain('status');
      expect(callArgs[1]).toContain('Open');
    });

    it('should pass limit and offset to the query', async () => {
      (db.query as Mock).mockResolvedValueOnce([]);

      await orm.getList('Todo', { limit: 10, offset: 20 });

      const callArgs = (db.query as Mock).mock.calls[0];
      expect(callArgs[0]).toContain('LIMIT');
      expect(callArgs[0]).toContain('OFFSET');
    });

    it('should pass orderBy to the query', async () => {
      (db.query as Mock).mockResolvedValueOnce([]);

      await orm.getList('Todo', { orderBy: 'creation desc' });

      const callArgs = (db.query as Mock).mock.calls[0];
      expect(callArgs[0]).toContain('ORDER BY');
      expect(callArgs[0]).toContain('creation');
    });

    it('should pass fields to the query', async () => {
      (db.query as Mock).mockResolvedValueOnce([]);

      await orm.getList('Todo', { fields: ['name', 'title'] });

      const callArgs = (db.query as Mock).mock.calls[0];
      expect(callArgs[0]).toContain('name');
      expect(callArgs[0]).toContain('title');
    });

    it('should return an empty array when no documents match', async () => {
      (db.query as Mock).mockResolvedValueOnce([]);

      const docs = await orm.getList('Todo', { filters: { status: 'Unknown' } });
      expect(docs).toEqual([]);
    });

    it('should mark returned documents as not new', async () => {
      (db.query as Mock).mockResolvedValueOnce([
        {
          name: 'TODO-001', title: 'Task 1',
          owner: 'admin', creation: new Date(), modified: new Date(),
          modified_by: 'admin', docstatus: 0, idx: 0,
        },
      ]);

      const docs = await orm.getList('Todo');
      expect(docs[0]!.isNew()).toBe(false);
    });
  });

  // --- update ---

  describe('update()', () => {
    it('should call UPDATE on the database with changed fields', async () => {
      // First, create a "loaded" document (not new)
      const doc = new Document(meta, {
        title: 'Task',
        status: 'Open',
        _isNew: false,
      });
      doc.name = 'TODO-001';
      doc.markAsClean();

      // Change a field
      doc.set('title', 'Updated Task');

      (db.query as Mock).mockResolvedValueOnce([{
        name: 'TODO-001',
        title: 'Updated Task',
        status: 'Open',
        owner: 'admin',
        creation: new Date(),
        modified: new Date(),
        modified_by: 'admin',
        docstatus: 0,
        idx: 0,
      }]);

      const result = await orm.update(doc);

      expect(result).toBeInstanceOf(Document);
      expect(db.query).toHaveBeenCalled();

      const callArgs = (db.query as Mock).mock.calls[0];
      expect(callArgs[0]).toContain('UPDATE');
      expect(callArgs[0]).toContain('tab_todo');
    });

    it('should update the modified timestamp', async () => {
      const doc = new Document(meta, {
        title: 'Task',
        _isNew: false,
      });
      doc.name = 'TODO-001';
      doc.markAsClean();
      doc.set('title', 'Updated');

      const before = new Date();

      (db.query as Mock).mockResolvedValueOnce([{
        name: 'TODO-001',
        title: 'Updated',
        owner: 'admin',
        creation: new Date(),
        modified: new Date(),
        modified_by: 'admin',
        docstatus: 0,
        idx: 0,
      }]);

      await orm.update(doc);

      // The SQL params should include a recent modified timestamp
      const callArgs = (db.query as Mock).mock.calls[0];
      // Find the modified param — it should be a Date near 'before'
      const params = callArgs[1] as unknown[];
      const hasRecentDate = params.some(
        (p) => p instanceof Date && p.getTime() >= before.getTime() - 1000,
      );
      expect(hasRecentDate).toBe(true);
    });

    it('should run lifecycle hooks: beforeValidate→validate→beforeSave→DB→afterSave→onChange', async () => {
      const callOrder: string[] = [];

      class TrackedDoc extends Document {
        override async beforeValidate() { callOrder.push('beforeValidate'); }
        override async validate() { callOrder.push('validate'); }
        override async beforeSave() { callOrder.push('beforeSave'); }
        override async afterSave() { callOrder.push('afterSave'); }
        override async onChange() { callOrder.push('onChange'); }
      }

      const doc = new TrackedDoc(meta, {
        title: 'Task',
        _isNew: false,
      });
      doc.name = 'TODO-001';
      doc.markAsClean();
      doc.set('title', 'Updated');

      (db.query as Mock).mockResolvedValueOnce([{
        name: 'TODO-001',
        title: 'Updated',
        owner: 'admin',
        creation: new Date(),
        modified: new Date(),
        modified_by: 'admin',
        docstatus: 0,
        idx: 0,
      }]);

      await orm.update(doc);

      expect(callOrder).toEqual([
        'beforeValidate',
        'validate',
        'beforeSave',
        'afterSave',
        'onChange',
      ]);
    });
  });

  // --- deleteDoc ---

  describe('deleteDoc()', () => {
    it('should call DELETE on the database', async () => {
      // Mock getDoc to return a document
      (db.queryOne as Mock).mockResolvedValueOnce({
        name: 'TODO-001',
        title: 'Task',
        owner: 'admin',
        creation: new Date(),
        modified: new Date(),
        modified_by: 'admin',
        docstatus: 0,
        idx: 0,
      });

      (db.execute as Mock).mockResolvedValueOnce(1);

      await orm.deleteDoc('Todo', 'TODO-001');

      expect(db.execute).toHaveBeenCalled();
      const callArgs = (db.execute as Mock).mock.calls[0];
      expect(callArgs[0]).toContain('DELETE FROM');
      expect(callArgs[0]).toContain('tab_todo');
      expect(callArgs[1]).toContain('TODO-001');
    });

    it('should run lifecycle hooks: beforeDelete→DB DELETE→afterDelete', async () => {
      const callOrder: string[] = [];

      // We need to make the ORM create TrackedDoc instances.
      // We'll spy on the internal getDoc to return a tracked doc.
      (db.queryOne as Mock).mockResolvedValueOnce({
        name: 'TODO-001',
        title: 'Task',
        owner: 'admin',
        creation: new Date(),
        modified: new Date(),
        modified_by: 'admin',
        docstatus: 0,
        idx: 0,
      });

      // Spy on beforeDelete and afterDelete of the returned doc.
      const originalGetDoc = orm.getDoc.bind(orm);
      vi.spyOn(orm, 'getDoc').mockImplementation(async (doctype, name) => {
        const doc = await originalGetDoc(doctype, name);
        doc.beforeDelete = async () => { callOrder.push('beforeDelete'); };
        doc.afterDelete = async () => { callOrder.push('afterDelete'); };
        return doc;
      });

      (db.execute as Mock).mockResolvedValueOnce(1);

      await orm.deleteDoc('Todo', 'TODO-001');

      expect(callOrder).toContain('beforeDelete');
      expect(callOrder).toContain('afterDelete');
      // beforeDelete should come before afterDelete
      expect(callOrder.indexOf('beforeDelete')).toBeLessThan(callOrder.indexOf('afterDelete'));
    });

    it('should throw NotFoundError if document does not exist', async () => {
      (db.queryOne as Mock).mockResolvedValueOnce(null);

      await expect(orm.deleteDoc('Todo', 'NONEXISTENT')).rejects.toThrow(NotFoundError);
    });
  });

  // --- getCount ---

  describe('getCount()', () => {
    it('should return the count from the database', async () => {
      (db.queryOne as Mock).mockResolvedValueOnce({ count: '5' });

      const count = await orm.getCount('Todo');
      expect(count).toBe(5);
    });

    it('should pass filters to the count query', async () => {
      (db.queryOne as Mock).mockResolvedValueOnce({ count: '3' });

      await orm.getCount('Todo', { status: 'Open' });

      const callArgs = (db.queryOne as Mock).mock.calls[0];
      expect(callArgs[0]).toContain('COUNT');
      expect(callArgs[0]).toContain('status');
      expect(callArgs[1]).toContain('Open');
    });

    it('should return 0 when no results', async () => {
      (db.queryOne as Mock).mockResolvedValueOnce({ count: '0' });

      const count = await orm.getCount('Todo', { status: 'Unknown' });
      expect(count).toBe(0);
    });
  });

  // --- getValue ---

  describe('getValue()', () => {
    it('should return a single field value', async () => {
      (db.queryOne as Mock).mockResolvedValueOnce({ title: 'My Task' });

      const value = await orm.getValue('Todo', 'TODO-001', 'title');
      expect(value).toBe('My Task');
    });

    it('should return undefined when document not found', async () => {
      (db.queryOne as Mock).mockResolvedValueOnce(null);

      const value = await orm.getValue('Todo', 'NONEXISTENT', 'title');
      expect(value).toBeUndefined();
    });

    it('should query only the requested field', async () => {
      (db.queryOne as Mock).mockResolvedValueOnce({ title: 'Task' });

      await orm.getValue('Todo', 'TODO-001', 'title');

      const callArgs = (db.queryOne as Mock).mock.calls[0];
      expect(callArgs[0]).toContain('title');
      expect(callArgs[0]).toContain('tab_todo');
    });
  });

  // --- setValue ---

  describe('setValue()', () => {
    it('should update a single field value in the database', async () => {
      (db.execute as Mock).mockResolvedValueOnce(1);

      await orm.setValue('Todo', 'TODO-001', 'status', 'Closed');

      expect(db.execute).toHaveBeenCalled();
      const callArgs = (db.execute as Mock).mock.calls[0];
      expect(callArgs[0]).toContain('UPDATE');
      expect(callArgs[0]).toContain('tab_todo');
      expect(callArgs[0]).toContain('status');
    });

    it('should also update the modified timestamp', async () => {
      (db.execute as Mock).mockResolvedValueOnce(1);

      await orm.setValue('Todo', 'TODO-001', 'title', 'New Title');

      const callArgs = (db.execute as Mock).mock.calls[0];
      expect(callArgs[0]).toContain('modified');
    });
  });

  // --- exists ---

  describe('exists()', () => {
    it('should return true when document exists', async () => {
      (db.queryOne as Mock).mockResolvedValueOnce({ name: 'TODO-001' });

      const result = await orm.exists('Todo', 'TODO-001');
      expect(result).toBe(true);
    });

    it('should return false when document does not exist', async () => {
      (db.queryOne as Mock).mockResolvedValueOnce(null);

      const result = await orm.exists('Todo', 'NONEXISTENT');
      expect(result).toBe(false);
    });

    it('should query the correct table', async () => {
      (db.queryOne as Mock).mockResolvedValueOnce(null);

      await orm.exists('Todo', 'TODO-001');

      const callArgs = (db.queryOne as Mock).mock.calls[0];
      expect(callArgs[0]).toContain('tab_todo');
      expect(callArgs[1]).toContain('TODO-001');
    });
  });
});

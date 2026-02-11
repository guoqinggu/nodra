import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import { resourceRoutes } from '../../../src/api/resource.js';
import { errorHandlerPlugin } from '../../../src/api/error-handler.js';
import { NotFoundError } from '../../../src/core/errors.js';
import type { ORM } from '../../../src/orm/crud.js';
import type { DocTypeRegistry } from '../../../src/core/doctype/registry.js';
import type { DocTypeDefinition } from '../../../src/core/doctype/schema.js';

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
      {
        fieldname: 'status',
        fieldtype: 'Select',
        label: 'Status',
        options: ['Open', 'Closed'],
        default: 'Open',
      },
    ],
    permissions: [],
    ...overrides,
  };
}

/** Minimal mock Document that quacks enough for serialisation. */
function makeMockDoc(data: Record<string, unknown>) {
  return {
    doctype: data['doctype'] ?? 'Todo',
    name: data['name'] ?? 'abc123',
    owner: data['owner'] ?? 'Administrator',
    creation: data['creation'] ?? new Date('2025-01-01'),
    modified: data['modified'] ?? new Date('2025-01-01'),
    modified_by: data['modified_by'] ?? 'Administrator',
    docstatus: data['docstatus'] ?? 0,
    idx: data['idx'] ?? 0,
    getData() {
      return { ...data, doctype: this.doctype, name: this.name, owner: this.owner };
    },
    get(fieldname: string) {
      return data[fieldname];
    },
    set(fieldname: string, value: unknown) {
      data[fieldname] = value;
    },
    ...data,
  };
}

function createMockOrm() {
  return {
    getDoc: vi.fn(),
    getList: vi.fn(),
    getCount: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    deleteDoc: vi.fn(),
    getValue: vi.fn(),
    setValue: vi.fn(),
    exists: vi.fn(),
  } as unknown as ORM;
}

function createMockRegistry(knownDocTypes: string[] = ['Todo']): DocTypeRegistry {
  return {
    has: vi.fn((name: string) => knownDocTypes.includes(name)),
    get: vi.fn((name: string) => {
      if (!knownDocTypes.includes(name)) {
        throw new NotFoundError('DocType', name);
      }
      return makeMeta({ name });
    }),
    register: vi.fn(),
    list: vi.fn().mockReturnValue([]),
    listByModule: vi.fn().mockReturnValue([]),
    getLinkedDocTypes: vi.fn().mockReturnValue([]),
    clear: vi.fn(),
  } as unknown as DocTypeRegistry;
}

function buildApp(orm: ORM, registry: DocTypeRegistry) {
  const app = Fastify();
  errorHandlerPlugin(app);
  resourceRoutes(app, orm, registry);
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resourceRoutes', () => {
  let orm: ORM;
  let registry: DocTypeRegistry;

  beforeEach(() => {
    orm = createMockOrm();
    registry = createMockRegistry(['Todo']);
  });

  // -------------------------------------------------------------------------
  // GET /api/resource/:doctype — list
  // -------------------------------------------------------------------------

  describe('GET /api/resource/:doctype (list)', () => {
    it('should return an array of documents with meta', async () => {
      const docs = [
        makeMockDoc({ name: 'a1', title: 'Task 1', status: 'Open' }),
        makeMockDoc({ name: 'a2', title: 'Task 2', status: 'Closed' }),
      ];
      vi.mocked(orm.getList).mockResolvedValue(docs as never);
      vi.mocked(orm.getCount).mockResolvedValue(2);

      const app = buildApp(orm, registry);
      const res = await app.inject({ method: 'GET', url: '/api/resource/Todo' });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toHaveLength(2);
      expect(body.meta).toEqual({ total_count: 2, limit: 20, offset: 0 });
    });

    it('should parse limit_page_length and limit_start from query', async () => {
      vi.mocked(orm.getList).mockResolvedValue([]);
      vi.mocked(orm.getCount).mockResolvedValue(0);

      const app = buildApp(orm, registry);
      await app.inject({
        method: 'GET',
        url: '/api/resource/Todo?limit_page_length=5&limit_start=10',
      });

      expect(orm.getList).toHaveBeenCalledWith(
        'Todo',
        expect.objectContaining({ limit: 5, offset: 10 }),
      );
    });

    it('should parse fields from query', async () => {
      vi.mocked(orm.getList).mockResolvedValue([]);
      vi.mocked(orm.getCount).mockResolvedValue(0);

      const app = buildApp(orm, registry);
      await app.inject({
        method: 'GET',
        url: '/api/resource/Todo?fields=name,title,status',
      });

      expect(orm.getList).toHaveBeenCalledWith(
        'Todo',
        expect.objectContaining({ fields: ['name', 'title', 'status'] }),
      );
    });

    it('should parse filters from JSON query string', async () => {
      vi.mocked(orm.getList).mockResolvedValue([]);
      vi.mocked(orm.getCount).mockResolvedValue(0);

      const app = buildApp(orm, registry);
      const filters = JSON.stringify({ status: 'Open' });
      await app.inject({
        method: 'GET',
        url: `/api/resource/Todo?filters=${encodeURIComponent(filters)}`,
      });

      expect(orm.getList).toHaveBeenCalledWith(
        'Todo',
        expect.objectContaining({ filters: { status: 'Open' } }),
      );
    });

    it('should parse order_by from query', async () => {
      vi.mocked(orm.getList).mockResolvedValue([]);
      vi.mocked(orm.getCount).mockResolvedValue(0);

      const app = buildApp(orm, registry);
      await app.inject({
        method: 'GET',
        url: '/api/resource/Todo?order_by=creation desc',
      });

      expect(orm.getList).toHaveBeenCalledWith(
        'Todo',
        expect.objectContaining({ orderBy: 'creation desc' }),
      );
    });

    it('should return 404 for unregistered doctype', async () => {
      const app = buildApp(orm, registry);
      const res = await app.inject({ method: 'GET', url: '/api/resource/Unknown' });

      expect(res.statusCode).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/resource/:doctype/:name — get single
  // -------------------------------------------------------------------------

  describe('GET /api/resource/:doctype/:name (get)', () => {
    it('should return a single document', async () => {
      const doc = makeMockDoc({ name: 'a1', title: 'My Task', status: 'Open' });
      vi.mocked(orm.getDoc).mockResolvedValue(doc as never);

      const app = buildApp(orm, registry);
      const res = await app.inject({ method: 'GET', url: '/api/resource/Todo/a1' });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.name).toBe('a1');
    });

    it('should return 404 when document not found', async () => {
      vi.mocked(orm.getDoc).mockRejectedValue(new NotFoundError('Todo', 'nope'));

      const app = buildApp(orm, registry);
      const res = await app.inject({ method: 'GET', url: '/api/resource/Todo/nope' });

      expect(res.statusCode).toBe(404);
    });

    it('should return 404 for unregistered doctype', async () => {
      const app = buildApp(orm, registry);
      const res = await app.inject({ method: 'GET', url: '/api/resource/Unknown/abc' });

      expect(res.statusCode).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/resource/:doctype — create
  // -------------------------------------------------------------------------

  describe('POST /api/resource/:doctype (create)', () => {
    it('should create a document and return 201', async () => {
      const doc = makeMockDoc({ name: 'new1', title: 'New Task', status: 'Open' });
      vi.mocked(orm.insert).mockResolvedValue(doc as never);

      const app = buildApp(orm, registry);
      const res = await app.inject({
        method: 'POST',
        url: '/api/resource/Todo',
        payload: { title: 'New Task', status: 'Open' },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.data.name).toBe('new1');
    });

    it('should return 404 for unregistered doctype', async () => {
      const app = buildApp(orm, registry);
      const res = await app.inject({
        method: 'POST',
        url: '/api/resource/Unknown',
        payload: { title: 'test' },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // PUT /api/resource/:doctype/:name — update
  // -------------------------------------------------------------------------

  describe('PUT /api/resource/:doctype/:name (update)', () => {
    it('should update a document and return data', async () => {
      const existing = makeMockDoc({ name: 'a1', title: 'Old', status: 'Open' });
      vi.mocked(orm.getDoc).mockResolvedValue(existing as never);
      vi.mocked(orm.update).mockResolvedValue(
        makeMockDoc({ name: 'a1', title: 'Updated', status: 'Closed' }) as never,
      );

      const app = buildApp(orm, registry);
      const res = await app.inject({
        method: 'PUT',
        url: '/api/resource/Todo/a1',
        payload: { title: 'Updated', status: 'Closed' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.name).toBe('a1');
    });

    it('should return 404 for unregistered doctype', async () => {
      const app = buildApp(orm, registry);
      const res = await app.inject({
        method: 'PUT',
        url: '/api/resource/Unknown/abc',
        payload: { title: 'x' },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /api/resource/:doctype/:name — delete
  // -------------------------------------------------------------------------

  describe('DELETE /api/resource/:doctype/:name (delete)', () => {
    it('should delete a document and return message', async () => {
      vi.mocked(orm.deleteDoc).mockResolvedValue(undefined);

      const app = buildApp(orm, registry);
      const res = await app.inject({ method: 'DELETE', url: '/api/resource/Todo/a1' });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.message).toBe('ok');
      expect(orm.deleteDoc).toHaveBeenCalledWith('Todo', 'a1');
    });

    it('should return 404 for unregistered doctype', async () => {
      const app = buildApp(orm, registry);
      const res = await app.inject({ method: 'DELETE', url: '/api/resource/Unknown/abc' });

      expect(res.statusCode).toBe(404);
    });
  });
});

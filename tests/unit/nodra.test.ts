import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Nodra } from '../../src/nodra.js';
import type { NodraConfig } from '../../src/core/config.js';
import type { Database } from '../../src/database/connection.js';
import type { DocTypeDefinition } from '../../src/core/doctype/schema.js';
import type { Document } from '../../src/core/document/document.js';

// ---------------------------------------------------------------------------
// Mock the external dependencies so we never touch a real DB or filesystem
// ---------------------------------------------------------------------------

// Shared mock instances so tests can spy on calls
const mockDb = {
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  query: vi.fn().mockResolvedValue([]),
  queryOne: vi.fn().mockResolvedValue(null),
  execute: vi.fn().mockResolvedValue(0),
  healthCheck: vi.fn().mockResolvedValue(true),
  isConnected: vi.fn().mockReturnValue(true),
  getPool: vi.fn().mockReturnValue(null),
};

const mockOrm = {
  insert: vi.fn(),
  getDoc: vi.fn(),
  getList: vi.fn(),
  getCount: vi.fn(),
  getValue: vi.fn(),
  setValue: vi.fn(),
  deleteDoc: vi.fn(),
  exists: vi.fn(),
  update: vi.fn(),
};

vi.mock('../../src/database/connection.js', () => {
  return {
    Database: class Database {
      connect = mockDb.connect;
      disconnect = mockDb.disconnect;
      query = mockDb.query;
      queryOne = mockDb.queryOne;
      execute = mockDb.execute;
      healthCheck = mockDb.healthCheck;
      isConnected = mockDb.isConnected;
      getPool = mockDb.getPool;
    },
  };
});

vi.mock('../../src/utils/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  })),
}));

vi.mock('../../src/orm/crud.js', () => {
  return {
    ORM: class ORM {
      insert = mockOrm.insert;
      getDoc = mockOrm.getDoc;
      getList = mockOrm.getList;
      getCount = mockOrm.getCount;
      getValue = mockOrm.getValue;
      setValue = mockOrm.setValue;
      deleteDoc = mockOrm.deleteDoc;
      exists = mockOrm.exists;
      update = mockOrm.update;
    },
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<NodraConfig> = {}): NodraConfig {
  return {
    db: {
      host: 'localhost',
      port: 5432,
      database: 'nodra_test',
      user: 'postgres',
      password: 'secret',
      pool: { min: 1, max: 5, idleTimeoutMillis: 10000 },
    },
    server: { host: '0.0.0.0', port: 8000 },
    auth: { secret: 'test-secret', tokenExpiry: '24h', passwordHashRounds: 12 },
    jobs: { concurrency: 5, retryLimit: 3, retryDelay: 60000 },
    logging: { level: 'info', format: 'json' },
    installedApps: ['nodra'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Nodra', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create an instance with config, db, registry, orm, and logger', () => {
      const config = makeConfig();
      const nodra = new Nodra(config);

      expect(nodra.config).toBe(config);
      expect(nodra.db).toBeDefined();
      expect(nodra.registry).toBeDefined();
      expect(nodra.orm).toBeDefined();
      expect(nodra.logger).toBeDefined();
    });
  });

  describe('getDoc()', () => {
    it('should delegate to orm.getDoc', async () => {
      const config = makeConfig();
      const nodra = new Nodra(config);

      const fakeDoc = { doctype: 'Todo', name: 'abc' } as unknown as Document;
      mockOrm.getDoc.mockResolvedValue(fakeDoc);

      const result = await nodra.getDoc('Todo', 'abc');

      expect(mockOrm.getDoc).toHaveBeenCalledWith('Todo', 'abc');
      expect(result).toBe(fakeDoc);
    });
  });

  describe('getList()', () => {
    it('should delegate to orm.getList', async () => {
      const config = makeConfig();
      const nodra = new Nodra(config);

      const fakeDocs = [{ doctype: 'Todo', name: 'a' }] as unknown as Document[];
      mockOrm.getList.mockResolvedValue(fakeDocs);

      const options = { filters: { status: 'Open' }, limit: 10 };
      const result = await nodra.getList('Todo', options);

      expect(mockOrm.getList).toHaveBeenCalledWith('Todo', options);
      expect(result).toBe(fakeDocs);
    });
  });

  describe('getCount()', () => {
    it('should delegate to orm.getCount', async () => {
      const config = makeConfig();
      const nodra = new Nodra(config);

      mockOrm.getCount.mockResolvedValue(42);

      const result = await nodra.getCount('Todo', { status: 'Open' });

      expect(mockOrm.getCount).toHaveBeenCalledWith('Todo', { status: 'Open' });
      expect(result).toBe(42);
    });
  });

  describe('getValue()', () => {
    it('should delegate to orm.getValue', async () => {
      const config = makeConfig();
      const nodra = new Nodra(config);

      mockOrm.getValue.mockResolvedValue('My Task');

      const result = await nodra.getValue('Todo', 'abc', 'title');

      expect(mockOrm.getValue).toHaveBeenCalledWith('Todo', 'abc', 'title');
      expect(result).toBe('My Task');
    });
  });

  describe('setValue()', () => {
    it('should delegate to orm.setValue', async () => {
      const config = makeConfig();
      const nodra = new Nodra(config);

      mockOrm.setValue.mockResolvedValue(undefined);

      await nodra.setValue('Todo', 'abc', 'status', 'Closed');

      expect(mockOrm.setValue).toHaveBeenCalledWith('Todo', 'abc', 'status', 'Closed');
    });
  });

  describe('deleteDoc()', () => {
    it('should delegate to orm.deleteDoc', async () => {
      const config = makeConfig();
      const nodra = new Nodra(config);

      mockOrm.deleteDoc.mockResolvedValue(undefined);

      await nodra.deleteDoc('Todo', 'abc');

      expect(mockOrm.deleteDoc).toHaveBeenCalledWith('Todo', 'abc');
    });
  });

  describe('exists()', () => {
    it('should delegate to orm.exists', async () => {
      const config = makeConfig();
      const nodra = new Nodra(config);

      mockOrm.exists.mockResolvedValue(true);

      const result = await nodra.exists('Todo', 'abc');

      expect(mockOrm.exists).toHaveBeenCalledWith('Todo', 'abc');
      expect(result).toBe(true);
    });
  });

  describe('shutdown()', () => {
    it('should disconnect the database', async () => {
      const config = makeConfig();
      const nodra = new Nodra(config);

      await nodra.shutdown();

      expect(nodra.db.disconnect).toHaveBeenCalled();
    });
  });
});

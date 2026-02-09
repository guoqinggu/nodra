/**
 * Nodra Framework - Database Connection Manager Tests
 *
 * Unit tests for the Database class. Uses vi.mock to mock the pg module
 * so that no real PostgreSQL instance is required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DatabaseConfig } from '../../../src/core/config.js';
import { DatabaseError } from '../../../src/core/errors.js';

// --- Mock pg module ---

const mockQuery = vi.fn();
const mockEnd = vi.fn();
const mockConnect = vi.fn();

vi.mock('pg', () => {
  // Use a class so `new pg.Pool(...)` works as a constructor
  class MockPool {
    query = mockQuery;
    end = mockEnd;
    connect = mockConnect;
  }
  return {
    default: { Pool: MockPool },
    Pool: MockPool,
  };
});

// Import after mocking
import { Database } from '../../../src/database/connection.js';

// --- Test helpers ---

function createTestConfig(): DatabaseConfig {
  return {
    host: 'localhost',
    port: 5432,
    database: 'test_db',
    user: 'test_user',
    password: 'test_pass',
    pool: {
      min: 2,
      max: 10,
      idleTimeoutMillis: 30000,
    },
  };
}

// --- Tests ---

describe('Database', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnd.mockResolvedValue(undefined);
  });

  describe('constructor', () => {
    it('stores config without creating a pool', () => {
      const config = createTestConfig();
      const db = new Database(config);

      expect(db.isConnected()).toBe(false);
      expect(db.getPool()).toBeNull();
    });
  });

  describe('connect()', () => {
    it('creates a Pool and marks isConnected as true', async () => {
      const config = createTestConfig();
      const db = new Database(config);

      // Simulate healthy pool
      mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

      await db.connect();

      expect(db.isConnected()).toBe(true);
      expect(db.getPool()).not.toBeNull();
    });
  });

  describe('disconnect()', () => {
    it('ends the pool and marks isConnected as false', async () => {
      const config = createTestConfig();
      const db = new Database(config);

      mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
      await db.connect();
      expect(db.isConnected()).toBe(true);

      await db.disconnect();

      expect(mockEnd).toHaveBeenCalledOnce();
      expect(db.isConnected()).toBe(false);
      expect(db.getPool()).toBeNull();
    });

    it('is a no-op when not connected', async () => {
      const config = createTestConfig();
      const db = new Database(config);

      await db.disconnect(); // Should not throw

      expect(mockEnd).not.toHaveBeenCalled();
      expect(db.isConnected()).toBe(false);
    });
  });

  describe('query()', () => {
    it('calls pool.query and returns rows', async () => {
      const config = createTestConfig();
      const db = new Database(config);

      mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] }); // connect health check
      await db.connect();

      const expectedRows = [
        { name: 'TODO-001', title: 'Test Todo' },
        { name: 'TODO-002', title: 'Another Todo' },
      ];
      mockQuery.mockResolvedValueOnce({ rows: expectedRows });

      const result = await db.query('SELECT * FROM tab_todo');

      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM tab_todo', undefined);
      expect(result).toEqual(expectedRows);
    });

    it('passes params to pool.query', async () => {
      const config = createTestConfig();
      const db = new Database(config);

      mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
      await db.connect();

      mockQuery.mockResolvedValueOnce({ rows: [{ name: 'TODO-001' }] });

      const result = await db.query('SELECT * FROM tab_todo WHERE status = $1', ['Open']);

      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM tab_todo WHERE status = $1', ['Open']);
      expect(result).toEqual([{ name: 'TODO-001' }]);
    });

    it('throws DatabaseError when not connected', async () => {
      const config = createTestConfig();
      const db = new Database(config);

      await expect(db.query('SELECT 1')).rejects.toThrow(DatabaseError);
      await expect(db.query('SELECT 1')).rejects.toThrow('Database is not connected');
    });

    it('throws DatabaseError after disconnect', async () => {
      const config = createTestConfig();
      const db = new Database(config);

      mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
      await db.connect();
      await db.disconnect();

      await expect(db.query('SELECT 1')).rejects.toThrow(DatabaseError);
    });
  });

  describe('queryOne()', () => {
    it('returns the first row when rows exist', async () => {
      const config = createTestConfig();
      const db = new Database(config);

      mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
      await db.connect();

      const expectedRow = { name: 'TODO-001', title: 'Test Todo' };
      mockQuery.mockResolvedValueOnce({ rows: [expectedRow, { name: 'TODO-002', title: 'Other' }] });

      const result = await db.queryOne('SELECT * FROM tab_todo LIMIT 1');

      expect(result).toEqual(expectedRow);
    });

    it('returns null when no rows', async () => {
      const config = createTestConfig();
      const db = new Database(config);

      mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
      await db.connect();

      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await db.queryOne('SELECT * FROM tab_todo WHERE name = $1', ['nonexistent']);

      expect(result).toBeNull();
    });

    it('throws DatabaseError when not connected', async () => {
      const config = createTestConfig();
      const db = new Database(config);

      await expect(db.queryOne('SELECT 1')).rejects.toThrow(DatabaseError);
    });
  });

  describe('execute()', () => {
    it('returns rowCount for DML statements', async () => {
      const config = createTestConfig();
      const db = new Database(config);

      mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
      await db.connect();

      mockQuery.mockResolvedValueOnce({ rowCount: 3 });

      const affected = await db.execute('UPDATE tab_todo SET status = $1 WHERE status = $2', ['Closed', 'Open']);

      expect(affected).toBe(3);
    });

    it('returns 0 when rowCount is null', async () => {
      const config = createTestConfig();
      const db = new Database(config);

      mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
      await db.connect();

      mockQuery.mockResolvedValueOnce({ rowCount: null });

      const affected = await db.execute('UPDATE tab_todo SET status = $1 WHERE name = $2', ['Closed', 'nonexistent']);

      expect(affected).toBe(0);
    });

    it('throws DatabaseError when not connected', async () => {
      const config = createTestConfig();
      const db = new Database(config);

      await expect(db.execute('DELETE FROM tab_todo')).rejects.toThrow(DatabaseError);
    });
  });

  describe('healthCheck()', () => {
    it('returns true when SELECT 1 succeeds', async () => {
      const config = createTestConfig();
      const db = new Database(config);

      mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
      await db.connect();

      mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

      const result = await db.healthCheck();

      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith('SELECT 1');
    });

    it('returns false when SELECT 1 fails', async () => {
      const config = createTestConfig();
      const db = new Database(config);

      mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
      await db.connect();

      mockQuery.mockRejectedValueOnce(new Error('connection lost'));

      const result = await db.healthCheck();

      expect(result).toBe(false);
    });

    it('returns false when not connected', async () => {
      const config = createTestConfig();
      const db = new Database(config);

      const result = await db.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('wraps pg errors in DatabaseError', () => {
    it('wraps query errors in DatabaseError', async () => {
      const config = createTestConfig();
      const db = new Database(config);

      mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
      await db.connect();

      const pgError = new Error('relation "tab_todo" does not exist');
      mockQuery.mockRejectedValueOnce(pgError);

      await expect(db.query('SELECT * FROM tab_todo')).rejects.toThrow(DatabaseError);

      try {
        await db.query('SELECT * FROM tab_todo');
      } catch (err) {
        // Second mock needed
        mockQuery.mockRejectedValueOnce(pgError);
        try {
          await db.query('SELECT * FROM tab_todo');
        } catch (error) {
          expect(error).toBeInstanceOf(DatabaseError);
          expect((error as DatabaseError).cause).toBe(pgError);
        }
      }
    });

    it('wraps execute errors in DatabaseError', async () => {
      const config = createTestConfig();
      const db = new Database(config);

      mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
      await db.connect();

      const pgError = new Error('syntax error');
      mockQuery.mockRejectedValueOnce(pgError);

      await expect(db.execute('INVALID SQL')).rejects.toThrow(DatabaseError);
    });

    it('preserves original error as cause', async () => {
      const config = createTestConfig();
      const db = new Database(config);

      mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
      await db.connect();

      const pgError = new Error('column "foo" does not exist');
      mockQuery.mockRejectedValueOnce(pgError);

      try {
        await db.query('SELECT foo FROM tab_todo');
      } catch (error) {
        expect(error).toBeInstanceOf(DatabaseError);
        expect((error as DatabaseError).cause).toBe(pgError);
        expect((error as DatabaseError).message).toContain('column "foo" does not exist');
      }
    });
  });
});

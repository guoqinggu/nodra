/**
 * Nodra Framework - Transaction Wrapper Tests
 *
 * Unit tests for the withTransaction() function. Uses a mocked Database
 * so that no real PostgreSQL instance is required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withTransaction } from '../../../src/database/transaction.js';
import type { TransactionClient } from '../../../src/database/transaction.js';
import type { Database } from '../../../src/database/connection.js';
import { DatabaseError } from '../../../src/core/errors.js';

// --- Mock helpers ---

function createMockClient() {
  const mockClientQuery = vi.fn().mockResolvedValue({ rows: [] });
  const mockClientRelease = vi.fn();
  return {
    query: mockClientQuery,
    release: mockClientRelease,
  };
}

function createMockDatabase(mockClient: ReturnType<typeof createMockClient>) {
  const mockPool = {
    connect: vi.fn().mockResolvedValue(mockClient),
  };

  return {
    getPool: vi.fn().mockReturnValue(mockPool),
    isConnected: vi.fn().mockReturnValue(true),
  } as unknown as Database;
}

// --- Tests ---

describe('withTransaction', () => {
  let mockClient: ReturnType<typeof createMockClient>;
  let mockDb: Database;

  beforeEach(() => {
    mockClient = createMockClient();
    mockDb = createMockDatabase(mockClient);
  });

  it('calls BEGIN, then fn, then COMMIT on success', async () => {
    const callOrder: string[] = [];

    mockClient.query.mockImplementation(async (sql: string) => {
      callOrder.push(sql);
      return { rows: [], rowCount: 0 };
    });

    const fn = vi.fn(async (_client: TransactionClient) => {
      callOrder.push('fn');
      return 'result';
    });

    await withTransaction(mockDb, fn);

    expect(callOrder[0]).toBe('BEGIN');
    expect(callOrder[1]).toBe('fn');
    expect(callOrder[2]).toBe('COMMIT');
    expect(callOrder).not.toContain('ROLLBACK');
  });

  it('calls BEGIN, then fn, then ROLLBACK on error, and re-throws', async () => {
    const callOrder: string[] = [];

    mockClient.query.mockImplementation(async (sql: string) => {
      callOrder.push(sql);
      return { rows: [], rowCount: 0 };
    });

    const testError = new Error('something went wrong');

    const fn = vi.fn(async (_client: TransactionClient) => {
      callOrder.push('fn');
      throw testError;
    });

    await expect(withTransaction(mockDb, fn)).rejects.toThrow('something went wrong');

    expect(callOrder[0]).toBe('BEGIN');
    expect(callOrder[1]).toBe('fn');
    expect(callOrder[2]).toBe('ROLLBACK');
    expect(callOrder).not.toContain('COMMIT');
  });

  it('returns the value from fn on success', async () => {
    mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });

    const result = await withTransaction(mockDb, async () => {
      return { id: 42, name: 'test' };
    });

    expect(result).toEqual({ id: 42, name: 'test' });
  });

  it('releases the client after success', async () => {
    mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });

    await withTransaction(mockDb, async () => 'ok');

    expect(mockClient.release).toHaveBeenCalledOnce();
  });

  it('releases the client after error', async () => {
    mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });

    try {
      await withTransaction(mockDb, async () => {
        throw new Error('fail');
      });
    } catch {
      // expected
    }

    expect(mockClient.release).toHaveBeenCalledOnce();
  });

  it('provides a TransactionClient with query, queryOne, and execute', async () => {
    const rows = [{ name: 'TODO-001', title: 'Test' }];
    mockClient.query.mockResolvedValue({ rows, rowCount: 1 });

    await withTransaction(mockDb, async (client) => {
      // query
      const queryResult = await client.query('SELECT * FROM tab_todo');
      expect(queryResult).toEqual(rows);

      // queryOne
      const oneResult = await client.queryOne('SELECT * FROM tab_todo WHERE name = $1', ['TODO-001']);
      expect(oneResult).toEqual(rows[0]);

      // execute
      const execResult = await client.execute('UPDATE tab_todo SET status = $1', ['Closed']);
      expect(execResult).toBe(1);
    });
  });

  it('queryOne returns null when no rows', async () => {
    mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });

    await withTransaction(mockDb, async (client) => {
      const result = await client.queryOne('SELECT * FROM tab_todo WHERE name = $1', ['nonexistent']);
      expect(result).toBeNull();
    });
  });

  it('throws DatabaseError when database is not connected', async () => {
    const disconnectedDb = {
      getPool: vi.fn().mockReturnValue(null),
      isConnected: vi.fn().mockReturnValue(false),
    } as unknown as Database;

    await expect(
      withTransaction(disconnectedDb, async () => 'ok'),
    ).rejects.toThrow(DatabaseError);
  });
});

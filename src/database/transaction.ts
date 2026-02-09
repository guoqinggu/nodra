/**
 * Nodra Framework - Transaction Wrapper
 *
 * Provides a `withTransaction` helper that acquires a client from the
 * Database pool, runs BEGIN/COMMIT/ROLLBACK around a user-supplied function,
 * and always releases the client back to the pool.
 */

import type { PoolClient } from 'pg';
import type { Database } from './connection.js';
import { DatabaseError } from '../core/errors.js';

// --- Public types ---

/**
 * A transaction-scoped client that provides query, queryOne, and execute.
 * All operations run within the same database transaction.
 */
export interface TransactionClient {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null>;
  execute(sql: string, params?: unknown[]): Promise<number>;
}

// --- Implementation ---

/**
 * Execute a function within a database transaction.
 *
 * - Acquires a dedicated client from the pool.
 * - Issues BEGIN before calling `fn`.
 * - Issues COMMIT if `fn` resolves successfully.
 * - Issues ROLLBACK if `fn` throws, then re-throws the error.
 * - Always releases the client back to the pool.
 *
 * @returns The value returned by `fn`.
 */
export async function withTransaction<T>(
  db: Database,
  fn: (client: TransactionClient) => Promise<T>,
): Promise<T> {
  const pool = db.getPool();
  if (!pool) {
    throw new DatabaseError('Database is not connected');
  }

  const pgClient: PoolClient = await pool.connect();

  try {
    await pgClient.query('BEGIN');

    const txClient: TransactionClient = createTransactionClient(pgClient);
    const result = await fn(txClient);

    await pgClient.query('COMMIT');
    return result;
  } catch (error) {
    await pgClient.query('ROLLBACK');
    throw error;
  } finally {
    pgClient.release();
  }
}

// --- Private helpers ---

function createTransactionClient(pgClient: PoolClient): TransactionClient {
  return {
    async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
      try {
        const result = await pgClient.query(sql, params);
        return result.rows as T[];
      } catch (error) {
        throw new DatabaseError(
          error instanceof Error ? error.message : String(error),
          { cause: error instanceof Error ? error : undefined },
        );
      }
    },

    async queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null> {
      const rows = await this.query<T>(sql, params);
      return rows[0] ?? null;
    },

    async execute(sql: string, params?: unknown[]): Promise<number> {
      try {
        const result = await pgClient.query(sql, params);
        return result.rowCount ?? 0;
      } catch (error) {
        throw new DatabaseError(
          error instanceof Error ? error.message : String(error),
          { cause: error instanceof Error ? error : undefined },
        );
      }
    },
  };
}

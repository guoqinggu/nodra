/**
 * Nodra Framework - Database Connection Manager
 *
 * Wraps pg.Pool to provide a managed connection pool with health checks,
 * parameterized queries, and proper error wrapping.
 */

import pg from 'pg';
import type { Pool, PoolConfig } from 'pg';
import type { DatabaseConfig } from '../core/config.js';
import { DatabaseError } from '../core/errors.js';

/**
 * Database connection manager.
 *
 * Manages a pg.Pool connection pool and provides convenience methods
 * for running parameterized queries, single-row lookups, and DML execution.
 */
export class Database {
  private readonly config: DatabaseConfig;
  private pool: Pool | null = null;
  private connected = false;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  /**
   * Create the connection pool and verify connectivity with a health check.
   */
  async connect(): Promise<void> {
    const poolConfig: PoolConfig = {
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      min: this.config.pool.min,
      max: this.config.pool.max,
      idleTimeoutMillis: this.config.pool.idleTimeoutMillis,
    };

    this.pool = new pg.Pool(poolConfig);
    this.connected = true;

    // Verify the pool works
    try {
      await this.pool.query('SELECT 1');
    } catch (error) {
      this.pool = null;
      this.connected = false;
      throw new DatabaseError('Failed to connect to database', {
        cause: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  /**
   * Drain and end the connection pool.
   */
  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.connected = false;
    }
  }

  /**
   * Run a parameterized query and return all rows.
   *
   * @throws {DatabaseError} If the database is not connected or the query fails.
   */
  async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
    const pool = this.ensureConnected();

    try {
      const result = await pool.query(sql, params);
      return result.rows as T[];
    } catch (error) {
      throw new DatabaseError(
        error instanceof Error ? error.message : String(error),
        { cause: error instanceof Error ? error : undefined },
      );
    }
  }

  /**
   * Run a parameterized query and return the first row, or null if no rows.
   *
   * @throws {DatabaseError} If the database is not connected or the query fails.
   */
  async queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows[0] ?? null;
  }

  /**
   * Run a parameterized DML statement and return the affected row count.
   *
   * @throws {DatabaseError} If the database is not connected or the statement fails.
   */
  async execute(sql: string, params?: unknown[]): Promise<number> {
    const pool = this.ensureConnected();

    try {
      const result = await pool.query(sql, params);
      return result.rowCount ?? 0;
    } catch (error) {
      throw new DatabaseError(
        error instanceof Error ? error.message : String(error),
        { cause: error instanceof Error ? error : undefined },
      );
    }
  }

  /**
   * Run a SELECT 1 health check against the database.
   *
   * @returns true if healthy, false otherwise.
   */
  async healthCheck(): Promise<boolean> {
    if (!this.pool || !this.connected) {
      return false;
    }

    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Returns whether the database pool is currently connected.
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Returns the underlying pg.Pool instance, or null if not connected.
   */
  getPool(): Pool | null {
    return this.pool;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private ensureConnected(): Pool {
    if (!this.pool || !this.connected) {
      throw new DatabaseError('Database is not connected');
    }
    return this.pool;
  }
}

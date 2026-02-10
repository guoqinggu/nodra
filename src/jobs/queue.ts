/**
 * PostgreSQL-based Job Queue Implementation
 */

import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import type {
  Job,
  JobQueue,
  JobQueueConfig,
  JobStatus,
  JobPriority,
} from './types.js';

export class JobQueueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JobQueueError';
  }
}

/**
 * PostgreSQL-based job queue using SKIP LOCKED for concurrency
 */
export class PostgresJobQueue implements JobQueue {
  private pool: Pool;
  private tableName: string;
  private defaultTimeout: number;
  private defaultMaxAttempts: number;

  constructor(config: JobQueueConfig) {
    this.pool = new Pool({
      connectionString: config.connectionString,
    });

    this.tableName = config.tableName || 'nodra_jobs';
    this.defaultTimeout = config.defaultTimeout || 300000; // 5 minutes
    this.defaultMaxAttempts = config.defaultMaxAttempts || 3;
  }

  /**
   * Initialize the job queue (create table if needed)
   */
  async initialize(): Promise<void> {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        data JSONB NOT NULL,
        status TEXT NOT NULL,
        priority INTEGER NOT NULL DEFAULT 2,
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        timeout INTEGER,
        result JSONB
      );

      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_status 
        ON ${this.tableName}(status);
      
      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_scheduled 
        ON ${this.tableName}(scheduled_at) 
        WHERE status = 'queued';
      
      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_priority 
        ON ${this.tableName}(priority DESC, created_at ASC) 
        WHERE status = 'queued';
    `;

    await this.pool.query(createTableSQL);
  }

  /**
   * Add a job to the queue
   */
  async enqueue<T = unknown>(
    type: string,
    data: T,
    options: {
      priority?: JobPriority;
      scheduledAt?: Date;
      maxAttempts?: number;
      timeout?: number;
    } = {},
  ): Promise<Job<T>> {
    const id = randomUUID();
    const priority = options.priority || 'normal';
    const priorityValue = this.getPriorityValue(priority);
    const scheduledAt = options.scheduledAt || new Date();
    const maxAttempts = options.maxAttempts || this.defaultMaxAttempts;
    const timeout = options.timeout || this.defaultTimeout;

    const sql = `
      INSERT INTO ${this.tableName} (
        id, type, data, status, priority, max_attempts, scheduled_at, timeout
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const result = await this.pool.query(sql, [
      id,
      type,
      JSON.stringify(data),
      'queued',
      priorityValue,
      maxAttempts,
      scheduledAt,
      timeout,
    ]);

    return this.rowToJob<T>(result.rows[0]);
  }

  /**
   * Dequeue next available job (using SKIP LOCKED for concurrency)
   */
  async dequeue(): Promise<Job | null> {
    const sql = `
      UPDATE ${this.tableName}
      SET status = 'active', started_at = NOW()
      WHERE id = (
        SELECT id FROM ${this.tableName}
        WHERE status = 'queued' 
          AND scheduled_at <= NOW()
        ORDER BY priority DESC, created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `;

    const result = await this.pool.query(sql);

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToJob(result.rows[0]);
  }

  /**
   * Mark job as completed
   */
  async complete(jobId: string, result?: unknown): Promise<void> {
    const sql = `
      UPDATE ${this.tableName}
      SET status = 'completed', completed_at = NOW(), result = $2
      WHERE id = $1
    `;

    await this.pool.query(sql, [jobId, result ? JSON.stringify(result) : null]);
  }

  /**
   * Mark job as failed
   */
  async fail(jobId: string, error: string): Promise<void> {
    const sql = `
      UPDATE ${this.tableName}
      SET status = 'failed', error = $2, attempts = attempts + 1
      WHERE id = $1
    `;

    await this.pool.query(sql, [jobId, error]);
  }

  /**
   * Retry a failed job
   */
  async retry(jobId: string): Promise<void> {
    // Check if job can be retried
    const job = await this.getJob(jobId);

    if (!job) {
      throw new JobQueueError(`Job ${jobId} not found`);
    }

    if (job.attempts >= job.max_attempts) {
      throw new JobQueueError(
        `Job ${jobId} has exceeded maximum attempts (${job.max_attempts})`,
      );
    }

    const sql = `
      UPDATE ${this.tableName}
      SET status = 'queued', error = NULL, started_at = NULL, scheduled_at = NOW()
      WHERE id = $1
    `;

    await this.pool.query(sql, [jobId]);
  }

  /**
   * Cancel a job
   */
  async cancel(jobId: string): Promise<void> {
    const sql = `
      UPDATE ${this.tableName}
      SET status = 'cancelled'
      WHERE id = $1
    `;

    await this.pool.query(sql, [jobId]);
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<Job | null> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE id = $1
    `;

    const result = await this.pool.query(sql, [jobId]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToJob(result.rows[0]);
  }

  /**
   * Get jobs by status
   */
  async getJobsByStatus(status: JobStatus, limit = 100): Promise<Job[]> {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE status = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;

    const result = await this.pool.query(sql, [status, limit]);

    return result.rows.map((row) => this.rowToJob(row));
  }

  /**
   * Clean up old completed/failed jobs
   */
  async cleanup(olderThan: Date): Promise<number> {
    const sql = `
      DELETE FROM ${this.tableName}
      WHERE status IN ('completed', 'failed')
        AND completed_at < $1
    `;

    const result = await this.pool.query(sql, [olderThan]);

    return result.rowCount || 0;
  }

  /**
   * Close the queue
   */
  async close(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Convert priority name to numeric value
   */
  private getPriorityValue(priority: JobPriority): number {
    const values: Record<JobPriority, number> = {
      low: 1,
      normal: 2,
      high: 3,
      critical: 4,
    };
    return values[priority];
  }

  /**
   * Convert priority numeric value to name
   */
  private getPriorityName(value: number): JobPriority {
    const priorities: Record<number, JobPriority> = {
      1: 'low',
      2: 'normal',
      3: 'high',
      4: 'critical',
    };
    return priorities[value] || 'normal';
  }

  /**
   * Convert database row to Job object
   */
  private rowToJob<T = unknown>(row: Record<string, unknown>): Job<T> {
    return {
      id: row['id'] as string,
      type: row['type'] as string,
      data: typeof row['data'] === 'string' 
        ? JSON.parse(row['data']) 
        : row['data'] as T,
      status: row['status'] as JobStatus,
      priority: this.getPriorityName(row['priority'] as number),
      attempts: row['attempts'] as number,
      max_attempts: row['max_attempts'] as number,
      error: row['error'] as string | undefined,
      created_at: new Date(row['created_at'] as string),
      scheduled_at: new Date(row['scheduled_at'] as string),
      started_at: row['started_at'] 
        ? new Date(row['started_at'] as string) 
        : undefined,
      completed_at: row['completed_at']
        ? new Date(row['completed_at'] as string)
        : undefined,
      timeout: row['timeout'] as number | undefined,
      result: row['result']
        ? (typeof row['result'] === 'string' 
          ? JSON.parse(row['result']) 
          : row['result'])
        : undefined,
    };
  }
}

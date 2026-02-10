import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PostgresJobQueue, JobQueueError } from '../../../src/jobs/queue.js';

// Mock pg module with proper constructor
vi.mock('pg', () => {
  const mockQuery = vi.fn();
  const mockEnd = vi.fn();

  class MockPool {
    query = mockQuery;
    end = mockEnd;
  }

  return {
    Pool: MockPool,
    _mockQuery: mockQuery,
    _mockEnd: mockEnd,
  };
});

// Get mock functions
const pg = await import('pg');
const mockQuery = (pg as any)._mockQuery;
const mockEnd = (pg as any)._mockEnd;

describe('PostgresJobQueue', () => {
  let queue: PostgresJobQueue;

  beforeEach(async () => {
    vi.clearAllMocks();

    queue = new PostgresJobQueue({
      connectionString: 'postgresql://test',
      tableName: 'test_jobs',
    });

    // Mock initialize (this will be the first call to mockQuery)
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await queue.initialize();
    
    // Clear mocks after initialization so tests start fresh
    vi.clearAllMocks();
  });

  describe('Job Queue Operations', () => {
    it('should enqueue a job', async () => {
      const now = new Date().toISOString();
      const mockRow = {
        id: 'job-123',
        type: 'test-job',
        data: JSON.stringify({ message: 'Hello' }),
        status: 'queued',
        priority: 2,
        attempts: 0,
        max_attempts: 3,
        created_at: now,
        scheduled_at: now,
        timeout: 300000,
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockRow], rowCount: 1 });

      const job = await queue.enqueue('test-job', { message: 'Hello' });

      expect(job.type).toBe('test-job');
      expect(job.data).toEqual({ message: 'Hello' });
      expect(job.status).toBe('queued');
      expect(job.priority).toBe('normal');
      expect(job.attempts).toBe(0);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO test_jobs'),
        expect.arrayContaining(['test-job', JSON.stringify({ message: 'Hello' })]),
      );
    });

    it('should enqueue job with custom priority', async () => {
      const now = new Date().toISOString();
      const mockRow = {
        id: 'job-123',
        type: 'test-job',
        data: JSON.stringify({}),
        status: 'queued',
        priority: 3,
        attempts: 0,
        max_attempts: 3,
        created_at: now,
        scheduled_at: now,
        timeout: 300000,
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockRow], rowCount: 1 });

      const job = await queue.enqueue('test-job', {}, { priority: 'high' });

      expect(job.priority).toBe('high');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([expect.any(String), 'test-job', expect.any(String), 'queued', 3]),
      );
    });

    it('should dequeue a job using SKIP LOCKED', async () => {
      const now = new Date().toISOString();
      const mockRow = {
        id: 'job-123',
        type: 'test-job',
        data: JSON.stringify({ message: 'Hello' }),
        status: 'active',
        priority: 2,
        attempts: 0,
        max_attempts: 3,
        created_at: now,
        scheduled_at: now,
        started_at: now,
        timeout: 300000,
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockRow], rowCount: 1 });

      const job = await queue.dequeue();

      expect(job).not.toBeNull();
      expect(job?.status).toBe('active');
      expect(job?.started_at).toBeDefined();
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('FOR UPDATE SKIP LOCKED'),
      );
    });

    it('should return null when no jobs available', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const job = await queue.dequeue();

      expect(job).toBeNull();
    });
  });

  describe('Job Status Management', () => {
    it('should complete a job', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await queue.complete('job-123', { success: true });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE test_jobs'),
        expect.arrayContaining(['job-123', JSON.stringify({ success: true })]),
      );
    });

    it('should fail a job', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await queue.fail('job-123', 'Error occurred');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE test_jobs'),
        expect.arrayContaining(['job-123', 'Error occurred']),
      );
    });

    it('should retry a failed job', async () => {
      const now = new Date().toISOString();
      const failedJob = {
        id: 'job-123',
        type: 'test-job',
        data: JSON.stringify({}),
        status: 'failed',
        priority: 2,
        attempts: 1,
        max_attempts: 3,
        error: 'Previous error',
        created_at: now,
        scheduled_at: now,
      };

      // Mock getJob call
      mockQuery.mockResolvedValueOnce({ rows: [failedJob], rowCount: 1 });
      // Mock retry update
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await queue.retry('job-123');

      // First call is getJob (SELECT), second call is the retry UPDATE
      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(mockQuery).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('SELECT * FROM test_jobs'),
        ['job-123'],
      );
      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('UPDATE test_jobs'),
        ['job-123'],
      );
    });

    it('should throw error when retrying beyond max attempts', async () => {
      const now = new Date().toISOString();
      const failedJob = {
        id: 'job-123',
        type: 'test-job',
        data: JSON.stringify({}),
        status: 'failed',
        priority: 2,
        attempts: 3,
        max_attempts: 3,
        error: 'Previous error',
        created_at: now,
        scheduled_at: now,
      };

      mockQuery.mockResolvedValueOnce({ rows: [failedJob], rowCount: 1 });

      await expect(queue.retry('job-123')).rejects.toThrow(
        'exceeded maximum attempts',
      );
    });

    it('should cancel a job', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await queue.cancel('job-123');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE test_jobs'),
        expect.arrayContaining(['job-123']),
      );
    });
  });

  describe('Job Retrieval', () => {
    it('should get job by ID', async () => {
      const now = new Date().toISOString();
      const mockRow = {
        id: 'job-123',
        type: 'test-job',
        data: JSON.stringify({ message: 'Hello' }),
        status: 'queued',
        priority: 2,
        attempts: 0,
        max_attempts: 3,
        created_at: now,
        scheduled_at: now,
        timeout: 300000,
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockRow], rowCount: 1 });

      const job = await queue.getJob('job-123');

      expect(job).not.toBeNull();
      expect(job?.id).toBe('job-123');
      expect(job?.type).toBe('test-job');
    });

    it('should return null for non-existent job', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const job = await queue.getJob('non-existent');

      expect(job).toBeNull();
    });

    it('should get jobs by status', async () => {
      const now = new Date().toISOString();
      const mockRows = [
        {
          id: 'job-1',
          type: 'test-job',
          data: JSON.stringify({}),
          status: 'queued',
          priority: 2,
          attempts: 0,
          max_attempts: 3,
          created_at: now,
          scheduled_at: now,
        },
        {
          id: 'job-2',
          type: 'test-job',
          data: JSON.stringify({}),
          status: 'queued',
          priority: 2,
          attempts: 0,
          max_attempts: 3,
          created_at: now,
          scheduled_at: now,
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockRows, rowCount: 2 });

      const jobs = await queue.getJobsByStatus('queued');

      expect(jobs).toHaveLength(2);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE status = $1'),
        expect.arrayContaining(['queued', 100]),
      );
    });
  });

  describe('Job Cleanup', () => {
    it('should clean up old completed jobs', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 5 });

      const olderThan = new Date('2024-01-01');
      const count = await queue.cleanup(olderThan);

      expect(count).toBe(5);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM test_jobs'),
        expect.arrayContaining([olderThan]),
      );
    });

    it('should only clean up completed and failed jobs', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 3 });

      const olderThan = new Date();
      await queue.cleanup(olderThan);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("status IN ('completed', 'failed')"),
        expect.any(Array),
      );
    });
  });

  describe('Queue Lifecycle', () => {
    it('should initialize with table creation', async () => {
      // Create a new queue to test initialization
      const newQueue = new PostgresJobQueue({
        connectionString: 'postgresql://test',
        tableName: 'test_jobs',
      });

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      await newQueue.initialize();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS'),
      );
    });

    it('should close the queue', async () => {
      mockEnd.mockResolvedValueOnce(undefined);

      await queue.close();

      expect(mockEnd).toHaveBeenCalled();
    });
  });
});

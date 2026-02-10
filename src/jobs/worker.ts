/**
 * Job Worker - processes jobs from the queue
 */

import type { Job, JobQueue, JobHandler, WorkerConfig } from './types.js';

export class JobWorker {
  private queue: JobQueue;
  private handlers: Map<string, JobHandler> = new Map();
  private running = false;
  private activeJobs = 0;
  private concurrency: number;
  private retryBackoff: 'fixed' | 'exponential';
  private retryDelay: number;
  private maxRetryDelay: number;
  private pollInterval: NodeJS.Timeout | null = null;

  constructor(config: WorkerConfig) {
    this.queue = config.queue;
    this.concurrency = config.concurrency || 1;
    this.retryBackoff = config.retryBackoff || 'exponential';
    this.retryDelay = config.retryDelay || 1000;
    this.maxRetryDelay = config.maxRetryDelay || 60000;
  }

  /**
   * Register a job handler
   */
  registerHandler<T = unknown, R = unknown>(
    jobType: string,
    handler: JobHandler<T, R>,
  ): void {
    this.handlers.set(jobType, handler as JobHandler);
  }

  /**
   * Start processing jobs
   */
  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.poll();
  }

  /**
   * Stop processing jobs (graceful shutdown)
   */
  async stop(): Promise<void> {
    this.running = false;

    if (this.pollInterval) {
      clearTimeout(this.pollInterval);
      this.pollInterval = null;
    }

    // Wait for active jobs to complete
    while (this.activeJobs > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * Poll for new jobs
   */
  private poll(): void {
    if (!this.running) {
      return;
    }

    this.pollInterval = setTimeout(async () => {
      if (this.activeJobs < this.concurrency) {
        await this.processNextJob();
      }

      this.poll();
    }, 100);
  }

  /**
   * Process the next available job
   */
  private async processNextJob(): Promise<void> {
    try {
      const job = await this.queue.dequeue();

      if (!job) {
        return;
      }

      this.activeJobs++;

      // Process job asynchronously
      this.processJob(job).finally(() => {
        this.activeJobs--;
      });
    } catch (error) {
      console.error('[Worker] Error dequeuing job:', error);
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: Job): Promise<void> {
    const handler = this.handlers.get(job.type);

    if (!handler) {
      await this.queue.fail(job.id, `No handler registered for job type: ${job.type}`);
      return;
    }

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(handler, job);
      await this.queue.complete(job.id, result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Attempt retry if within limits
      if (job.attempts + 1 < job.max_attempts) {
        await this.queue.fail(job.id, errorMessage);
        await this.retryWithBackoff(job);
      } else {
        await this.queue.fail(job.id, `${errorMessage} (max attempts reached)`);
      }
    }
  }

  /**
   * Execute handler with timeout
   */
  private async executeWithTimeout(handler: JobHandler, job: Job): Promise<unknown> {
    const timeout = job.timeout || 300000;

    return Promise.race([
      handler(job.data, job),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Job timeout')), timeout),
      ),
    ]);
  }

  /**
   * Retry job with backoff
   */
  private async retryWithBackoff(job: Job): Promise<void> {
    let delay = this.retryDelay;

    if (this.retryBackoff === 'exponential') {
      delay = Math.min(
        this.retryDelay * Math.pow(2, job.attempts),
        this.maxRetryDelay,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, delay));
    await this.queue.retry(job.id);
  }

  /**
   * Get worker stats
   */
  getStats(): { running: boolean; activeJobs: number; concurrency: number } {
    return {
      running: this.running,
      activeJobs: this.activeJobs,
      concurrency: this.concurrency,
    };
  }
}

/**
 * Job Scheduler - schedules recurring jobs based on cron expressions
 */

import type { JobQueue, ScheduledJob } from './types.js';
import { CronParser } from './cron.js';

export class JobScheduler {
  private scheduledJobs: Map<string, ScheduledJob> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private running = false;

  constructor(private queue: JobQueue) {}

  /**
   * Register a scheduled job
   */
  registerJob(job: ScheduledJob): void {
    this.scheduledJobs.set(job.name, job);

    if (this.running) {
      this.scheduleJob(job);
    }
  }

  /**
   * Unregister a scheduled job
   */
  unregisterJob(name: string): void {
    this.scheduledJobs.delete(name);

    const timer = this.timers.get(name);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(name);
    }
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;

    for (const job of this.scheduledJobs.values()) {
      if (job.enabled) {
        this.scheduleJob(job);
      }
    }
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    this.running = false;

    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }

    this.timers.clear();
  }

  /**
   * Schedule a single job
   */
  private scheduleJob(job: ScheduledJob): void {
    const parser = new CronParser(job.cron);
    const nextRun = parser.getNextExecution();
    const delay = nextRun.getTime() - Date.now();

    const timer = setTimeout(async () => {
      await this.executeJob(job);

      // Reschedule for next execution
      if (this.running && this.scheduledJobs.has(job.name)) {
        this.scheduleJob(job);
      }
    }, delay);

    this.timers.set(job.name, timer);
  }

  /**
   * Execute a scheduled job
   */
  private async executeJob(job: ScheduledJob): Promise<void> {
    try {
      const data = job.dataGenerator ? job.dataGenerator() : {};

      await this.queue.enqueue(job.jobType, data, {
        priority: job.priority || 'normal',
      });
    } catch (error) {
      console.error(`[Scheduler] Error executing job ${job.name}:`, error);
    }
  }

  /**
   * Get all registered jobs
   */
  getJobs(): ScheduledJob[] {
    return Array.from(this.scheduledJobs.values());
  }
}

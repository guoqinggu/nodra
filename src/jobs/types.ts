/**
 * Background Jobs - Type definitions
 */

/**
 * Job status
 */
export type JobStatus = 'queued' | 'active' | 'completed' | 'failed' | 'cancelled';

/**
 * Job priority (higher number = higher priority)
 */
export type JobPriority = 'low' | 'normal' | 'high' | 'critical';

export const JOB_PRIORITY_VALUES: Record<JobPriority, number> = {
  low: 1,
  normal: 2,
  high: 3,
  critical: 4,
};

/**
 * Job definition
 */
export interface Job<T = unknown> {
  /** Job ID */
  id: string;

  /** Job type/name */
  type: string;

  /** Job payload data */
  data: T;

  /** Job status */
  status: JobStatus;

  /** Job priority */
  priority: JobPriority;

  /** Number of attempts made */
  attempts: number;

  /** Maximum number of attempts */
  max_attempts: number;

  /** Error message if failed */
  error?: string;

  /** When the job was created */
  created_at: Date;

  /** When the job was scheduled to run */
  scheduled_at: Date;

  /** When the job started processing */
  started_at?: Date;

  /** When the job completed */
  completed_at?: Date;

  /** Job timeout in milliseconds */
  timeout?: number;

  /** Job result data */
  result?: unknown;
}

/**
 * Job handler function
 */
export type JobHandler<T = unknown, R = unknown> = (data: T, job: Job<T>) => Promise<R>;

/**
 * Job queue configuration
 */
export interface JobQueueConfig {
  /** Database connection */
  connectionString: string;

  /** Table name for jobs */
  tableName?: string;

  /** Default job timeout in ms */
  defaultTimeout?: number;

  /** Default max attempts */
  defaultMaxAttempts?: number;

  /** Poll interval for new jobs in ms */
  pollInterval?: number;

  /** Maximum number of concurrent workers */
  maxConcurrency?: number;
}

/**
 * Scheduled job definition
 */
export interface ScheduledJob {
  /** Job name */
  name: string;

  /** Cron expression */
  cron: string;

  /** Job type to enqueue */
  jobType: string;

  /** Job data generator */
  dataGenerator?: () => unknown;

  /** Job priority */
  priority?: JobPriority;

  /** Is this schedule enabled? */
  enabled: boolean;

  /** Timezone for cron schedule */
  timezone?: string;
}

/**
 * Worker configuration
 */
export interface WorkerConfig {
  /** Job queue instance */
  queue: JobQueue;

  /** Number of concurrent jobs */
  concurrency?: number;

  /** Retry backoff strategy */
  retryBackoff?: 'fixed' | 'exponential';

  /** Retry delay in ms (for fixed backoff) */
  retryDelay?: number;

  /** Maximum retry delay in ms (for exponential backoff) */
  maxRetryDelay?: number;
}

/**
 * Cron schedule
 */
export interface CronSchedule {
  /** Minute (0-59) */
  minute: string;

  /** Hour (0-23) */
  hour: string;

  /** Day of month (1-31) */
  dayOfMonth: string;

  /** Month (1-12) */
  month: string;

  /** Day of week (0-6, Sunday = 0) */
  dayOfWeek: string;
}

/**
 * Job queue interface
 */
export interface JobQueue {
  /** Add a job to the queue */
  enqueue<T = unknown>(
    type: string,
    data: T,
    options?: {
      priority?: JobPriority;
      scheduledAt?: Date;
      maxAttempts?: number;
      timeout?: number;
    },
  ): Promise<Job<T>>;

  /** Dequeue next available job */
  dequeue(): Promise<Job | null>;

  /** Mark job as completed */
  complete(jobId: string, result?: unknown): Promise<void>;

  /** Mark job as failed */
  fail(jobId: string, error: string): Promise<void>;

  /** Retry a failed job */
  retry(jobId: string): Promise<void>;

  /** Cancel a job */
  cancel(jobId: string): Promise<void>;

  /** Get job by ID */
  getJob(jobId: string): Promise<Job | null>;

  /** Get jobs by status */
  getJobsByStatus(status: JobStatus, limit?: number): Promise<Job[]>;

  /** Clean up old completed/failed jobs */
  cleanup(olderThan: Date): Promise<number>;

  /** Close the queue */
  close(): Promise<void>;
}

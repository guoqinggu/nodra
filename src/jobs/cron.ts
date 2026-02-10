/**
 * Cron Expression Parser
 */

import type { CronSchedule } from './types.js';

export class CronParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CronParseError';
  }
}

/**
 * Parse cron expression (minute hour day month dayOfWeek)
 */
export function parseCronExpression(expression: string): CronSchedule {
  const parts = expression.trim().split(/\s+/);

  if (parts.length !== 5) {
    throw new CronParseError(
      `Invalid cron expression: expected 5 fields, got ${parts.length}`,
    );
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  if (!minute || !hour || !dayOfMonth || !month || !dayOfWeek) {
    throw new CronParseError('Invalid cron expression: missing fields');
  }

  // Validate each field
  validateCronField(minute, 0, 59, 'minute');
  validateCronField(hour, 0, 23, 'hour');
  validateCronField(dayOfMonth, 1, 31, 'day of month');
  validateCronField(month, 1, 12, 'month');
  validateCronField(dayOfWeek, 0, 6, 'day of week');

  return {
    minute,
    hour,
    dayOfMonth,
    month,
    dayOfWeek,
  };
}

/**
 * Check if a date/time matches a cron schedule
 */
export function isCronTimeMatch(cron: CronSchedule, date: Date): boolean {
  return (
    matchField(cron.minute, date.getMinutes()) &&
    matchField(cron.hour, date.getHours()) &&
    matchField(cron.dayOfMonth, date.getDate()) &&
    matchField(cron.month, date.getMonth() + 1) && // JS months are 0-indexed
    matchField(cron.dayOfWeek, date.getDay())
  );
}

/**
 * Validate a cron field
 */
function validateCronField(
  field: string,
  min: number,
  max: number,
  name: string,
): void {
  // Wildcard is always valid
  if (field === '*') {
    return;
  }

  // Step values: */5
  if (field.includes('/')) {
    const [range, step] = field.split('/');
    if (!range || !step) {
      throw new CronParseError(`Invalid ${name} step format: ${field}`);
    }
    if (range !== '*' && !isValidRange(range, min, max)) {
      throw new CronParseError(`Invalid ${name} range: ${range}`);
    }
    const stepNum = parseInt(step, 10);
    if (isNaN(stepNum) || stepNum < 1 || stepNum > max) {
      throw new CronParseError(`Invalid ${name} step value: ${step}`);
    }
    return;
  }

  // Ranges: 1-5
  if (field.includes('-')) {
    if (!isValidRange(field, min, max)) {
      throw new CronParseError(`Invalid ${name} range: ${field}`);
    }
    return;
  }

  // Lists: 1,2,3
  if (field.includes(',')) {
    const values = field.split(',');
    for (const value of values) {
      const num = parseInt(value, 10);
      if (isNaN(num) || num < min || num > max) {
        throw new CronParseError(`Invalid ${name} value: ${value}`);
      }
    }
    return;
  }

  // Single value
  const num = parseInt(field, 10);
  if (isNaN(num) || num < min || num > max) {
    throw new CronParseError(`Invalid ${name} value: ${field}`);
  }
}

/**
 * Check if a range is valid
 */
function isValidRange(range: string, min: number, max: number): boolean {
  const parts = range.split('-');
  if (parts.length !== 2) {
    return false;
  }
  const [start, end] = parts;
  if (!start || !end) {
    return false;
  }
  const startNum = parseInt(start, 10);
  const endNum = parseInt(end, 10);

  return (
    !isNaN(startNum) &&
    !isNaN(endNum) &&
    startNum >= min &&
    startNum <= max &&
    endNum >= min &&
    endNum <= max &&
    startNum <= endNum
  );
}

/**
 * Check if a value matches a cron field
 */
function matchField(field: string, value: number): boolean {
  // Wildcard matches everything
  if (field === '*') {
    return true;
  }

  // Step values: */5
  if (field.includes('/')) {
    const parts = field.split('/');
    if (parts.length !== 2) {
      return false;
    }
    const [range, step] = parts;
    if (!range || !step) {
      return false;
    }
    const stepNum = parseInt(step, 10);

    if (range === '*') {
      return value % stepNum === 0;
    }

    // Range with step: 10-20/2
    if (range.includes('-')) {
      const rangeParts = range.split('-');
      if (rangeParts.length !== 2) {
        return false;
      }
      const [start, end] = rangeParts;
      if (!start || !end) {
        return false;
      }
      const startNum = parseInt(start, 10);
      const endNum = parseInt(end, 10);
      if (isNaN(startNum) || isNaN(endNum)) {
        return false;
      }
      if (value < startNum || value > endNum) {
        return false;
      }
      return (value - startNum) % stepNum === 0;
    }

    return false;
  }

  // Ranges: 1-5
  if (field.includes('-')) {
    const parts = field.split('-');
    if (parts.length !== 2) {
      return false;
    }
    const [start, end] = parts;
    if (!start || !end) {
      return false;
    }
    const startNum = parseInt(start, 10);
    const endNum = parseInt(end, 10);
    if (isNaN(startNum) || isNaN(endNum)) {
      return false;
    }
    return value >= startNum && value <= endNum;
  }

  // Lists: 1,2,3
  if (field.includes(',')) {
    const values = field.split(',').map((s) => parseInt(s, 10));
    return values.includes(value);
  }

  // Single value
  return parseInt(field, 10) === value;
}

/**
 * Cron Parser class (stateful API)
 */
export class CronParser {
  private schedule: CronSchedule;

  constructor(expression: string) {
    this.schedule = parseCronExpression(expression);
  }

  /**
   * Check if a date matches this cron schedule
   */
  matches(date: Date): boolean {
    return isCronTimeMatch(this.schedule, date);
  }

  /**
   * Get the next execution time after the given date
   */
  getNextExecution(after: Date = new Date()): Date {
    const next = new Date(after.getTime());
    next.setSeconds(0, 0); // Reset seconds and milliseconds

    // Start from next minute
    next.setMinutes(next.getMinutes() + 1);

    // Search for next matching time (max 4 years ahead to avoid infinite loop)
    const maxIterations = 4 * 365 * 24 * 60; // 4 years in minutes
    let iterations = 0;

    while (iterations < maxIterations) {
      if (this.matches(next)) {
        return next;
      }
      next.setMinutes(next.getMinutes() + 1);
      iterations++;
    }

    throw new Error('Could not find next execution time');
  }

  /**
   * Get the schedule object
   */
  getSchedule(): CronSchedule {
    return { ...this.schedule };
  }
}

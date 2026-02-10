import { describe, it, expect } from 'vitest';
import { CronParser, parseCronExpression, isCronTimeMatch } from '../../../src/jobs/cron.js';

describe('CronParser', () => {
  describe('Cron Expression Parsing', () => {
    it('should parse standard 5-field cron expression', () => {
      const cron = parseCronExpression('0 12 * * *');

      expect(cron.minute).toBe('0');
      expect(cron.hour).toBe('12');
      expect(cron.dayOfMonth).toBe('*');
      expect(cron.month).toBe('*');
      expect(cron.dayOfWeek).toBe('*');
    });

    it('should parse cron with ranges', () => {
      const cron = parseCronExpression('0-30 9-17 * * 1-5');

      expect(cron.minute).toBe('0-30');
      expect(cron.hour).toBe('9-17');
      expect(cron.dayOfWeek).toBe('1-5');
    });

    it('should parse cron with lists', () => {
      const cron = parseCronExpression('0,15,30,45 * * * *');

      expect(cron.minute).toBe('0,15,30,45');
    });

    it('should parse cron with step values', () => {
      const cron = parseCronExpression('*/5 * * * *');

      expect(cron.minute).toBe('*/5');
    });

    it('should throw error for invalid cron expression', () => {
      expect(() => parseCronExpression('invalid')).toThrow('Invalid cron');
    });

    it('should throw error for too many fields', () => {
      expect(() => parseCronExpression('0 0 0 0 0 0')).toThrow('Invalid cron');
    });
  });

  describe('Time Matching', () => {
    it('should match exact minute', () => {
      const cron = parseCronExpression('30 * * * *');
      const date = new Date('2024-01-01T10:30:00');

      expect(isCronTimeMatch(cron, date)).toBe(true);
    });

    it('should not match different minute', () => {
      const cron = parseCronExpression('30 * * * *');
      const date = new Date('2024-01-01T10:31:00');

      expect(isCronTimeMatch(cron, date)).toBe(false);
    });

    it('should match exact hour', () => {
      const cron = parseCronExpression('0 14 * * *');
      const date = new Date('2024-01-01T14:00:00');

      expect(isCronTimeMatch(cron, date)).toBe(true);
    });

    it('should match wildcard', () => {
      const cron = parseCronExpression('* * * * *');
      const date = new Date();

      expect(isCronTimeMatch(cron, date)).toBe(true);
    });

    it('should match minute range', () => {
      const cron = parseCronExpression('15-45 * * * *');
      const date1 = new Date('2024-01-01T10:30:00');
      const date2 = new Date('2024-01-01T10:10:00');
      const date3 = new Date('2024-01-01T10:50:00');

      expect(isCronTimeMatch(cron, date1)).toBe(true);
      expect(isCronTimeMatch(cron, date2)).toBe(false);
      expect(isCronTimeMatch(cron, date3)).toBe(false);
    });

    it('should match hour range', () => {
      const cron = parseCronExpression('0 9-17 * * *');
      const date1 = new Date('2024-01-01T12:00:00');
      const date2 = new Date('2024-01-01T08:00:00');
      const date3 = new Date('2024-01-01T18:00:00');

      expect(isCronTimeMatch(cron, date1)).toBe(true);
      expect(isCronTimeMatch(cron, date2)).toBe(false);
      expect(isCronTimeMatch(cron, date3)).toBe(false);
    });

    it('should match minute list', () => {
      const cron = parseCronExpression('0,15,30,45 * * * *');
      const date1 = new Date('2024-01-01T10:15:00');
      const date2 = new Date('2024-01-01T10:30:00');
      const date3 = new Date('2024-01-01T10:20:00');

      expect(isCronTimeMatch(cron, date1)).toBe(true);
      expect(isCronTimeMatch(cron, date2)).toBe(true);
      expect(isCronTimeMatch(cron, date3)).toBe(false);
    });

    it('should match step values', () => {
      const cron = parseCronExpression('*/15 * * * *');
      const date1 = new Date('2024-01-01T10:00:00');
      const date2 = new Date('2024-01-01T10:15:00');
      const date3 = new Date('2024-01-01T10:30:00');
      const date4 = new Date('2024-01-01T10:10:00');

      expect(isCronTimeMatch(cron, date1)).toBe(true);
      expect(isCronTimeMatch(cron, date2)).toBe(true);
      expect(isCronTimeMatch(cron, date3)).toBe(true);
      expect(isCronTimeMatch(cron, date4)).toBe(false);
    });

    it('should match day of month', () => {
      const cron = parseCronExpression('0 0 15 * *');
      const date1 = new Date('2024-01-15T00:00:00');
      const date2 = new Date('2024-01-16T00:00:00');

      expect(isCronTimeMatch(cron, date1)).toBe(true);
      expect(isCronTimeMatch(cron, date2)).toBe(false);
    });

    it('should match month', () => {
      const cron = parseCronExpression('0 0 1 6 *');
      const date1 = new Date('2024-06-01T00:00:00');
      const date2 = new Date('2024-07-01T00:00:00');

      expect(isCronTimeMatch(cron, date1)).toBe(true);
      expect(isCronTimeMatch(cron, date2)).toBe(false);
    });

    it('should match day of week (0 = Sunday)', () => {
      const cron = parseCronExpression('0 0 * * 0');
      const sunday = new Date('2024-01-07T00:00:00'); // Sunday
      const monday = new Date('2024-01-08T00:00:00'); // Monday

      expect(isCronTimeMatch(cron, sunday)).toBe(true);
      expect(isCronTimeMatch(cron, monday)).toBe(false);
    });

    it('should match weekdays (1-5)', () => {
      const cron = parseCronExpression('0 9 * * 1-5');
      const monday = new Date('2024-01-08T09:00:00'); // Monday
      const friday = new Date('2024-01-12T09:00:00'); // Friday
      const saturday = new Date('2024-01-13T09:00:00'); // Saturday

      expect(isCronTimeMatch(cron, monday)).toBe(true);
      expect(isCronTimeMatch(cron, friday)).toBe(true);
      expect(isCronTimeMatch(cron, saturday)).toBe(false);
    });

    it('should match complex expression', () => {
      const cron = parseCronExpression('*/5 9-17 * * 1-5');
      const weekdayInRange = new Date('2024-01-08T10:15:00'); // Monday 10:15
      const weekdayOutRange = new Date('2024-01-08T08:15:00'); // Monday 08:15
      const weekend = new Date('2024-01-13T10:15:00'); // Saturday 10:15

      expect(isCronTimeMatch(cron, weekdayInRange)).toBe(true);
      expect(isCronTimeMatch(cron, weekdayOutRange)).toBe(false);
      expect(isCronTimeMatch(cron, weekend)).toBe(false);
    });
  });

  describe('Special Cases', () => {
    it('should handle end of month correctly', () => {
      const cron = parseCronExpression('0 0 31 * *');
      const date1 = new Date('2024-01-31T00:00:00'); // January has 31 days
      const date2 = new Date('2024-02-29T00:00:00'); // February doesn't

      expect(isCronTimeMatch(cron, date1)).toBe(true);
      expect(isCronTimeMatch(cron, date2)).toBe(false);
    });

    it('should handle leap year correctly', () => {
      const cron = parseCronExpression('0 0 29 2 *');
      const leapYear = new Date('2024-02-29T00:00:00');
      const regularYear = new Date('2023-02-28T00:00:00');

      expect(isCronTimeMatch(cron, leapYear)).toBe(true);
    });
  });
});

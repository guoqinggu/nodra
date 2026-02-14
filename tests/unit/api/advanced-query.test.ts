import { describe, it, expect, vi } from 'vitest';
import { convertToCSV } from '../../../src/api/advanced-query.js';

describe('Advanced Query', () => {
  describe('convertToCSV', () => {
    it('should convert array to CSV string', () => {
      const data = [
        { name: 'Task 1', status: 'Open' },
        { name: 'Task 2', status: 'Closed' },
      ];
      const csv = convertToCSV(data);
      expect(csv).toContain('name');
      expect(csv).toContain('status');
      expect(csv).toContain('Task 1');
      expect(csv).toContain('Task 2');
    });

    it('should handle empty array', () => {
      const csv = convertToCSV([]);
      expect(csv).toBe('');
    });
  });
});

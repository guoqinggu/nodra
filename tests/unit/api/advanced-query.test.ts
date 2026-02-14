import { describe, it, expect } from 'vitest';
import { convertToCSV } from '../../../src/api/advanced-query.js';

describe('Advanced Query', () => {
  describe('convertToCSV', () => {
    it('should convert array to CSV string', () => {
      const data = [
        { name: 'Task 1', status: 'Open' },
        { name: 'Task 2', status: 'Closed' },
      ];
      const csv = convertToCSV(data);
      expect(csv).toContain('name,status');
      expect(csv).toContain('Task 1,Open');
      expect(csv).toContain('Task 2,Closed');
    });

    it('should handle empty array', () => {
      const csv = convertToCSV([]);
      expect(csv).toBe('');
    });

    it('should escape commas in values', () => {
      const data = [{ name: 'Task, 1', status: 'Open' }];
      const csv = convertToCSV(data);
      expect(csv).toContain('"Task, 1"');
    });

    it('should escape quotes in values', () => {
      const data = [{ name: 'Task "1"', status: 'Open' }];
      const csv = convertToCSV(data);
      expect(csv).toContain('"Task ""1"""');
    });

    it('should handle null and undefined values', () => {
      const data = [{ name: 'Task 1', status: null as unknown, notes: undefined }];
      const csv = convertToCSV(data);
      expect(csv).toContain('Task 1');
    });

    it('should handle numeric values', () => {
      const data = [{ name: 'Task 1', amount: 100 }];
      const csv = convertToCSV(data);
      expect(csv).toContain('amount');
      expect(csv).toContain('100');
    });

    it('should preserve header order', () => {
      const data = [{ z_field: '1', a_field: '2' }];
      const csv = convertToCSV(data);
      const firstLine = csv.split('\n')[0];
      expect(firstLine).toBe('z_field,a_field');
    });
  });
});

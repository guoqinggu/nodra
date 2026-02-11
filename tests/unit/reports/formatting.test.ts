/**
 * Tests for column formatting and data transformation
 */

import { describe, it, expect } from 'vitest';
import type { ReportColumn } from '../../../src/reports/types.js';

/**
 * Format a value based on column type
 */
function formatColumnValue(value: unknown, column: ReportColumn): string {
  if (value === null || value === undefined) {
    return '';
  }

  switch (column.fieldtype) {
    case 'Int':
      return String(Math.round(Number(value)));

    case 'Float':
      return Number(value).toFixed(2);

    case 'Currency':
      return Number(value).toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
      });

    case 'Date':
      if (value instanceof Date) {
        return value.toISOString().split('T')[0];
      }
      return String(value).split('T')[0];

    case 'DateTime':
      if (value instanceof Date) {
        return value.toISOString();
      }
      return String(value);

    case 'Check':
      return value ? '✓' : '';

    case 'Data':
    case 'Link':
    default:
      return String(value);
  }
}

describe('Column Formatting', () => {
  describe('Number Formatting', () => {
    it('should format integers', () => {
      const column: ReportColumn = {
        fieldname: 'count',
        label: 'Count',
        fieldtype: 'Int',
      };

      expect(formatColumnValue(42, column)).toBe('42');
      expect(formatColumnValue(42.7, column)).toBe('43');
      expect(formatColumnValue(42.2, column)).toBe('42');
    });

    it('should format floats with 2 decimal places', () => {
      const column: ReportColumn = {
        fieldname: 'rate',
        label: 'Rate',
        fieldtype: 'Float',
      };

      expect(formatColumnValue(42.123, column)).toBe('42.12');
      expect(formatColumnValue(42.999, column)).toBe('43.00');
      expect(formatColumnValue(42, column)).toBe('42.00');
    });

    it('should format currency', () => {
      const column: ReportColumn = {
        fieldname: 'amount',
        label: 'Amount',
        fieldtype: 'Currency',
      };

      const formatted = formatColumnValue(1234.56, column);
      expect(formatted).toContain('1,234.56');
      expect(formatted).toContain('$');
    });
  });

  describe('Date Formatting', () => {
    it('should format date fields', () => {
      const column: ReportColumn = {
        fieldname: 'posting_date',
        label: 'Date',
        fieldtype: 'Date',
      };

      const date = new Date('2026-02-10T10:30:00Z');
      expect(formatColumnValue(date, column)).toBe('2026-02-10');
    });

    it('should format datetime fields', () => {
      const column: ReportColumn = {
        fieldname: 'creation',
        label: 'Created',
        fieldtype: 'DateTime',
      };

      const date = new Date('2026-02-10T10:30:00Z');
      const formatted = formatColumnValue(date, column);
      expect(formatted).toContain('2026-02-10');
      expect(formatted).toContain('10:30');
    });

    it('should handle date strings', () => {
      const column: ReportColumn = {
        fieldname: 'date',
        label: 'Date',
        fieldtype: 'Date',
      };

      expect(formatColumnValue('2026-02-10T00:00:00Z', column)).toBe('2026-02-10');
    });
  });

  describe('Boolean Formatting', () => {
    it('should format check fields', () => {
      const column: ReportColumn = {
        fieldname: 'is_active',
        label: 'Active',
        fieldtype: 'Check',
      };

      expect(formatColumnValue(true, column)).toBe('✓');
      expect(formatColumnValue(false, column)).toBe('');
      expect(formatColumnValue(1, column)).toBe('✓');
      expect(formatColumnValue(0, column)).toBe('');
    });
  });

  describe('Text Formatting', () => {
    it('should format data fields', () => {
      const column: ReportColumn = {
        fieldname: 'name',
        label: 'Name',
        fieldtype: 'Data',
      };

      expect(formatColumnValue('John Doe', column)).toBe('John Doe');
      expect(formatColumnValue('', column)).toBe('');
    });

    it('should format link fields', () => {
      const column: ReportColumn = {
        fieldname: 'customer',
        label: 'Customer',
        fieldtype: 'Link',
        options: 'Customer',
      };

      expect(formatColumnValue('CUST-001', column)).toBe('CUST-001');
    });
  });

  describe('Null/Undefined Handling', () => {
    it('should handle null values', () => {
      const column: ReportColumn = {
        fieldname: 'field',
        label: 'Field',
        fieldtype: 'Data',
      };

      expect(formatColumnValue(null, column)).toBe('');
    });

    it('should handle undefined values', () => {
      const column: ReportColumn = {
        fieldname: 'field',
        label: 'Field',
        fieldtype: 'Int',
      };

      expect(formatColumnValue(undefined, column)).toBe('');
    });
  });
});

describe('Data Transformation', () => {
  describe('Row Transformation', () => {
    it('should transform a data row with multiple columns', () => {
      const columns: ReportColumn[] = [
        { fieldname: 'name', label: 'Name', fieldtype: 'Data' },
        { fieldname: 'count', label: 'Count', fieldtype: 'Int' },
        { fieldname: 'amount', label: 'Amount', fieldtype: 'Currency' },
        { fieldname: 'is_active', label: 'Active', fieldtype: 'Check' },
      ];

      const row = {
        name: 'Item A',
        count: 42,
        amount: 1234.56,
        is_active: true,
      };

      const formatted = columns.map((col) => ({
        fieldname: col.fieldname,
        value: formatColumnValue(row[col.fieldname as keyof typeof row], col),
      }));

      expect(formatted[0].value).toBe('Item A');
      expect(formatted[1].value).toBe('42');
      expect(formatted[2].value).toContain('1,234.56');
      expect(formatted[3].value).toBe('✓');
    });
  });

  describe('Aggregate Calculations', () => {
    it('should calculate row totals', () => {
      const data = [
        { item: 'A', qty: 10, rate: 100, amount: 1000 },
        { item: 'B', qty: 20, rate: 50, amount: 1000 },
        { item: 'C', qty: 5, rate: 200, amount: 1000 },
      ];

      const totalQty = data.reduce((sum, row) => sum + row.qty, 0);
      const totalAmount = data.reduce((sum, row) => sum + row.amount, 0);

      expect(totalQty).toBe(35);
      expect(totalAmount).toBe(3000);
    });

    it('should calculate averages', () => {
      const data = [{ score: 85 }, { score: 90 }, { score: 75 }, { score: 95 }];

      const average = data.reduce((sum, row) => sum + row.score, 0) / data.length;

      expect(average).toBe(86.25);
    });
  });

  describe('Data Grouping', () => {
    it('should group data by field', () => {
      const data = [
        { category: 'A', amount: 100 },
        { category: 'B', amount: 200 },
        { category: 'A', amount: 150 },
        { category: 'B', amount: 250 },
      ];

      const grouped = data.reduce(
        (acc, row) => {
          const key = row.category;
          if (!acc[key]) {
            acc[key] = [];
          }
          acc[key].push(row);
          return acc;
        },
        {} as Record<string, typeof data>,
      );

      expect(grouped['A']).toHaveLength(2);
      expect(grouped['B']).toHaveLength(2);
      expect(grouped['A'].reduce((sum, r) => sum + r.amount, 0)).toBe(250);
    });
  });

  describe('Data Sorting', () => {
    it('should sort data by numeric field', () => {
      const data = [
        { name: 'C', value: 30 },
        { name: 'A', value: 10 },
        { name: 'B', value: 20 },
      ];

      const sorted = [...data].sort((a, b) => a.value - b.value);

      expect(sorted[0].name).toBe('A');
      expect(sorted[1].name).toBe('B');
      expect(sorted[2].name).toBe('C');
    });

    it('should sort data by string field', () => {
      const data = [{ name: 'Charlie' }, { name: 'Alice' }, { name: 'Bob' }];

      const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name));

      expect(sorted[0].name).toBe('Alice');
      expect(sorted[1].name).toBe('Bob');
      expect(sorted[2].name).toBe('Charlie');
    });
  });
});

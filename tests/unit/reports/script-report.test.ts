/**
 * Tests for script reports
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Pool } from 'pg';
import type {
  ScriptReportDefinition,
  ScriptReportFunction,
  ReportContext,
  ReportRow,
} from '../../../src/reports/types';

// Mock Pool
const mockPool = {
  query: vi.fn(),
} as unknown as Pool;

describe('Script Report', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Script Report Definition', () => {
    it('should define a script report', () => {
      const report: ScriptReportDefinition = {
        name: 'Custom Sales Analysis',
        type: 'script',
        columns: [
          { fieldname: 'customer', label: 'Customer', fieldtype: 'Link', options: 'Customer' },
          { fieldname: 'total_sales', label: 'Total Sales', fieldtype: 'Currency' },
          { fieldname: 'avg_order_value', label: 'Avg Order Value', fieldtype: 'Currency' },
          { fieldname: 'order_count', label: 'Order Count', fieldtype: 'Int' },
        ],
        filters: [
          { fieldname: 'from_date', label: 'From Date', fieldtype: 'Date', reqd: true },
          { fieldname: 'to_date', label: 'To Date', fieldtype: 'Date', reqd: true },
          { fieldname: 'customer', label: 'Customer', fieldtype: 'Link', options: 'Customer' },
        ],
        description: 'Advanced sales analysis with custom calculations',
      };

      expect(report.type).toBe('script');
      expect(report.columns).toHaveLength(4);
      expect(report.filters).toHaveLength(3);
    });
  });

  describe('Script Report Function', () => {
    it('should execute a simple script function', async () => {
      const scriptFn: ScriptReportFunction = async (filters) => {
        return [
          { name: 'Item A', count: 10 },
          { name: 'Item B', count: 20 },
          { name: 'Item C', count: 15 },
        ];
      };

      const result = await scriptFn({}, mockPool);

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('Item A');
    });

    it('should use filters in script function', async () => {
      const scriptFn: ScriptReportFunction = async (filters) => {
        const status = filters.status as string;
        
        // Simulate filtering based on status
        const allData = [
          { name: 'TODO-001', status: 'Open' },
          { name: 'TODO-002', status: 'Completed' },
          { name: 'TODO-003', status: 'Open' },
        ];

        if (status) {
          return allData.filter((item) => item.status === status);
        }

        return allData;
      };

      const result1 = await scriptFn({ status: 'Open' }, mockPool);
      expect(result1).toHaveLength(2);

      const result2 = await scriptFn({}, mockPool);
      expect(result2).toHaveLength(3);
    });

    it('should query database in script function', async () => {
      const mockData = [
        { customer: 'CUST-001', total: 5000 },
        { customer: 'CUST-002', total: 3000 },
      ];

      vi.mocked(mockPool.query).mockResolvedValue({
        rows: mockData,
        rowCount: 2,
      } as any);

      const scriptFn: ScriptReportFunction = async (filters, pool) => {
        const result = await pool.query(
          'SELECT customer, SUM(amount) as total FROM tab_invoice GROUP BY customer'
        );
        return result.rows as ReportRow[];
      };

      const result = await scriptFn({}, mockPool);

      expect(result).toHaveLength(2);
      expect(result[0].customer).toBe('CUST-001');
      expect(mockPool.query).toHaveBeenCalled();
    });
  });

  describe('Data Processing', () => {
    it('should perform calculations in script', async () => {
      const scriptFn: ScriptReportFunction = async () => {
        const rawData = [
          { item: 'A', qty: 10, rate: 100 },
          { item: 'B', qty: 20, rate: 50 },
          { item: 'C', qty: 5, rate: 200 },
        ];

        return rawData.map((row) => ({
          item: row.item,
          qty: row.qty,
          rate: row.rate,
          amount: row.qty * row.rate,
        }));
      };

      const result = await scriptFn({}, mockPool);

      expect(result[0].amount).toBe(1000);
      expect(result[1].amount).toBe(1000);
      expect(result[2].amount).toBe(1000);
    });

    it('should aggregate data in script', async () => {
      const scriptFn: ScriptReportFunction = async () => {
        const rawData = [
          { category: 'A', amount: 100 },
          { category: 'B', amount: 200 },
          { category: 'A', amount: 150 },
          { category: 'B', amount: 250 },
        ];

        // Group by category and sum
        const grouped = rawData.reduce(
          (acc, row) => {
            const key = row.category;
            if (!acc[key]) {
              acc[key] = { category: key, total: 0, count: 0 };
            }
            acc[key].total += row.amount;
            acc[key].count += 1;
            return acc;
          },
          {} as Record<string, { category: string; total: number; count: number }>
        );

        return Object.values(grouped);
      };

      const result = await scriptFn({}, mockPool);

      expect(result).toHaveLength(2);
      expect(result.find((r) => r.category === 'A')?.total).toBe(250);
      expect(result.find((r) => r.category === 'B')?.total).toBe(450);
    });

    it('should join data from multiple queries', async () => {
      const invoices = [
        { name: 'INV-001', customer: 'CUST-001', amount: 1000 },
        { name: 'INV-002', customer: 'CUST-002', amount: 2000 },
      ];

      const customers = [
        { name: 'CUST-001', customer_name: 'Alice Corp' },
        { name: 'CUST-002', customer_name: 'Bob Industries' },
      ];

      const scriptFn: ScriptReportFunction = async () => {
        // Simulate joining data
        return invoices.map((inv) => {
          const customer = customers.find((c) => c.name === inv.customer);
          return {
            invoice: inv.name,
            customer: inv.customer,
            customer_name: customer?.customer_name ?? '',
            amount: inv.amount,
          };
        });
      };

      const result = await scriptFn({}, mockPool);

      expect(result).toHaveLength(2);
      expect(result[0].customer_name).toBe('Alice Corp');
      expect(result[1].customer_name).toBe('Bob Industries');
    });
  });

  describe('Advanced Processing', () => {
    it('should calculate running totals', async () => {
      const scriptFn: ScriptReportFunction = async () => {
        const data = [
          { month: 'Jan', sales: 1000 },
          { month: 'Feb', sales: 1500 },
          { month: 'Mar', sales: 1200 },
        ];

        let runningTotal = 0;
        return data.map((row) => {
          runningTotal += row.sales;
          return {
            ...row,
            cumulative_sales: runningTotal,
          };
        });
      };

      const result = await scriptFn({}, mockPool);

      expect(result[0].cumulative_sales).toBe(1000);
      expect(result[1].cumulative_sales).toBe(2500);
      expect(result[2].cumulative_sales).toBe(3700);
    });

    it('should calculate percentages', async () => {
      const scriptFn: ScriptReportFunction = async () => {
        const data = [
          { category: 'A', value: 100 },
          { category: 'B', value: 200 },
          { category: 'C', value: 700 },
        ];

        const total = data.reduce((sum, row) => sum + row.value, 0);

        return data.map((row) => ({
          ...row,
          percentage: ((row.value / total) * 100).toFixed(2),
        }));
      };

      const result = await scriptFn({}, mockPool);

      expect(result[0].percentage).toBe('10.00');
      expect(result[1].percentage).toBe('20.00');
      expect(result[2].percentage).toBe('70.00');
    });

    it('should rank data', async () => {
      const scriptFn: ScriptReportFunction = async () => {
        const data = [
          { name: 'Alice', score: 95 },
          { name: 'Bob', score: 87 },
          { name: 'Charlie', score: 92 },
        ];

        // Sort by score descending
        const sorted = [...data].sort((a, b) => b.score - a.score);

        // Add rank
        return sorted.map((row, index) => ({
          rank: index + 1,
          ...row,
        }));
      };

      const result = await scriptFn({}, mockPool);

      expect(result[0].name).toBe('Alice');
      expect(result[0].rank).toBe(1);
      expect(result[1].name).toBe('Charlie');
      expect(result[1].rank).toBe(2);
      expect(result[2].name).toBe('Bob');
      expect(result[2].rank).toBe(3);
    });
  });
});

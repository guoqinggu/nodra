/**
 * Tests for query report definitions and execution
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type {
  QueryReportDefinition,
  ReportColumn,
  ReportFilter,
  ReportContext,
} from '../../../src/reports/types.js';

describe('Query Report Definition', () => {
  describe('Report Structure', () => {
    it('should define a basic query report', () => {
      const report: QueryReportDefinition = {
        name: 'User List',
        type: 'query',
        query: 'SELECT name, email, creation FROM tab_user WHERE docstatus < 2',
        columns: [
          { fieldname: 'name', label: 'Name', fieldtype: 'Data' },
          { fieldname: 'email', label: 'Email', fieldtype: 'Data' },
          { fieldname: 'creation', label: 'Created On', fieldtype: 'DateTime' },
        ],
      };

      expect(report.name).toBe('User List');
      expect(report.type).toBe('query');
      expect(report.columns).toHaveLength(3);
    });

    it('should support report with filters', () => {
      const report: QueryReportDefinition = {
        name: 'Todo Report',
        type: 'query',
        query: `
          SELECT name, status, priority, assigned_to, due_date
          FROM tab_todo
          WHERE docstatus < 2
            AND ($1::text IS NULL OR status = $1)
            AND ($2::text IS NULL OR assigned_to = $2)
          ORDER BY due_date DESC
        `,
        columns: [
          { fieldname: 'name', label: 'ID', fieldtype: 'Link', options: 'Todo' },
          { fieldname: 'status', label: 'Status', fieldtype: 'Data' },
          { fieldname: 'priority', label: 'Priority', fieldtype: 'Data' },
          { fieldname: 'assigned_to', label: 'Assigned To', fieldtype: 'Link', options: 'User' },
          { fieldname: 'due_date', label: 'Due Date', fieldtype: 'Date' },
        ],
        filters: [
          {
            fieldname: 'status',
            label: 'Status',
            fieldtype: 'Select',
            options: 'Open\nWorking\nCompleted\nCancelled',
          },
          {
            fieldname: 'assigned_to',
            label: 'Assigned To',
            fieldtype: 'Link',
            options: 'User',
          },
        ],
      };

      expect(report.filters).toHaveLength(2);
      expect(report.filters?.[0].fieldname).toBe('status');
    });

    it('should support column width specifications', () => {
      const columns: ReportColumn[] = [
        { fieldname: 'name', label: 'ID', fieldtype: 'Data', width: 150 },
        { fieldname: 'description', label: 'Description', fieldtype: 'Data', width: 300 },
        { fieldname: 'amount', label: 'Amount', fieldtype: 'Currency', width: 120 },
      ];

      expect(columns[0].width).toBe(150);
      expect(columns[1].width).toBe(300);
      expect(columns[2].width).toBe(120);
    });
  });

  describe('Report Filters', () => {
    it('should define required filter', () => {
      const filter: ReportFilter = {
        fieldname: 'from_date',
        label: 'From Date',
        fieldtype: 'Date',
        reqd: true,
      };

      expect(filter.reqd).toBe(true);
    });

    it('should define filter with default value', () => {
      const filter: ReportFilter = {
        fieldname: 'status',
        label: 'Status',
        fieldtype: 'Select',
        options: 'Open\nCompleted',
        default: 'Open',
      };

      expect(filter.default).toBe('Open');
    });

    it('should support Link field filter', () => {
      const filter: ReportFilter = {
        fieldname: 'customer',
        label: 'Customer',
        fieldtype: 'Link',
        options: 'Customer',
      };

      expect(filter.fieldtype).toBe('Link');
      expect(filter.options).toBe('Customer');
    });
  });

  describe('Parameterized Queries', () => {
    it('should use positional parameters', () => {
      const query = `
        SELECT name, amount, posting_date
        FROM tab_sales_invoice
        WHERE posting_date BETWEEN $1 AND $2
          AND customer = $3
        ORDER BY posting_date DESC
      `;

      expect(query).toContain('$1');
      expect(query).toContain('$2');
      expect(query).toContain('$3');
    });

    it('should handle optional filters with NULL checks', () => {
      const query = `
        SELECT * FROM tab_todo
        WHERE ($1::text IS NULL OR status = $1)
          AND ($2::text IS NULL OR priority = $2)
      `;

      expect(query).toContain('IS NULL');
      expect(query).toContain('OR status = $1');
    });

    it('should support date range filters', () => {
      const query = `
        SELECT * FROM tab_document
        WHERE creation >= $1 AND creation <= $2
      `;

      expect(query).toContain('>= $1');
      expect(query).toContain('<= $2');
    });
  });

  describe('Report Context', () => {
    it('should create execution context with filters', () => {
      const context: ReportContext = {
        filters: {
          status: 'Open',
          assigned_to: 'user@example.com',
        },
        user: 'admin@example.com',
      };

      expect(context.filters.status).toBe('Open');
      expect(context.user).toBe('admin@example.com');
    });

    it('should handle empty filters', () => {
      const context: ReportContext = {
        filters: {},
      };

      expect(Object.keys(context.filters)).toHaveLength(0);
    });

    it('should support date filters', () => {
      const context: ReportContext = {
        filters: {
          from_date: '2026-01-01',
          to_date: '2026-12-31',
        },
      };

      expect(context.filters.from_date).toBe('2026-01-01');
      expect(context.filters.to_date).toBe('2026-12-31');
    });
  });

  describe('Column Types', () => {
    it('should support various column types', () => {
      const columns: ReportColumn[] = [
        { fieldname: 'name', label: 'Name', fieldtype: 'Data' },
        { fieldname: 'count', label: 'Count', fieldtype: 'Int' },
        { fieldname: 'rate', label: 'Rate', fieldtype: 'Float' },
        { fieldname: 'amount', label: 'Amount', fieldtype: 'Currency' },
        { fieldname: 'date', label: 'Date', fieldtype: 'Date' },
        { fieldname: 'modified', label: 'Modified', fieldtype: 'DateTime' },
        { fieldname: 'customer', label: 'Customer', fieldtype: 'Link', options: 'Customer' },
        { fieldname: 'is_active', label: 'Active', fieldtype: 'Check' },
      ];

      expect(columns).toHaveLength(8);
      expect(columns.find((c) => c.fieldtype === 'Currency')).toBeDefined();
      expect(columns.find((c) => c.fieldtype === 'Link')?.options).toBe('Customer');
    });
  });

  describe('Report Metadata', () => {
    it('should include report description', () => {
      const report: QueryReportDefinition = {
        name: 'Sales Summary',
        type: 'query',
        query: 'SELECT * FROM tab_sales_invoice',
        columns: [],
        description: 'Monthly sales summary report with customer-wise breakdown',
      };

      expect(report.description).toBeDefined();
      expect(report.description).toContain('sales summary');
    });
  });

  describe('Aggregate Reports', () => {
    it('should support aggregate queries', () => {
      const report: QueryReportDefinition = {
        name: 'Todo Status Summary',
        type: 'query',
        query: `
          SELECT 
            status,
            COUNT(*) as count,
            COUNT(*) FILTER (WHERE priority = 'High') as high_priority
          FROM tab_todo
          WHERE docstatus < 2
          GROUP BY status
          ORDER BY count DESC
        `,
        columns: [
          { fieldname: 'status', label: 'Status', fieldtype: 'Data' },
          { fieldname: 'count', label: 'Total Count', fieldtype: 'Int' },
          { fieldname: 'high_priority', label: 'High Priority', fieldtype: 'Int' },
        ],
      };

      expect(report.query).toContain('GROUP BY');
      expect(report.query).toContain('COUNT(*)');
    });

    it('should support JOIN queries', () => {
      const query = `
        SELECT 
          t.name,
          t.status,
          u.full_name as assigned_to_name
        FROM tab_todo t
        LEFT JOIN tab_user u ON t.assigned_to = u.name
        WHERE t.docstatus < 2
      `;

      expect(query).toContain('LEFT JOIN');
      expect(query).toContain('ON');
    });
  });
});

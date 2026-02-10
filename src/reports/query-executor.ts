/**
 * Query report executor
 */

import type { Pool } from 'pg';
import type {
  QueryReportDefinition,
  ReportContext,
  ReportResult,
  ReportRow,
} from './types.js';

/**
 * Query report executor
 */
export class QueryReportExecutor {
  constructor(private pool: Pool) {}

  /**
   * Execute a query report
   */
  async execute(
    report: QueryReportDefinition,
    context: ReportContext
  ): Promise<ReportResult> {
    // Extract filter values in the order they appear in the query
    const filterValues = this.extractFilterValues(report, context);

    // Execute the query
    const result = await this.pool.query(report.query, filterValues);

    return {
      columns: report.columns,
      data: result.rows as ReportRow[],
      total_count: result.rowCount ?? 0,
    };
  }

  /**
   * Extract filter values for parameterized query
   */
  private extractFilterValues(
    report: QueryReportDefinition,
    context: ReportContext
  ): unknown[] {
    if (!report.filters || report.filters.length === 0) {
      return [];
    }

    // Extract values in the order filters are defined
    return report.filters.map((filter) => {
      const value = context.filters[filter.fieldname];
      // Return null for undefined values to work with SQL NULL checks
      return value !== undefined ? value : null;
    });
  }

  /**
   * Validate report definition
   */
  validateReport(report: QueryReportDefinition): void {
    if (!report.name) {
      throw new Error('Report name is required');
    }

    if (!report.query) {
      throw new Error('Report query is required');
    }

    if (!report.columns || report.columns.length === 0) {
      throw new Error('Report must have at least one column');
    }

    // Basic SQL injection check
    const dangerousPatterns = [
      /;\s*drop\s+/i,
      /;\s*delete\s+/i,
      /;\s*truncate\s+/i,
      /;\s*alter\s+/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(report.query)) {
        throw new Error('Query contains potentially dangerous SQL statements');
      }
    }
  }
}

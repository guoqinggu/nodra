/**
 * Script report executor
 */

import type { Pool } from 'pg';
import type {
  ScriptReportDefinition,
  ScriptReportFunction,
  ReportContext,
  ReportResult,
} from './types.js';

/**
 * Script report executor
 */
export class ScriptReportExecutor {
  private scripts = new Map<string, ScriptReportFunction>();

  constructor(private pool: Pool) {}

  /**
   * Register a script report function
   */
  register(reportName: string, scriptFn: ScriptReportFunction): void {
    this.scripts.set(reportName, scriptFn);
  }

  /**
   * Execute a script report
   */
  async execute(
    report: ScriptReportDefinition,
    context: ReportContext
  ): Promise<ReportResult> {
    const scriptFn = this.scripts.get(report.name);

    if (!scriptFn) {
      throw new Error(`Script function not found for report: ${report.name}`);
    }

    // Execute the script function
    const data = await scriptFn(context.filters, this.pool);

    return {
      columns: report.columns,
      data,
      total_count: data.length,
    };
  }

  /**
   * Check if a script is registered
   */
  has(reportName: string): boolean {
    return this.scripts.has(reportName);
  }

  /**
   * Get all registered script names
   */
  list(): string[] {
    return Array.from(this.scripts.keys());
  }
}

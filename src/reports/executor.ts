/**
 * Report executor - orchestrates query and script report execution
 */

import type { Pool } from 'pg';
import type {
  ReportDefinition,
  ReportContext,
  ReportResult,
  ReportExecutor as IReportExecutor,
} from './types.js';
import { QueryReportExecutor } from './query-executor.js';
import { ScriptReportExecutor } from './script-executor.js';

/**
 * Main report executor
 */
export class DefaultReportExecutor implements IReportExecutor {
  private queryExecutor: QueryReportExecutor;
  private scriptExecutor: ScriptReportExecutor;

  constructor(pool: Pool) {
    this.queryExecutor = new QueryReportExecutor(pool);
    this.scriptExecutor = new ScriptReportExecutor(pool);
  }

  /**
   * Execute a report
   */
  async execute(
    report: ReportDefinition,
    context: ReportContext
  ): Promise<ReportResult> {
    if (report.type === 'query') {
      return this.queryExecutor.execute(report, context);
    } else if (report.type === 'script') {
      return this.scriptExecutor.execute(report, context);
    } else {
      const unknownType = (report as { type: string }).type;
      throw new Error(`Unknown report type: ${unknownType}`);
    }
  }

  /**
   * Get the script executor for registering script functions
   */
  getScriptExecutor(): ScriptReportExecutor {
    return this.scriptExecutor;
  }
}

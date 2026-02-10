/**
 * Report registry for managing report definitions
 */

import type { ReportDefinition, ReportRegistry } from './types.js';

/**
 * Default report registry implementation
 */
export class DefaultReportRegistry implements ReportRegistry {
  private reports = new Map<string, ReportDefinition>();

  /**
   * Register a report
   */
  register(report: ReportDefinition): void {
    this.reports.set(report.name, report);
  }

  /**
   * Get a report by name
   */
  get(name: string): ReportDefinition | undefined {
    return this.reports.get(name);
  }

  /**
   * List all registered reports
   */
  list(): ReportDefinition[] {
    return Array.from(this.reports.values());
  }

  /**
   * Check if a report exists
   */
  has(name: string): boolean {
    return this.reports.has(name);
  }

  /**
   * Remove a report
   */
  remove(name: string): boolean {
    return this.reports.delete(name);
  }

  /**
   * Clear all reports
   */
  clear(): void {
    this.reports.clear();
  }
}

/**
 * Report system types
 */

import type { Pool } from 'pg';

/**
 * Report types
 */
export type ReportType = 'query' | 'script';

/**
 * Column data types
 */
export type ColumnType = 'Data' | 'Int' | 'Float' | 'Currency' | 'Date' | 'DateTime' | 'Link' | 'Check';

/**
 * Report column definition
 */
export interface ReportColumn {
  fieldname: string;
  label: string;
  fieldtype: ColumnType;
  width?: number;
  options?: string; // For Link fields
}

/**
 * Report filter
 */
export interface ReportFilter {
  fieldname: string;
  label: string;
  fieldtype: string;
  options?: string;
  default?: unknown;
  reqd?: boolean;
}

/**
 * Query report definition
 */
export interface QueryReportDefinition {
  name: string;
  type: 'query';
  query: string;
  columns: ReportColumn[];
  filters?: ReportFilter[];
  description?: string;
}

/**
 * Script report definition
 */
export interface ScriptReportDefinition {
  name: string;
  type: 'script';
  columns: ReportColumn[];
  filters?: ReportFilter[];
  description?: string;
  // Script function path will be resolved separately
}

/**
 * Report definition (union type)
 */
export type ReportDefinition = QueryReportDefinition | ScriptReportDefinition;

/**
 * Report execution context
 */
export interface ReportContext {
  filters: Record<string, unknown>;
  user?: string;
}

/**
 * Report result row
 */
export type ReportRow = Record<string, unknown>;

/**
 * Report execution result
 */
export interface ReportResult {
  columns: ReportColumn[];
  data: ReportRow[];
  total_count?: number;
}

/**
 * Script report function signature
 */
export type ScriptReportFunction = (
  filters: Record<string, unknown>,
  pool: Pool
) => Promise<ReportRow[]>;

/**
 * Report executor interface
 */
export interface ReportExecutor {
  execute(
    report: ReportDefinition,
    context: ReportContext
  ): Promise<ReportResult>;
}

/**
 * Report registry interface
 */
export interface ReportRegistry {
  register(report: ReportDefinition): void;
  get(name: string): ReportDefinition | undefined;
  list(): ReportDefinition[];
}

/**
 * Column formatter function
 */
export type ColumnFormatter = (value: unknown) => string;

/**
 * Report export format
 */
export type ExportFormat = 'json' | 'csv' | 'xlsx';

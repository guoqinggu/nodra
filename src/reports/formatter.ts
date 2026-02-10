/**
 * Column formatting utilities
 */

import type { ReportColumn, ColumnFormatter } from './types.js';

/**
 * Format a value based on column type
 */
export function formatColumnValue(value: unknown, column: ReportColumn): string {
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
        return value.toISOString().split('T')[0] ?? '';
      }
      return String(value).split('T')[0] ?? '';

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

/**
 * Create a formatter function for a specific column
 */
export function createColumnFormatter(column: ReportColumn): ColumnFormatter {
  return (value: unknown) => formatColumnValue(value, column);
}

/**
 * Format all values in a row based on column definitions
 */
export function formatRow(
  row: Record<string, unknown>,
  columns: ReportColumn[]
): Record<string, string> {
  const formatted: Record<string, string> = {};

  for (const column of columns) {
    formatted[column.fieldname] = formatColumnValue(
      row[column.fieldname],
      column
    );
  }

  return formatted;
}

/**
 * Format all rows in a dataset
 */
export function formatRows(
  rows: Record<string, unknown>[],
  columns: ReportColumn[]
): Record<string, string>[] {
  return rows.map((row) => formatRow(row, columns));
}

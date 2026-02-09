/**
 * Nodra Framework - Naming System
 *
 * Generates document names based on naming rules defined in DocTypes.
 * Provides utilities for hash generation, field-based naming,
 * format patterns, and DocType-to-table-name conversions.
 */

import { randomBytes } from 'node:crypto';
import { ValidationError } from '../errors.js';

/**
 * Generate a random hex string of the given length.
 *
 * @param length - Number of hex characters to produce (default 10)
 */
export function generateHash(length = 10): string {
  // Each byte produces 2 hex chars, so we need ceil(length / 2) bytes
  const byteCount = Math.ceil(length / 2);
  return randomBytes(byteCount).toString('hex').slice(0, length);
}

/**
 * Convert a field value to a valid name string.
 *
 * @throws {ValidationError} If the value is null, undefined, or empty after trimming
 */
export function generateFieldName(fieldValue: unknown): string {
  if (fieldValue === null || fieldValue === undefined) {
    throw new ValidationError('Field value for naming cannot be null or undefined');
  }

  const name = String(fieldValue).trim();

  if (name === '') {
    throw new ValidationError('Field value for naming cannot be empty');
  }

  return name;
}

/**
 * Parse a format pattern by replacing `{####}` groups with a zero-padded counter.
 *
 * The number of `#` characters determines the minimum padding width.
 * If the counter exceeds the padding width, the full number is used.
 *
 * @example
 * parseFormatPattern('TODO-{####}', 1)  // => 'TODO-0001'
 * parseFormatPattern('INV-{#####}', 42) // => 'INV-00042'
 */
export function parseFormatPattern(pattern: string, counter: number): string {
  return pattern.replace(/\{(#+)\}/g, (_match, hashes: string) => {
    const padLength = hashes.length;
    return String(counter).padStart(padLength, '0');
  });
}

/**
 * Convert a DocType name to snake_case.
 *
 * @example
 * toSnakeCase('Sales Invoice') // => 'sales_invoice'
 * toSnakeCase('Todo')          // => 'todo'
 * toSnakeCase('NoteItem')      // => 'note_item'
 */
export function toSnakeCase(name: string): string {
  return name
    .replace(/\s+/g, '_')                        // spaces → underscores
    .replace(/([a-z])([A-Z])/g, '$1_$2')         // camelCase boundaries
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')   // consecutive caps
    .toLowerCase();
}

/**
 * Convert a DocType name to its database table name.
 *
 * Convention: `tab_` + snake_case(doctype_name)
 *
 * @example
 * toTableName('Todo')          // => 'tab_todo'
 * toTableName('Sales Invoice') // => 'tab_sales_invoice'
 */
export function toTableName(doctypeName: string): string {
  return `tab_${toSnakeCase(doctypeName)}`;
}

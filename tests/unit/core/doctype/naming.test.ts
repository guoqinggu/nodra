import { describe, it, expect } from 'vitest';
import {
  generateHash,
  generateFieldName,
  parseFormatPattern,
  toSnakeCase,
  toTableName,
} from '../../../../src/core/doctype/naming.js';
import { ValidationError } from '../../../../src/core/errors.js';

// ---------------------------------------------------------------------------
// generateHash
// ---------------------------------------------------------------------------

describe('generateHash()', () => {
  it('should return a string of 10 hex characters by default', () => {
    const hash = generateHash();
    expect(hash).toHaveLength(10);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('should return a string of the specified length', () => {
    const hash = generateHash(6);
    expect(hash).toHaveLength(6);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('should return a string of the specified length for large values', () => {
    const hash = generateHash(32);
    expect(hash).toHaveLength(32);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('should generate different values on successive calls', () => {
    const hashes = new Set(Array.from({ length: 20 }, () => generateHash()));
    // Extremely unlikely that all 20 are the same
    expect(hashes.size).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// generateFieldName
// ---------------------------------------------------------------------------

describe('generateFieldName()', () => {
  it('should convert a string value to a name', () => {
    expect(generateFieldName('hello world')).toBe('hello world');
  });

  it('should convert a number value to a string name', () => {
    expect(generateFieldName(42)).toBe('42');
  });

  it('should trim whitespace from the result', () => {
    expect(generateFieldName('  padded  ')).toBe('padded');
  });

  it('should throw ValidationError for empty string', () => {
    expect(() => generateFieldName('')).toThrow(ValidationError);
  });

  it('should throw ValidationError for whitespace-only string', () => {
    expect(() => generateFieldName('   ')).toThrow(ValidationError);
  });

  it('should throw ValidationError for null', () => {
    expect(() => generateFieldName(null)).toThrow(ValidationError);
  });

  it('should throw ValidationError for undefined', () => {
    expect(() => generateFieldName(undefined)).toThrow(ValidationError);
  });
});

// ---------------------------------------------------------------------------
// parseFormatPattern
// ---------------------------------------------------------------------------

describe('parseFormatPattern()', () => {
  it('should replace {####} with zero-padded counter (4 digits)', () => {
    expect(parseFormatPattern('TODO-{####}', 1)).toBe('TODO-0001');
  });

  it('should replace {#####} with zero-padded counter (5 digits)', () => {
    expect(parseFormatPattern('INV-{#####}', 42)).toBe('INV-00042');
  });

  it('should handle large counter values', () => {
    expect(parseFormatPattern('TODO-{####}', 9999)).toBe('TODO-9999');
  });

  it('should handle counter exceeding padding length', () => {
    // Counter 12345 is 5 digits, pattern is 4 digits — just use the number
    expect(parseFormatPattern('TODO-{####}', 12345)).toBe('TODO-12345');
  });

  it('should handle pattern with prefix and suffix', () => {
    expect(parseFormatPattern('PRE-{###}-SUF', 7)).toBe('PRE-007-SUF');
  });

  it('should replace multiple hash groups independently', () => {
    expect(parseFormatPattern('{##}-{####}', 5)).toBe('05-0005');
  });

  it('should return pattern as-is if no hash groups are present', () => {
    expect(parseFormatPattern('STATIC-PREFIX', 1)).toBe('STATIC-PREFIX');
  });
});

// ---------------------------------------------------------------------------
// toSnakeCase
// ---------------------------------------------------------------------------

describe('toSnakeCase()', () => {
  it('should convert a simple PascalCase name', () => {
    expect(toSnakeCase('Todo')).toBe('todo');
  });

  it('should convert a multi-word name with spaces', () => {
    expect(toSnakeCase('Sales Invoice')).toBe('sales_invoice');
  });

  it('should pass through already snake_case names', () => {
    expect(toSnakeCase('sales_invoice')).toBe('sales_invoice');
  });

  it('should handle CamelCase boundaries', () => {
    expect(toSnakeCase('NoteItem')).toBe('note_item');
  });
});

// ---------------------------------------------------------------------------
// toTableName
// ---------------------------------------------------------------------------

describe('toTableName()', () => {
  it('should convert a simple DocType name to a table name', () => {
    expect(toTableName('Todo')).toBe('tab_todo');
  });

  it('should convert a multi-word DocType name to a table name', () => {
    expect(toTableName('Sales Invoice')).toBe('tab_sales_invoice');
  });

  it('should always prefix with tab_', () => {
    const result = toTableName('Customer');
    expect(result.startsWith('tab_')).toBe(true);
  });
});

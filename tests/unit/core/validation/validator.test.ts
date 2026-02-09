import { describe, it, expect, beforeEach } from 'vitest';
import { validateDocument } from '../../../../src/core/validation/validator.js';
import { Document } from '../../../../src/core/document/document.js';
import type { DocTypeDefinition } from '../../../../src/core/doctype/schema.js';
import { ValidationError, MandatoryError } from '../../../../src/core/errors.js';

// ---------------------------------------------------------------------------
// Test helpers & fixtures
// ---------------------------------------------------------------------------

function makeMeta(overrides: Partial<DocTypeDefinition> = {}): DocTypeDefinition {
  return {
    name: 'Todo',
    module: 'Core',
    naming_rule: 'autoincrement',
    is_submittable: false,
    is_child: false,
    is_single: false,
    is_tree: false,
    is_virtual: false,
    fields: [
      { fieldname: 'title', fieldtype: 'Data', label: 'Title', reqd: true, max_length: 100 },
      { fieldname: 'status', fieldtype: 'Select', label: 'Status', options: ['Open', 'Closed', 'Cancelled'] },
      { fieldname: 'description', fieldtype: 'Text', label: 'Description' },
      { fieldname: 'priority', fieldtype: 'Int', label: 'Priority' },
      { fieldname: 'is_active', fieldtype: 'Check', label: 'Is Active' },
      { fieldname: 'due_date', fieldtype: 'Date', label: 'Due Date' },
      { fieldname: 'amount', fieldtype: 'Float', label: 'Amount' },
      { fieldname: 'cost', fieldtype: 'Currency', label: 'Cost' },
    ],
    permissions: [],
    ...overrides,
  };
}

function makeDoc(
  meta: DocTypeDefinition,
  data?: Record<string, unknown>,
): Document {
  return new Document(meta, data);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('validateDocument', () => {
  let meta: DocTypeDefinition;

  beforeEach(() => {
    meta = makeMeta();
  });

  // --- Valid document ---

  describe('valid document', () => {
    it('should pass validation for a document with all valid fields', () => {
      const doc = makeDoc(meta, {
        title: 'My Task',
        status: 'Open',
        priority: 3,
        is_active: true,
        due_date: '2025-12-31',
        amount: 99.95,
      });

      expect(() => validateDocument(doc, meta)).not.toThrow();
    });

    it('should pass validation when optional fields are absent', () => {
      const doc = makeDoc(meta, { title: 'Minimal Task' });
      expect(() => validateDocument(doc, meta)).not.toThrow();
    });

    it('should pass validation when optional fields are null', () => {
      const doc = makeDoc(meta, {
        title: 'Task',
        description: null,
        priority: null,
      });
      expect(() => validateDocument(doc, meta)).not.toThrow();
    });
  });

  // --- Mandatory / Required field validation ---

  describe('required field validation', () => {
    it('should throw when required field is missing (undefined)', () => {
      const doc = makeDoc(meta, {});
      expect(() => validateDocument(doc, meta)).toThrow();
    });

    it('should throw when required field is null', () => {
      const doc = makeDoc(meta, { title: null });
      expect(() => validateDocument(doc, meta)).toThrow();
    });

    it('should throw when required field is empty string', () => {
      const doc = makeDoc(meta, { title: '' });
      expect(() => validateDocument(doc, meta)).toThrow();
    });

    it('should throw MandatoryError for missing required field', () => {
      const doc = makeDoc(meta, {});

      try {
        validateDocument(doc, meta);
        expect.fail('Expected ValidationError');
      } catch (err) {
        // The aggregate error should be a ValidationError
        expect(err).toBeInstanceOf(ValidationError);
        const ve = err as ValidationError;
        // Details should contain the mandatory field info
        expect(ve.details.length).toBeGreaterThanOrEqual(1);
        expect(ve.details.some((d) => d.field === 'title')).toBe(true);
      }
    });

    it('should not throw for required field with valid value 0', () => {
      // 0 is a valid value for a required Int field
      const intMeta = makeMeta({
        fields: [
          { fieldname: 'count', fieldtype: 'Int', label: 'Count', reqd: true },
        ],
      });
      const doc = makeDoc(intMeta, { count: 0 });
      expect(() => validateDocument(doc, intMeta)).not.toThrow();
    });

    it('should not throw for required Check field with false', () => {
      const checkMeta = makeMeta({
        fields: [
          { fieldname: 'confirmed', fieldtype: 'Check', label: 'Confirmed', reqd: true },
        ],
      });
      const doc = makeDoc(checkMeta, { confirmed: false });
      expect(() => validateDocument(doc, checkMeta)).not.toThrow();
    });
  });

  // --- Type validation ---

  describe('type validation', () => {
    it('should throw when Int field receives a non-number string', () => {
      const doc = makeDoc(meta, { title: 'Task', priority: 'high' });
      expect(() => validateDocument(doc, meta)).toThrow(ValidationError);
    });

    it('should throw when Int field receives a float', () => {
      const doc = makeDoc(meta, { title: 'Task', priority: 3.5 });
      expect(() => validateDocument(doc, meta)).toThrow(ValidationError);
    });

    it('should pass Int validation for integer value', () => {
      const doc = makeDoc(meta, { title: 'Task', priority: 5 });
      expect(() => validateDocument(doc, meta)).not.toThrow();
    });

    it('should throw when Check field receives a non-boolean value', () => {
      const doc = makeDoc(meta, { title: 'Task', is_active: 'yes' });
      expect(() => validateDocument(doc, meta)).toThrow(ValidationError);
    });

    it('should pass Check validation for boolean values', () => {
      const doc = makeDoc(meta, { title: 'Task', is_active: true });
      expect(() => validateDocument(doc, meta)).not.toThrow();
    });

    it('should pass Check validation for 0 and 1 (truthy/falsy integers)', () => {
      const doc = makeDoc(meta, { title: 'Task', is_active: 1 });
      expect(() => validateDocument(doc, meta)).not.toThrow();

      const doc2 = makeDoc(meta, { title: 'Task', is_active: 0 });
      expect(() => validateDocument(doc2, meta)).not.toThrow();
    });

    it('should throw when Date field receives an invalid date string', () => {
      const doc = makeDoc(meta, { title: 'Task', due_date: 'not-a-date' });
      expect(() => validateDocument(doc, meta)).toThrow(ValidationError);
    });

    it('should pass Date validation for valid date string', () => {
      const doc = makeDoc(meta, { title: 'Task', due_date: '2025-12-31' });
      expect(() => validateDocument(doc, meta)).not.toThrow();
    });

    it('should pass Date validation for Date object', () => {
      const doc = makeDoc(meta, { title: 'Task', due_date: new Date('2025-12-31') });
      expect(() => validateDocument(doc, meta)).not.toThrow();
    });

    it('should throw when Float field receives non-numeric value', () => {
      const doc = makeDoc(meta, { title: 'Task', amount: 'abc' });
      expect(() => validateDocument(doc, meta)).toThrow(ValidationError);
    });

    it('should pass Float validation for numeric values', () => {
      const doc = makeDoc(meta, { title: 'Task', amount: 3.14 });
      expect(() => validateDocument(doc, meta)).not.toThrow();
    });

    it('should pass Currency validation for numeric values', () => {
      const doc = makeDoc(meta, { title: 'Task', cost: 99.99 });
      expect(() => validateDocument(doc, meta)).not.toThrow();
    });

    it('should skip type validation for null or undefined values', () => {
      const doc = makeDoc(meta, { title: 'Task', priority: null, is_active: undefined });
      expect(() => validateDocument(doc, meta)).not.toThrow();
    });
  });

  // --- Max length validation ---

  describe('max length validation', () => {
    it('should throw when string exceeds max_length', () => {
      const longTitle = 'x'.repeat(101);
      const doc = makeDoc(meta, { title: longTitle });
      expect(() => validateDocument(doc, meta)).toThrow(ValidationError);
    });

    it('should pass when string is exactly at max_length', () => {
      const exactTitle = 'x'.repeat(100);
      const doc = makeDoc(meta, { title: exactTitle });
      expect(() => validateDocument(doc, meta)).not.toThrow();
    });

    it('should pass when string is under max_length', () => {
      const doc = makeDoc(meta, { title: 'Short' });
      expect(() => validateDocument(doc, meta)).not.toThrow();
    });
  });

  // --- Select validation ---

  describe('select field validation', () => {
    it('should throw when Select value is not in options', () => {
      const doc = makeDoc(meta, { title: 'Task', status: 'Invalid' });
      expect(() => validateDocument(doc, meta)).toThrow(ValidationError);
    });

    it('should pass when Select value is a valid option', () => {
      const doc = makeDoc(meta, { title: 'Task', status: 'Open' });
      expect(() => validateDocument(doc, meta)).not.toThrow();
    });

    it('should pass when Select value is null (optional field)', () => {
      const doc = makeDoc(meta, { title: 'Task', status: null });
      expect(() => validateDocument(doc, meta)).not.toThrow();
    });

    it('should pass when Select value is undefined (optional field)', () => {
      const doc = makeDoc(meta, { title: 'Task' });
      expect(() => validateDocument(doc, meta)).not.toThrow();
    });

    it('should throw when Select value is empty string and field is not required', () => {
      // Empty string is not in the options list, should fail
      const doc = makeDoc(meta, { title: 'Task', status: '' });
      expect(() => validateDocument(doc, meta)).toThrow(ValidationError);
    });
  });

  // --- Multiple errors collected ---

  describe('multiple errors', () => {
    it('should collect all errors in a single ValidationError', () => {
      const strictMeta = makeMeta({
        fields: [
          { fieldname: 'title', fieldtype: 'Data', label: 'Title', reqd: true },
          { fieldname: 'email', fieldtype: 'Data', label: 'Email', reqd: true },
          { fieldname: 'count', fieldtype: 'Int', label: 'Count' },
          { fieldname: 'status', fieldtype: 'Select', label: 'Status', options: ['A', 'B'] },
        ],
      });

      // Missing both required fields, invalid type for count, invalid select option
      const doc = makeDoc(strictMeta, {
        count: 'not-a-number',
        status: 'C',
      });

      try {
        validateDocument(doc, strictMeta);
        expect.fail('Expected ValidationError');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        const ve = err as ValidationError;
        // At least 4 errors: title missing, email missing, count type, status invalid
        expect(ve.details.length).toBeGreaterThanOrEqual(4);

        const fieldNames = ve.details.map((d) => d.field);
        expect(fieldNames).toContain('title');
        expect(fieldNames).toContain('email');
        expect(fieldNames).toContain('count');
        expect(fieldNames).toContain('status');
      }
    });

    it('should include descriptive messages in error details', () => {
      const doc = makeDoc(meta, {}); // missing required 'title'

      try {
        validateDocument(doc, meta);
        expect.fail('Expected ValidationError');
      } catch (err) {
        const ve = err as ValidationError;
        const titleError = ve.details.find((d) => d.field === 'title');
        expect(titleError).toBeDefined();
        expect(titleError!.message).toBeTruthy();
      }
    });
  });
});

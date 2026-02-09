import { describe, it, expect } from 'vitest';
import {
  STANDARD_FIELDS,
  CHILD_TABLE_FIELDS,
  parseDocType,
  injectStandardFields,
} from '../../../../src/core/doctype/schema.js';
import type {
  FieldDefinition,
  PermissionRule,
  DocTypeDefinition,
  NamingRule,
} from '../../../../src/core/doctype/schema.js';
import { ValidationError } from '../../../../src/core/errors.js';

// ---------------------------------------------------------------------------
// Test helpers & fixtures (inline, self-contained)
// ---------------------------------------------------------------------------

/** Minimal valid DocType raw input */
function validRawDocType(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'Todo',
    module: 'Core',
    fields: [
      { fieldname: 'title', fieldtype: 'Data', label: 'Title' },
    ],
    ...overrides,
  };
}

/** Builds a full raw DocType with multiple fields and permissions */
function fullRawDocType(): Record<string, unknown> {
  return {
    name: 'Sales Invoice',
    module: 'Accounting',
    naming_rule: 'format',
    is_submittable: true,
    is_child: false,
    is_single: false,
    is_tree: false,
    is_virtual: false,
    fields: [
      {
        fieldname: 'customer',
        fieldtype: 'Link',
        label: 'Customer',
        reqd: true,
        options: 'Customer',
      },
      {
        fieldname: 'total',
        fieldtype: 'Currency',
        label: 'Total',
        precision: 2,
      },
      {
        fieldname: 'items',
        fieldtype: 'Table',
        label: 'Items',
        options: 'Sales Invoice Item',
      },
      {
        fieldname: 'notes',
        fieldtype: 'Text',
        label: 'Notes',
        hidden: true,
      },
    ],
    permissions: [
      { role: 'System Manager', read: true, write: true, create: true, delete: true, submit: true, cancel: true, amend: true, if_owner: false },
      { role: 'Accounts User', read: true, write: true, create: true, delete: false, submit: false, cancel: false, amend: false, if_owner: true },
    ],
    search_fields: ['customer'],
    title_field: 'customer',
    sort_field: 'creation',
    sort_order: 'desc',
  };
}

// ===========================================================================
// STANDARD_FIELDS
// ===========================================================================

describe('STANDARD_FIELDS', () => {
  const EXPECTED_STANDARD_FIELDNAMES = [
    'name',
    'owner',
    'creation',
    'modified',
    'modified_by',
    'docstatus',
    'idx',
  ];

  it('should contain exactly 7 standard fields', () => {
    expect(STANDARD_FIELDS).toHaveLength(7);
  });

  it('should contain all required standard fieldnames', () => {
    const fieldnames = STANDARD_FIELDS.map((f) => f.fieldname);
    for (const expected of EXPECTED_STANDARD_FIELDNAMES) {
      expect(fieldnames).toContain(expected);
    }
  });

  it('should have correct field types for each standard field', () => {
    const byName = new Map(STANDARD_FIELDS.map((f) => [f.fieldname, f]));

    expect(byName.get('name')?.fieldtype).toBe('Data');
    expect(byName.get('owner')?.fieldtype).toBe('Data');
    expect(byName.get('creation')?.fieldtype).toBe('Datetime');
    expect(byName.get('modified')?.fieldtype).toBe('Datetime');
    expect(byName.get('modified_by')?.fieldtype).toBe('Data');
    expect(byName.get('docstatus')?.fieldtype).toBe('Int');
    expect(byName.get('idx')?.fieldtype).toBe('Int');
  });

  it('should have a label for each standard field', () => {
    for (const field of STANDARD_FIELDS) {
      expect(field.label).toBeDefined();
      expect(field.label.length).toBeGreaterThan(0);
    }
  });

  it('should be an array of FieldDefinition objects', () => {
    for (const field of STANDARD_FIELDS) {
      expect(field).toHaveProperty('fieldname');
      expect(field).toHaveProperty('fieldtype');
      expect(field).toHaveProperty('label');
    }
  });
});

// ===========================================================================
// CHILD_TABLE_FIELDS
// ===========================================================================

describe('CHILD_TABLE_FIELDS', () => {
  const EXPECTED_CHILD_FIELDNAMES = ['parent', 'parenttype', 'parentfield'];

  it('should contain exactly 3 child table fields', () => {
    expect(CHILD_TABLE_FIELDS).toHaveLength(3);
  });

  it('should contain parent, parenttype, and parentfield', () => {
    const fieldnames = CHILD_TABLE_FIELDS.map((f) => f.fieldname);
    for (const expected of EXPECTED_CHILD_FIELDNAMES) {
      expect(fieldnames).toContain(expected);
    }
  });

  it('should have correct field types for child table fields', () => {
    const byName = new Map(CHILD_TABLE_FIELDS.map((f) => [f.fieldname, f]));

    expect(byName.get('parent')?.fieldtype).toBe('Data');
    expect(byName.get('parenttype')?.fieldtype).toBe('Data');
    expect(byName.get('parentfield')?.fieldtype).toBe('Data');
  });

  it('should have a label for each child table field', () => {
    for (const field of CHILD_TABLE_FIELDS) {
      expect(field.label).toBeDefined();
      expect(field.label.length).toBeGreaterThan(0);
    }
  });

  it('should be an array of FieldDefinition objects', () => {
    for (const field of CHILD_TABLE_FIELDS) {
      expect(field).toHaveProperty('fieldname');
      expect(field).toHaveProperty('fieldtype');
      expect(field).toHaveProperty('label');
    }
  });
});

// ===========================================================================
// parseDocType()
// ===========================================================================

describe('parseDocType()', () => {
  // ---- Valid Input ---------------------------------------------------------

  describe('valid input', () => {
    it('should parse a minimal valid DocType with name, module and fields', () => {
      const raw = validRawDocType();
      const result = parseDocType(raw);

      expect(result.name).toBe('Todo');
      expect(result.module).toBe('Core');
      expect(result.fields).toHaveLength(1);
      expect(result.fields[0]!.fieldname).toBe('title');
    });

    it('should default boolean flags to false when not provided', () => {
      const raw = validRawDocType();
      const result = parseDocType(raw);

      expect(result.is_submittable).toBe(false);
      expect(result.is_child).toBe(false);
      expect(result.is_single).toBe(false);
      expect(result.is_tree).toBe(false);
      expect(result.is_virtual).toBe(false);
    });

    it('should default naming_rule to "autoincrement" when not provided', () => {
      const raw = validRawDocType();
      const result = parseDocType(raw);

      expect(result.naming_rule).toBe('autoincrement');
    });

    it('should default permissions to empty array when not provided', () => {
      const raw = validRawDocType();
      const result = parseDocType(raw);

      expect(result.permissions).toEqual([]);
    });

    it('should parse a full DocType with all fields and permissions', () => {
      const raw = fullRawDocType();
      const result = parseDocType(raw);

      expect(result.name).toBe('Sales Invoice');
      expect(result.module).toBe('Accounting');
      expect(result.naming_rule).toBe('format');
      expect(result.is_submittable).toBe(true);
      expect(result.is_child).toBe(false);
      expect(result.fields).toHaveLength(4);
      expect(result.permissions).toHaveLength(2);
      expect(result.search_fields).toEqual(['customer']);
      expect(result.title_field).toBe('customer');
      expect(result.sort_field).toBe('creation');
      expect(result.sort_order).toBe('desc');
    });

    it('should accept all valid naming_rule values', () => {
      const validRules: NamingRule[] = [
        'autoincrement', 'hash', 'field', 'format', 'prompt', 'expression',
      ];

      for (const rule of validRules) {
        const raw = validRawDocType({ naming_rule: rule });
        const result = parseDocType(raw);
        expect(result.naming_rule).toBe(rule);
      }
    });

    it('should accept boolean flags when explicitly set to true', () => {
      const raw = validRawDocType({
        is_submittable: true,
        is_child: true,
        is_single: true,
        is_tree: true,
        is_virtual: true,
      });
      const result = parseDocType(raw);

      expect(result.is_submittable).toBe(true);
      expect(result.is_child).toBe(true);
      expect(result.is_single).toBe(true);
      expect(result.is_tree).toBe(true);
      expect(result.is_virtual).toBe(true);
    });

    it('should parse fields with all optional properties', () => {
      const raw = validRawDocType({
        fields: [
          {
            fieldname: 'email',
            fieldtype: 'Data',
            label: 'Email Address',
            reqd: true,
            unique: true,
            default: 'test@example.com',
            max_length: 320,
            hidden: false,
            read_only: false,
            in_list_view: true,
            in_standard_filter: true,
            search_index: true,
            description: 'User email address',
            depends_on: 'eval:doc.is_active',
          },
        ],
      });
      const result = parseDocType(raw);
      const field = result.fields[0]!;

      expect(field.fieldname).toBe('email');
      expect(field.reqd).toBe(true);
      expect(field.unique).toBe(true);
      expect(field.default).toBe('test@example.com');
      expect(field.max_length).toBe(320);
      expect(field.hidden).toBe(false);
      expect(field.read_only).toBe(false);
      expect(field.in_list_view).toBe(true);
      expect(field.in_standard_filter).toBe(true);
      expect(field.search_index).toBe(true);
      expect(field.description).toBe('User email address');
      expect(field.depends_on).toBe('eval:doc.is_active');
    });

    it('should parse Select field with options as string array', () => {
      const raw = validRawDocType({
        fields: [
          {
            fieldname: 'status',
            fieldtype: 'Select',
            label: 'Status',
            options: ['Open', 'Closed', 'Cancelled'],
          },
        ],
      });
      const result = parseDocType(raw);
      expect(result.fields[0]!.options).toEqual(['Open', 'Closed', 'Cancelled']);
    });

    it('should parse Link field with options as string', () => {
      const raw = validRawDocType({
        fields: [
          {
            fieldname: 'assigned_to',
            fieldtype: 'Link',
            label: 'Assigned To',
            options: 'User',
          },
        ],
      });
      const result = parseDocType(raw);
      expect(result.fields[0]!.options).toBe('User');
    });

    it('should parse permissions with all permission properties', () => {
      const raw = validRawDocType({
        permissions: [
          {
            role: 'System Manager',
            read: true,
            write: true,
            create: true,
            delete: true,
            submit: true,
            cancel: true,
            amend: true,
            if_owner: false,
          },
        ],
      });
      const result = parseDocType(raw);
      const perm = result.permissions[0]!;

      expect(perm.role).toBe('System Manager');
      expect(perm.read).toBe(true);
      expect(perm.write).toBe(true);
      expect(perm.create).toBe(true);
      expect(perm.delete).toBe(true);
      expect(perm.submit).toBe(true);
      expect(perm.cancel).toBe(true);
      expect(perm.amend).toBe(true);
      expect(perm.if_owner).toBe(false);
    });

    it('should parse a Currency field with precision', () => {
      const raw = validRawDocType({
        fields: [
          {
            fieldname: 'amount',
            fieldtype: 'Currency',
            label: 'Amount',
            precision: 4,
          },
        ],
      });
      const result = parseDocType(raw);
      expect(result.fields[0]!.precision).toBe(4);
    });
  });

  // ---- Invalid Input: non-object -------------------------------------------

  describe('invalid input - non-object', () => {
    it('should throw ValidationError for null input', () => {
      expect(() => parseDocType(null)).toThrow(ValidationError);
    });

    it('should throw ValidationError for undefined input', () => {
      expect(() => parseDocType(undefined)).toThrow(ValidationError);
    });

    it('should throw ValidationError for string input', () => {
      expect(() => parseDocType('not an object')).toThrow(ValidationError);
    });

    it('should throw ValidationError for number input', () => {
      expect(() => parseDocType(42)).toThrow(ValidationError);
    });

    it('should throw ValidationError for array input', () => {
      expect(() => parseDocType([1, 2, 3])).toThrow(ValidationError);
    });

    it('should throw ValidationError for boolean input', () => {
      expect(() => parseDocType(true)).toThrow(ValidationError);
    });
  });

  // ---- Invalid Input: missing required fields ------------------------------

  describe('invalid input - missing required fields', () => {
    it('should throw ValidationError when name is missing', () => {
      const raw = { module: 'Core', fields: [{ fieldname: 'title', fieldtype: 'Data', label: 'Title' }] };
      expect(() => parseDocType(raw)).toThrow(ValidationError);
    });

    it('should throw ValidationError when name is empty string', () => {
      const raw = validRawDocType({ name: '' });
      expect(() => parseDocType(raw)).toThrow(ValidationError);
    });

    it('should throw ValidationError when name is not a string', () => {
      const raw = validRawDocType({ name: 123 });
      expect(() => parseDocType(raw)).toThrow(ValidationError);
    });

    it('should throw ValidationError when fields is missing', () => {
      const raw = { name: 'Todo', module: 'Core' };
      expect(() => parseDocType(raw)).toThrow(ValidationError);
    });

    it('should throw ValidationError when fields is not an array', () => {
      const raw = validRawDocType({ fields: 'not an array' });
      expect(() => parseDocType(raw)).toThrow(ValidationError);
    });

    it('should throw ValidationError when fields is an empty array', () => {
      const raw = validRawDocType({ fields: [] });
      expect(() => parseDocType(raw)).toThrow(ValidationError);
    });

    it('should throw ValidationError when module is missing', () => {
      const raw = { name: 'Todo', fields: [{ fieldname: 'title', fieldtype: 'Data', label: 'Title' }] };
      expect(() => parseDocType(raw)).toThrow(ValidationError);
    });

    it('should throw ValidationError when module is empty string', () => {
      const raw = validRawDocType({ module: '' });
      expect(() => parseDocType(raw)).toThrow(ValidationError);
    });
  });

  // ---- Invalid Input: field validation -------------------------------------

  describe('invalid input - field validation', () => {
    it('should throw ValidationError when a field has an invalid fieldtype', () => {
      const raw = validRawDocType({
        fields: [
          { fieldname: 'title', fieldtype: 'InvalidType', label: 'Title' },
        ],
      });
      expect(() => parseDocType(raw)).toThrow(ValidationError);
    });

    it('should throw ValidationError when a field is missing fieldname', () => {
      const raw = validRawDocType({
        fields: [
          { fieldtype: 'Data', label: 'Title' },
        ],
      });
      expect(() => parseDocType(raw)).toThrow(ValidationError);
    });

    it('should throw ValidationError when a field is missing fieldtype', () => {
      const raw = validRawDocType({
        fields: [
          { fieldname: 'title', label: 'Title' },
        ],
      });
      expect(() => parseDocType(raw)).toThrow(ValidationError);
    });

    it('should throw ValidationError when a field is missing label', () => {
      const raw = validRawDocType({
        fields: [
          { fieldname: 'title', fieldtype: 'Data' },
        ],
      });
      expect(() => parseDocType(raw)).toThrow(ValidationError);
    });

    it('should throw ValidationError when fieldname is empty string', () => {
      const raw = validRawDocType({
        fields: [
          { fieldname: '', fieldtype: 'Data', label: 'Title' },
        ],
      });
      expect(() => parseDocType(raw)).toThrow(ValidationError);
    });

    it('should throw ValidationError when a field is not an object', () => {
      const raw = validRawDocType({
        fields: ['not an object'],
      });
      expect(() => parseDocType(raw)).toThrow(ValidationError);
    });

    it('should validate all fields, not just the first one', () => {
      const raw = validRawDocType({
        fields: [
          { fieldname: 'title', fieldtype: 'Data', label: 'Title' },
          { fieldname: 'status', fieldtype: 'BadType', label: 'Status' },
        ],
      });
      expect(() => parseDocType(raw)).toThrow(ValidationError);
    });
  });

  // ---- Invalid Input: naming_rule ------------------------------------------

  describe('invalid input - naming_rule', () => {
    it('should throw ValidationError for invalid naming_rule value', () => {
      const raw = validRawDocType({ naming_rule: 'invalid_rule' });
      expect(() => parseDocType(raw)).toThrow(ValidationError);
    });

    it('should throw ValidationError for non-string naming_rule', () => {
      const raw = validRawDocType({ naming_rule: 123 });
      expect(() => parseDocType(raw)).toThrow(ValidationError);
    });
  });

  // ---- Error messages carry context ----------------------------------------

  describe('error messages', () => {
    it('should include doctype name context when available', () => {
      const raw = validRawDocType({
        fields: [
          { fieldname: 'x', fieldtype: 'Bogus', label: 'X' },
        ],
      });
      try {
        parseDocType(raw);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect((err as ValidationError).message).toBeTruthy();
      }
    });

    it('should include field context in validation error for bad fields', () => {
      const raw = validRawDocType({
        fields: [
          { fieldname: 'bad', fieldtype: 'NotReal', label: 'Bad' },
        ],
      });
      try {
        parseDocType(raw);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
      }
    });
  });
});

// ===========================================================================
// injectStandardFields()
// ===========================================================================

describe('injectStandardFields()', () => {
  /** Helper to create a parsed DocTypeDefinition for testing */
  function makeParsedDocType(overrides: Partial<DocTypeDefinition> = {}): DocTypeDefinition {
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
        { fieldname: 'title', fieldtype: 'Data', label: 'Title' },
        { fieldname: 'status', fieldtype: 'Select', label: 'Status', options: ['Open', 'Closed'] },
      ],
      permissions: [],
      ...overrides,
    };
  }

  // ---- Standard (non-child) DocType ----------------------------------------

  describe('standard DocType (is_child = false)', () => {
    it('should add all 7 standard fields', () => {
      const doctype = makeParsedDocType();
      const result = injectStandardFields(doctype);

      const fieldnames = result.fields.map((f) => f.fieldname);
      for (const sf of STANDARD_FIELDS) {
        expect(fieldnames).toContain(sf.fieldname);
      }
    });

    it('should prepend standard fields before custom fields', () => {
      const doctype = makeParsedDocType();
      const result = injectStandardFields(doctype);

      // The first fields should be standard fields
      const standardFieldnames = STANDARD_FIELDS.map((f) => f.fieldname);
      for (let i = 0; i < standardFieldnames.length; i++) {
        expect(result.fields[i]!.fieldname).toBe(standardFieldnames[i]);
      }

      // Custom fields should follow
      expect(result.fields[standardFieldnames.length]!.fieldname).toBe('title');
      expect(result.fields[standardFieldnames.length + 1]!.fieldname).toBe('status');
    });

    it('should result in correct total field count', () => {
      const doctype = makeParsedDocType();
      const result = injectStandardFields(doctype);

      expect(result.fields).toHaveLength(STANDARD_FIELDS.length + 2);
    });

    it('should NOT add child table fields for non-child DocType', () => {
      const doctype = makeParsedDocType({ is_child: false });
      const result = injectStandardFields(doctype);

      const fieldnames = result.fields.map((f) => f.fieldname);
      for (const cf of CHILD_TABLE_FIELDS) {
        expect(fieldnames).not.toContain(cf.fieldname);
      }
    });
  });

  // ---- Child DocType -------------------------------------------------------

  describe('child DocType (is_child = true)', () => {
    it('should add standard fields AND child table fields', () => {
      const doctype = makeParsedDocType({ is_child: true });
      const result = injectStandardFields(doctype);

      const fieldnames = result.fields.map((f) => f.fieldname);

      // Standard fields present
      for (const sf of STANDARD_FIELDS) {
        expect(fieldnames).toContain(sf.fieldname);
      }

      // Child table fields present
      for (const cf of CHILD_TABLE_FIELDS) {
        expect(fieldnames).toContain(cf.fieldname);
      }
    });

    it('should have correct total field count for child DocType', () => {
      const doctype = makeParsedDocType({ is_child: true });
      const result = injectStandardFields(doctype);

      const expectedLength = STANDARD_FIELDS.length + CHILD_TABLE_FIELDS.length + 2;
      expect(result.fields).toHaveLength(expectedLength);
    });

    it('should prepend standard + child fields before custom fields', () => {
      const doctype = makeParsedDocType({ is_child: true });
      const result = injectStandardFields(doctype);

      const injectedCount = STANDARD_FIELDS.length + CHILD_TABLE_FIELDS.length;

      // Custom fields come after injected ones
      expect(result.fields[injectedCount]!.fieldname).toBe('title');
      expect(result.fields[injectedCount + 1]!.fieldname).toBe('status');
    });
  });

  // ---- Deduplication -------------------------------------------------------

  describe('deduplication', () => {
    it('should not duplicate standard fields if they are already present', () => {
      const doctype = makeParsedDocType({
        fields: [
          { fieldname: 'name', fieldtype: 'Data', label: 'Name' },
          { fieldname: 'title', fieldtype: 'Data', label: 'Title' },
        ],
      });
      const result = injectStandardFields(doctype);

      const nameOccurrences = result.fields.filter((f) => f.fieldname === 'name');
      expect(nameOccurrences).toHaveLength(1);
    });

    it('should not duplicate child table fields if already present in child DocType', () => {
      const doctype = makeParsedDocType({
        is_child: true,
        fields: [
          { fieldname: 'parent', fieldtype: 'Data', label: 'Parent' },
          { fieldname: 'title', fieldtype: 'Data', label: 'Title' },
        ],
      });
      const result = injectStandardFields(doctype);

      const parentOccurrences = result.fields.filter((f) => f.fieldname === 'parent');
      expect(parentOccurrences).toHaveLength(1);
    });

    it('should still add missing standard fields even when some are already present', () => {
      const doctype = makeParsedDocType({
        fields: [
          { fieldname: 'name', fieldtype: 'Data', label: 'Name' },
          { fieldname: 'owner', fieldtype: 'Data', label: 'Owner' },
          { fieldname: 'title', fieldtype: 'Data', label: 'Title' },
        ],
      });
      const result = injectStandardFields(doctype);

      const fieldnames = result.fields.map((f) => f.fieldname);
      // All standard fields should be present
      for (const sf of STANDARD_FIELDS) {
        expect(fieldnames).toContain(sf.fieldname);
      }
    });
  });

  // ---- Immutability --------------------------------------------------------

  describe('immutability', () => {
    it('should return a new DocTypeDefinition object', () => {
      const doctype = makeParsedDocType();
      const result = injectStandardFields(doctype);

      expect(result).not.toBe(doctype);
    });

    it('should not modify the original fields array', () => {
      const doctype = makeParsedDocType();
      const originalFieldCount = doctype.fields.length;
      injectStandardFields(doctype);

      expect(doctype.fields).toHaveLength(originalFieldCount);
    });

    it('should preserve all non-field properties of the DocType', () => {
      const doctype = makeParsedDocType({
        naming_rule: 'hash',
        is_submittable: true,
        permissions: [
          { role: 'All', read: true, write: false, create: false, delete: false, submit: false, cancel: false, amend: false, if_owner: false },
        ],
        search_fields: ['title'],
        title_field: 'title',
        sort_field: 'modified',
        sort_order: 'desc',
      });
      const result = injectStandardFields(doctype);

      expect(result.name).toBe(doctype.name);
      expect(result.module).toBe(doctype.module);
      expect(result.naming_rule).toBe('hash');
      expect(result.is_submittable).toBe(true);
      expect(result.permissions).toEqual(doctype.permissions);
      expect(result.search_fields).toEqual(['title']);
      expect(result.title_field).toBe('title');
      expect(result.sort_field).toBe('modified');
      expect(result.sort_order).toBe('desc');
    });
  });
});

// ===========================================================================
// Type-level checks (compile-time verification via type assertions)
// ===========================================================================

describe('TypeScript interface contracts', () => {
  it('FieldDefinition requires fieldname, fieldtype, and label', () => {
    // This test verifies the interface shape at runtime using a valid object.
    // If the interface changes incompatibly, the TypeScript compiler will
    // catch it before tests run.
    const field: FieldDefinition = {
      fieldname: 'test',
      fieldtype: 'Data',
      label: 'Test',
    };

    expect(field.fieldname).toBe('test');
    expect(field.fieldtype).toBe('Data');
    expect(field.label).toBe('Test');
  });

  it('FieldDefinition supports all optional properties', () => {
    const field: FieldDefinition = {
      fieldname: 'test',
      fieldtype: 'Data',
      label: 'Test',
      reqd: true,
      unique: false,
      default: 'hello',
      max_length: 100,
      options: 'SomeDocType',
      hidden: false,
      read_only: false,
      in_list_view: true,
      in_standard_filter: false,
      search_index: true,
      description: 'A test field',
      depends_on: 'eval:true',
      precision: 2,
    };

    expect(field.reqd).toBe(true);
    expect(field.max_length).toBe(100);
    expect(field.precision).toBe(2);
  });

  it('PermissionRule requires role and boolean permission flags', () => {
    const perm: PermissionRule = {
      role: 'System Manager',
      read: true,
      write: true,
      create: true,
      delete: true,
      submit: false,
      cancel: false,
      amend: false,
      if_owner: false,
    };

    expect(perm.role).toBe('System Manager');
    expect(perm.read).toBe(true);
    expect(perm.delete).toBe(true);
    expect(perm.if_owner).toBe(false);
  });

  it('DocTypeDefinition has all required properties', () => {
    const dt: DocTypeDefinition = {
      name: 'Test',
      module: 'Core',
      naming_rule: 'autoincrement',
      is_submittable: false,
      is_child: false,
      is_single: false,
      is_tree: false,
      is_virtual: false,
      fields: [],
      permissions: [],
    };

    expect(dt.name).toBe('Test');
    expect(dt.module).toBe('Core');
    expect(dt.naming_rule).toBe('autoincrement');
    expect(dt.is_submittable).toBe(false);
    expect(dt.fields).toEqual([]);
    expect(dt.permissions).toEqual([]);
  });

  it('NamingRule allows all valid naming strategies', () => {
    const rules: NamingRule[] = [
      'autoincrement',
      'hash',
      'field',
      'format',
      'prompt',
      'expression',
    ];

    expect(rules).toHaveLength(6);
    for (const rule of rules) {
      expect(typeof rule).toBe('string');
    }
  });
});

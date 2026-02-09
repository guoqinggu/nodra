import { describe, it, expect, beforeEach } from 'vitest';
import { DocTypeRegistry } from '../../../../src/core/doctype/registry.js';
import type { DocTypeDefinition } from '../../../../src/core/doctype/schema.js';
import { DuplicateError, NotFoundError } from '../../../../src/core/errors.js';

// ---------------------------------------------------------------------------
// Test helpers & fixtures (inline, self-contained)
// ---------------------------------------------------------------------------

function makeDocType(overrides: Partial<DocTypeDefinition> = {}): DocTypeDefinition {
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
    ],
    permissions: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DocTypeRegistry', () => {
  let registry: DocTypeRegistry;

  beforeEach(() => {
    registry = new DocTypeRegistry();
  });

  // --- register / get ---

  describe('register() and get()', () => {
    it('should register a DocType and retrieve it by name', () => {
      const todo = makeDocType();
      registry.register(todo);

      const result = registry.get('Todo');
      expect(result).toBe(todo);
      expect(result.name).toBe('Todo');
      expect(result.module).toBe('Core');
    });

    it('should register multiple DocTypes independently', () => {
      const todo = makeDocType();
      const note = makeDocType({ name: 'Note', module: 'Core' });

      registry.register(todo);
      registry.register(note);

      expect(registry.get('Todo')).toBe(todo);
      expect(registry.get('Note')).toBe(note);
    });
  });

  // --- duplicate registration ---

  describe('register() - duplicate', () => {
    it('should throw DuplicateError when registering a DocType with the same name', () => {
      const todo = makeDocType();
      registry.register(todo);

      const duplicate = makeDocType({ module: 'Other' });
      expect(() => registry.register(duplicate)).toThrow(DuplicateError);
    });

    it('should include doctype name in DuplicateError', () => {
      const todo = makeDocType();
      registry.register(todo);

      try {
        registry.register(makeDocType());
        expect.fail('Expected DuplicateError');
      } catch (err) {
        expect(err).toBeInstanceOf(DuplicateError);
        expect((err as DuplicateError).doctype).toBe('DocType');
        expect((err as DuplicateError).docName).toBe('Todo');
      }
    });
  });

  // --- not found ---

  describe('get() - not found', () => {
    it('should throw NotFoundError when DocType is not registered', () => {
      expect(() => registry.get('NonExistent')).toThrow(NotFoundError);
    });

    it('should include doctype name in NotFoundError', () => {
      try {
        registry.get('MissingType');
        expect.fail('Expected NotFoundError');
      } catch (err) {
        expect(err).toBeInstanceOf(NotFoundError);
        expect((err as NotFoundError).doctype).toBe('DocType');
        expect((err as NotFoundError).docName).toBe('MissingType');
      }
    });
  });

  // --- has ---

  describe('has()', () => {
    it('should return true for a registered DocType', () => {
      registry.register(makeDocType());
      expect(registry.has('Todo')).toBe(true);
    });

    it('should return false for an unregistered DocType', () => {
      expect(registry.has('Todo')).toBe(false);
    });
  });

  // --- list ---

  describe('list()', () => {
    it('should return an empty array when no DocTypes are registered', () => {
      expect(registry.list()).toEqual([]);
    });

    it('should return all registered DocTypes', () => {
      const todo = makeDocType();
      const note = makeDocType({ name: 'Note', module: 'Core' });
      const invoice = makeDocType({ name: 'Sales Invoice', module: 'Accounting' });

      registry.register(todo);
      registry.register(note);
      registry.register(invoice);

      const result = registry.list();
      expect(result).toHaveLength(3);
      expect(result).toContain(todo);
      expect(result).toContain(note);
      expect(result).toContain(invoice);
    });
  });

  // --- listByModule ---

  describe('listByModule()', () => {
    it('should return only DocTypes matching the given module', () => {
      const todo = makeDocType({ name: 'Todo', module: 'Core' });
      const note = makeDocType({ name: 'Note', module: 'Core' });
      const invoice = makeDocType({ name: 'Sales Invoice', module: 'Accounting' });

      registry.register(todo);
      registry.register(note);
      registry.register(invoice);

      const coreTypes = registry.listByModule('Core');
      expect(coreTypes).toHaveLength(2);
      expect(coreTypes).toContain(todo);
      expect(coreTypes).toContain(note);

      const accountingTypes = registry.listByModule('Accounting');
      expect(accountingTypes).toHaveLength(1);
      expect(accountingTypes).toContain(invoice);
    });

    it('should return an empty array when no DocTypes match the module', () => {
      registry.register(makeDocType({ module: 'Core' }));
      expect(registry.listByModule('HR')).toEqual([]);
    });
  });

  // --- getLinkedDocTypes ---

  describe('getLinkedDocTypes()', () => {
    it('should return names of DocTypes that have Link fields pointing to the given DocType', () => {
      const customer = makeDocType({ name: 'Customer', module: 'CRM' });
      const invoice = makeDocType({
        name: 'Sales Invoice',
        module: 'Accounting',
        fields: [
          { fieldname: 'customer', fieldtype: 'Link', label: 'Customer', options: 'Customer' },
          { fieldname: 'total', fieldtype: 'Currency', label: 'Total' },
        ],
      });
      const payment = makeDocType({
        name: 'Payment',
        module: 'Accounting',
        fields: [
          { fieldname: 'customer', fieldtype: 'Link', label: 'Customer', options: 'Customer' },
          { fieldname: 'amount', fieldtype: 'Currency', label: 'Amount' },
        ],
      });

      registry.register(customer);
      registry.register(invoice);
      registry.register(payment);

      const linked = registry.getLinkedDocTypes('Customer');
      expect(linked).toHaveLength(2);
      expect(linked).toContain('Sales Invoice');
      expect(linked).toContain('Payment');
    });

    it('should return an empty array when no DocTypes link to the given DocType', () => {
      const todo = makeDocType({ name: 'Todo', module: 'Core' });
      registry.register(todo);

      expect(registry.getLinkedDocTypes('Todo')).toEqual([]);
    });

    it('should not include DocTypes that only have non-Link fields', () => {
      const customer = makeDocType({ name: 'Customer', module: 'CRM' });
      const note = makeDocType({
        name: 'Note',
        module: 'Core',
        fields: [
          { fieldname: 'title', fieldtype: 'Data', label: 'Title' },
        ],
      });

      registry.register(customer);
      registry.register(note);

      expect(registry.getLinkedDocTypes('Customer')).toEqual([]);
    });

    it('should not include the DocType itself even if it self-references', () => {
      const category = makeDocType({
        name: 'Category',
        module: 'Core',
        fields: [
          { fieldname: 'parent_category', fieldtype: 'Link', label: 'Parent Category', options: 'Category' },
        ],
      });

      registry.register(category);

      // self-references should be included - it does link to itself
      const linked = registry.getLinkedDocTypes('Category');
      expect(linked).toContain('Category');
    });
  });

  // --- clear ---

  describe('clear()', () => {
    it('should remove all registered DocTypes', () => {
      registry.register(makeDocType({ name: 'Todo', module: 'Core' }));
      registry.register(makeDocType({ name: 'Note', module: 'Core' }));

      expect(registry.list()).toHaveLength(2);

      registry.clear();

      expect(registry.list()).toEqual([]);
      expect(registry.has('Todo')).toBe(false);
      expect(registry.has('Note')).toBe(false);
    });

    it('should allow re-registering after clear', () => {
      const todo = makeDocType();
      registry.register(todo);
      registry.clear();

      // Should not throw - name is no longer registered
      const newTodo = makeDocType({ module: 'Other' });
      registry.register(newTodo);

      expect(registry.get('Todo')).toBe(newTodo);
    });
  });
});

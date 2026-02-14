import { describe, it, expect } from 'vitest';
import { convertFieldToSchema, generateDocTypeSchema } from '../../../src/api/openapi-generator.js';
import type { DocTypeDefinition } from '../../../src/core/doctype/schema.js';

describe('OpenAPI Generator', () => {
  describe('convertFieldToSchema', () => {
    it('should convert Data field to string schema', () => {
      const field = { fieldname: 'name', fieldtype: 'Data', label: 'Name' };
      const schema = convertFieldToSchema(field as any);
      expect(schema.type).toBe('string');
    });

    it('should convert Int field to number schema', () => {
      const field = { fieldname: 'amount', fieldtype: 'Int', label: 'Amount' };
      const schema = convertFieldToSchema(field as any);
      expect(schema.type).toBe('number');
    });

    it('should convert Check field to boolean schema', () => {
      const field = { fieldname: 'enabled', fieldtype: 'Check', label: 'Enabled' };
      const schema = convertFieldToSchema(field as any);
      expect(schema.type).toBe('boolean');
    });

    it('should convert Select field to enum schema', () => {
      const field = {
        fieldname: 'status',
        fieldtype: 'Select',
        label: 'Status',
        options: 'Open\nClosed\nPending',
      };
      const schema = convertFieldToSchema(field as any);
      expect(schema.type).toBe('string');
      expect(schema.enum).toEqual(['Open', 'Closed', 'Pending']);
    });

    it('should convert Datetime field to date-time format', () => {
      const field = { fieldname: 'created_at', fieldtype: 'Datetime', label: 'Created At' };
      const schema = convertFieldToSchema(field as any);
      expect(schema.format).toBe('date-time');
    });

    it('should convert Date field to date format', () => {
      const field = { fieldname: 'birth_date', fieldtype: 'Date', label: 'Birth Date' };
      const schema = convertFieldToSchema(field as any);
      expect(schema.format).toBe('date');
    });

    it('should convert Table field to array schema', () => {
      const field = { fieldname: 'items', fieldtype: 'Table', label: 'Items' };
      const schema = convertFieldToSchema(field as any);
      expect(schema.type).toBe('array');
    });
  });

  describe('generateDocTypeSchema', () => {
    it('should generate schema from DocType definition', () => {
      const doctype: DocTypeDefinition = {
        name: 'Task',
        fields: [
          { fieldname: 'title', fieldtype: 'Data', label: 'Title', reqd: true },
          { fieldname: 'status', fieldtype: 'Select', label: 'Status', options: 'Open\nClosed' },
        ],
      } as any;

      const schema = generateDocTypeSchema(doctype);

      expect(schema.type).toBe('object');
      expect(schema.properties).toHaveProperty('title');
      expect(schema.properties).toHaveProperty('status');
      expect(schema.required).toContain('title');
    });
  });
});

import { describe, it, expect } from 'vitest';
import {
  FIELD_TYPES,
  FIELD_TYPE_PG_MAP,
  DATA_FIELD_TYPES,
  NUMERIC_FIELD_TYPES,
  DATE_FIELD_TYPES,
  TEXT_FIELD_TYPES,
  LINK_FIELD_TYPES,
  isFieldType,
  getPgType,
  isNumericField,
  isTextField,
  isDateField,
  isLinkField,
  isDataField,
} from '../../../../src/core/doctype/field-types.js';

describe('Field Types', () => {
  describe('FIELD_TYPES', () => {
    it('should contain all supported field types', () => {
      const expectedTypes = [
        'Data', 'Int', 'Float', 'Currency',
        'Date', 'Datetime', 'Time',
        'Text', 'LongText', 'SmallText',
        'Check', 'Select',
        'Link', 'DynamicLink', 'Table',
        'Attach', 'AttachImage',
        'Color', 'JSON', 'Password',
        'ReadOnly', 'HTML',
      ];
      for (const t of expectedTypes) {
        expect(FIELD_TYPES).toContain(t);
      }
      expect(FIELD_TYPES).toHaveLength(expectedTypes.length);
    });
  });

  describe('isFieldType()', () => {
    it('should return true for valid field types', () => {
      expect(isFieldType('Data')).toBe(true);
      expect(isFieldType('Int')).toBe(true);
      expect(isFieldType('Link')).toBe(true);
      expect(isFieldType('Table')).toBe(true);
      expect(isFieldType('JSON')).toBe(true);
    });

    it('should return false for invalid field types', () => {
      expect(isFieldType('String')).toBe(false);
      expect(isFieldType('Number')).toBe(false);
      expect(isFieldType('')).toBe(false);
      expect(isFieldType('data')).toBe(false); // case-sensitive
    });
  });

  describe('FIELD_TYPE_PG_MAP', () => {
    it('should map Data to VARCHAR', () => {
      expect(FIELD_TYPE_PG_MAP.Data).toBe('VARCHAR(255)');
    });

    it('should map Int to INTEGER', () => {
      expect(FIELD_TYPE_PG_MAP.Int).toBe('INTEGER');
    });

    it('should map Float to DOUBLE PRECISION', () => {
      expect(FIELD_TYPE_PG_MAP.Float).toBe('DOUBLE PRECISION');
    });

    it('should map Currency to NUMERIC(18,6)', () => {
      expect(FIELD_TYPE_PG_MAP.Currency).toBe('NUMERIC(18,6)');
    });

    it('should map Date to DATE', () => {
      expect(FIELD_TYPE_PG_MAP.Date).toBe('DATE');
    });

    it('should map Datetime to TIMESTAMPTZ', () => {
      expect(FIELD_TYPE_PG_MAP.Datetime).toBe('TIMESTAMPTZ');
    });

    it('should map Time to TIME', () => {
      expect(FIELD_TYPE_PG_MAP.Time).toBe('TIME');
    });

    it('should map text types to TEXT', () => {
      expect(FIELD_TYPE_PG_MAP.Text).toBe('TEXT');
      expect(FIELD_TYPE_PG_MAP.LongText).toBe('TEXT');
      expect(FIELD_TYPE_PG_MAP.SmallText).toBe('TEXT');
      expect(FIELD_TYPE_PG_MAP.HTML).toBe('TEXT');
    });

    it('should map Check to BOOLEAN', () => {
      expect(FIELD_TYPE_PG_MAP.Check).toBe('BOOLEAN');
    });

    it('should map Select to VARCHAR(255)', () => {
      expect(FIELD_TYPE_PG_MAP.Select).toBe('VARCHAR(255)');
    });

    it('should map Link and DynamicLink to VARCHAR(255)', () => {
      expect(FIELD_TYPE_PG_MAP.Link).toBe('VARCHAR(255)');
      expect(FIELD_TYPE_PG_MAP.DynamicLink).toBe('VARCHAR(255)');
    });

    it('should map JSON to JSONB', () => {
      expect(FIELD_TYPE_PG_MAP.JSON).toBe('JSONB');
    });

    it('should map Color to VARCHAR(7)', () => {
      expect(FIELD_TYPE_PG_MAP.Color).toBe('VARCHAR(7)');
    });

    it('should map attachment types to TEXT', () => {
      expect(FIELD_TYPE_PG_MAP.Attach).toBe('TEXT');
      expect(FIELD_TYPE_PG_MAP.AttachImage).toBe('TEXT');
    });

    it('should map Password to TEXT', () => {
      expect(FIELD_TYPE_PG_MAP.Password).toBe('TEXT');
    });

    it('should not have a mapping for Table (child table, no column)', () => {
      expect(FIELD_TYPE_PG_MAP.Table).toBeUndefined();
    });

    it('should not have a mapping for ReadOnly (virtual field)', () => {
      expect(FIELD_TYPE_PG_MAP.ReadOnly).toBeUndefined();
    });
  });

  describe('getPgType()', () => {
    it('should return mapped PostgreSQL type for known field types', () => {
      expect(getPgType('Data')).toBe('VARCHAR(255)');
      expect(getPgType('Int')).toBe('INTEGER');
      expect(getPgType('JSON')).toBe('JSONB');
    });

    it('should return custom VARCHAR length for Data with max_length', () => {
      expect(getPgType('Data', 100)).toBe('VARCHAR(100)');
      expect(getPgType('Data', 500)).toBe('VARCHAR(500)');
    });

    it('should ignore max_length for non-Data types', () => {
      expect(getPgType('Int', 100)).toBe('INTEGER');
      expect(getPgType('Text', 100)).toBe('TEXT');
    });

    it('should return undefined for Table and ReadOnly', () => {
      expect(getPgType('Table')).toBeUndefined();
      expect(getPgType('ReadOnly')).toBeUndefined();
    });
  });

  describe('Category helpers', () => {
    it('should identify numeric fields', () => {
      expect(isNumericField('Int')).toBe(true);
      expect(isNumericField('Float')).toBe(true);
      expect(isNumericField('Currency')).toBe(true);
      expect(isNumericField('Data')).toBe(false);
    });

    it('should identify text fields', () => {
      expect(isTextField('Text')).toBe(true);
      expect(isTextField('LongText')).toBe(true);
      expect(isTextField('SmallText')).toBe(true);
      expect(isTextField('HTML')).toBe(true);
      expect(isTextField('Data')).toBe(false);
    });

    it('should identify date fields', () => {
      expect(isDateField('Date')).toBe(true);
      expect(isDateField('Datetime')).toBe(true);
      expect(isDateField('Time')).toBe(true);
      expect(isDateField('Data')).toBe(false);
    });

    it('should identify link fields', () => {
      expect(isLinkField('Link')).toBe(true);
      expect(isLinkField('DynamicLink')).toBe(true);
      expect(isLinkField('Data')).toBe(false);
    });

    it('should identify data-bearing fields (have DB columns)', () => {
      expect(isDataField('Data')).toBe(true);
      expect(isDataField('Int')).toBe(true);
      expect(isDataField('Link')).toBe(true);
      expect(isDataField('Table')).toBe(false);
      expect(isDataField('ReadOnly')).toBe(false);
    });
  });
});

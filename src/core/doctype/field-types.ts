/**
 * Nodra Framework - Field Types
 *
 * Defines all supported field types, their PostgreSQL type mappings,
 * and category helpers for field classification.
 */

// --- Field Type Enum ---

export const FIELD_TYPES = [
  'Data', 'Int', 'Float', 'Currency',
  'Date', 'Datetime', 'Time',
  'Text', 'LongText', 'SmallText',
  'Check', 'Select',
  'Link', 'DynamicLink', 'Table',
  'Attach', 'AttachImage',
  'Color', 'JSON', 'Password',
  'ReadOnly', 'HTML',
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

const fieldTypeSet = new Set<string>(FIELD_TYPES);

export function isFieldType(value: string): value is FieldType {
  return fieldTypeSet.has(value);
}

// --- PostgreSQL Type Mapping ---

export const FIELD_TYPE_PG_MAP: Partial<Record<FieldType, string>> = {
  Data:        'VARCHAR(255)',
  Int:         'INTEGER',
  Float:       'DOUBLE PRECISION',
  Currency:    'NUMERIC(18,6)',
  Date:        'DATE',
  Datetime:    'TIMESTAMPTZ',
  Time:        'TIME',
  Text:        'TEXT',
  LongText:    'TEXT',
  SmallText:   'TEXT',
  Check:       'BOOLEAN',
  Select:      'VARCHAR(255)',
  Link:        'VARCHAR(255)',
  DynamicLink: 'VARCHAR(255)',
  Attach:      'TEXT',
  AttachImage: 'TEXT',
  Color:       'VARCHAR(7)',
  JSON:        'JSONB',
  Password:    'TEXT',
  HTML:        'TEXT',
  // Table: no column (child table)
  // ReadOnly: no column (virtual field)
};

/**
 * Get the PostgreSQL column type for a given field type.
 * Returns undefined for virtual fields (Table, ReadOnly) that have no column.
 */
export function getPgType(fieldtype: FieldType, maxLength?: number): string | undefined {
  if (fieldtype === 'Data' && maxLength !== undefined) {
    return `VARCHAR(${maxLength})`;
  }
  return FIELD_TYPE_PG_MAP[fieldtype];
}

// --- Category Sets ---

export const NUMERIC_FIELD_TYPES = new Set<FieldType>(['Int', 'Float', 'Currency']);
export const TEXT_FIELD_TYPES = new Set<FieldType>(['Text', 'LongText', 'SmallText', 'HTML']);
export const DATE_FIELD_TYPES = new Set<FieldType>(['Date', 'Datetime', 'Time']);
export const LINK_FIELD_TYPES = new Set<FieldType>(['Link', 'DynamicLink']);

/** Fields that do NOT produce a database column */
const VIRTUAL_FIELD_TYPES = new Set<FieldType>(['Table', 'ReadOnly']);

export const DATA_FIELD_TYPES = new Set<FieldType>(
  FIELD_TYPES.filter((ft) => !VIRTUAL_FIELD_TYPES.has(ft)),
);

// --- Category Helpers ---

export function isNumericField(fieldtype: FieldType): boolean {
  return NUMERIC_FIELD_TYPES.has(fieldtype);
}

export function isTextField(fieldtype: FieldType): boolean {
  return TEXT_FIELD_TYPES.has(fieldtype);
}

export function isDateField(fieldtype: FieldType): boolean {
  return DATE_FIELD_TYPES.has(fieldtype);
}

export function isLinkField(fieldtype: FieldType): boolean {
  return LINK_FIELD_TYPES.has(fieldtype);
}

/** Returns true if this field type produces a database column */
export function isDataField(fieldtype: FieldType): boolean {
  return DATA_FIELD_TYPES.has(fieldtype);
}

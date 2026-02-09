/**
 * Nodra Framework - DocType Schema
 *
 * Defines the interfaces for DocType definitions, field definitions,
 * and permission rules. Provides parsing/validation and standard field injection.
 */

import { ValidationError } from '../errors.js';
import { isFieldType } from './field-types.js';
import type { FieldType } from './field-types.js';

// --- Types ---

export type NamingRule = 'autoincrement' | 'hash' | 'field' | 'format' | 'prompt' | 'expression';

const VALID_NAMING_RULES = new Set<string>([
  'autoincrement', 'hash', 'field', 'format', 'prompt', 'expression',
]);

export interface FieldDefinition {
  fieldname: string;
  fieldtype: FieldType;
  label: string;
  reqd?: boolean;
  unique?: boolean;
  default?: unknown;
  max_length?: number;
  options?: string | string[];
  hidden?: boolean;
  read_only?: boolean;
  in_list_view?: boolean;
  in_standard_filter?: boolean;
  search_index?: boolean;
  description?: string;
  depends_on?: string;
  precision?: number;
}

export interface PermissionRule {
  role: string;
  read: boolean;
  write: boolean;
  create: boolean;
  delete: boolean;
  submit: boolean;
  cancel: boolean;
  amend: boolean;
  if_owner: boolean;
}

export interface DocTypeDefinition {
  name: string;
  module: string;
  naming_rule: NamingRule;
  is_submittable: boolean;
  is_child: boolean;
  is_single: boolean;
  is_tree: boolean;
  is_virtual: boolean;
  fields: FieldDefinition[];
  permissions: PermissionRule[];
  search_fields?: string[];
  title_field?: string;
  sort_field?: string;
  sort_order?: 'asc' | 'desc';
  hooks?: Record<string, unknown>;
}

// --- Standard Fields ---

export const STANDARD_FIELDS: FieldDefinition[] = [
  { fieldname: 'name', fieldtype: 'Data', label: 'Name' },
  { fieldname: 'owner', fieldtype: 'Data', label: 'Owner' },
  { fieldname: 'creation', fieldtype: 'Datetime', label: 'Created On' },
  { fieldname: 'modified', fieldtype: 'Datetime', label: 'Last Modified' },
  { fieldname: 'modified_by', fieldtype: 'Data', label: 'Modified By' },
  { fieldname: 'docstatus', fieldtype: 'Int', label: 'Document Status' },
  { fieldname: 'idx', fieldtype: 'Int', label: 'Index' },
];

export const CHILD_TABLE_FIELDS: FieldDefinition[] = [
  { fieldname: 'parent', fieldtype: 'Data', label: 'Parent' },
  { fieldname: 'parenttype', fieldtype: 'Data', label: 'Parent Type' },
  { fieldname: 'parentfield', fieldtype: 'Data', label: 'Parent Field' },
];

// --- Parsing ---

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateField(raw: unknown, index: number): FieldDefinition {
  if (!isPlainObject(raw)) {
    throw new ValidationError(`Field at index ${index} must be an object`);
  }

  const { fieldname, fieldtype, label } = raw;

  if (typeof fieldname !== 'string' || fieldname === '') {
    throw new ValidationError(`Field at index ${index}: "fieldname" is required and must be a non-empty string`);
  }
  if (typeof fieldtype !== 'string' || !isFieldType(fieldtype)) {
    throw new ValidationError(`Field "${fieldname || index}": invalid fieldtype "${String(fieldtype)}"`);
  }
  if (typeof label !== 'string' || label === '') {
    throw new ValidationError(`Field "${fieldname}": "label" is required and must be a non-empty string`);
  }

  return {
    fieldname,
    fieldtype,
    label,
    ...(raw['reqd'] !== undefined && { reqd: Boolean(raw['reqd']) }),
    ...(raw['unique'] !== undefined && { unique: Boolean(raw['unique']) }),
    ...(raw['default'] !== undefined && { default: raw['default'] }),
    ...(raw['max_length'] !== undefined && { max_length: Number(raw['max_length']) }),
    ...(raw['options'] !== undefined && { options: raw['options'] as string | string[] }),
    ...(raw['hidden'] !== undefined && { hidden: Boolean(raw['hidden']) }),
    ...(raw['read_only'] !== undefined && { read_only: Boolean(raw['read_only']) }),
    ...(raw['in_list_view'] !== undefined && { in_list_view: Boolean(raw['in_list_view']) }),
    ...(raw['in_standard_filter'] !== undefined && { in_standard_filter: Boolean(raw['in_standard_filter']) }),
    ...(raw['search_index'] !== undefined && { search_index: Boolean(raw['search_index']) }),
    ...(raw['description'] !== undefined && { description: String(raw['description']) }),
    ...(raw['depends_on'] !== undefined && { depends_on: String(raw['depends_on']) }),
    ...(raw['precision'] !== undefined && { precision: Number(raw['precision']) }),
  };
}

export function parseDocType(raw: unknown): DocTypeDefinition {
  if (!isPlainObject(raw)) {
    throw new ValidationError('DocType definition must be a plain object');
  }

  // Validate required string fields
  const { name, module } = raw;
  if (typeof name !== 'string' || name === '') {
    throw new ValidationError('"name" is required and must be a non-empty string');
  }
  if (typeof module !== 'string' || module === '') {
    throw new ValidationError(`DocType "${name}": "module" is required and must be a non-empty string`);
  }

  // Validate fields array
  const rawFields = raw['fields'];
  if (!Array.isArray(rawFields)) {
    throw new ValidationError(`DocType "${name}": "fields" is required and must be an array`);
  }
  if (rawFields.length === 0) {
    throw new ValidationError(`DocType "${name}": "fields" must contain at least one field`);
  }

  // Validate naming_rule
  const namingRule = raw['naming_rule'] ?? 'autoincrement';
  if (typeof namingRule !== 'string' || !VALID_NAMING_RULES.has(namingRule)) {
    throw new ValidationError(`DocType "${name}": invalid naming_rule "${String(namingRule)}"`);
  }

  // Parse fields
  const fields = rawFields.map((f, i) => validateField(f, i));

  // Parse permissions
  const rawPermissions = raw['permissions'];
  const permissions: PermissionRule[] = Array.isArray(rawPermissions)
    ? rawPermissions.map((p) => ({
        role: String((p as Record<string, unknown>)['role']),
        read: Boolean((p as Record<string, unknown>)['read']),
        write: Boolean((p as Record<string, unknown>)['write']),
        create: Boolean((p as Record<string, unknown>)['create']),
        delete: Boolean((p as Record<string, unknown>)['delete']),
        submit: Boolean((p as Record<string, unknown>)['submit']),
        cancel: Boolean((p as Record<string, unknown>)['cancel']),
        amend: Boolean((p as Record<string, unknown>)['amend']),
        if_owner: Boolean((p as Record<string, unknown>)['if_owner']),
      }))
    : [];

  return {
    name,
    module,
    naming_rule: namingRule as NamingRule,
    is_submittable: Boolean(raw['is_submittable']),
    is_child: Boolean(raw['is_child']),
    is_single: Boolean(raw['is_single']),
    is_tree: Boolean(raw['is_tree']),
    is_virtual: Boolean(raw['is_virtual']),
    fields,
    permissions,
    ...(raw['search_fields'] !== undefined && { search_fields: raw['search_fields'] as string[] }),
    ...(raw['title_field'] !== undefined && { title_field: String(raw['title_field']) }),
    ...(raw['sort_field'] !== undefined && { sort_field: String(raw['sort_field']) }),
    ...(raw['sort_order'] !== undefined && { sort_order: raw['sort_order'] as 'asc' | 'desc' }),
    ...(raw['hooks'] !== undefined && { hooks: raw['hooks'] as Record<string, unknown> }),
  };
}

// --- Standard Field Injection ---

export function injectStandardFields(doctype: DocTypeDefinition): DocTypeDefinition {
  const existingFieldnames = new Set(doctype.fields.map((f) => f.fieldname));

  // Collect standard fields that are not already present
  const standardToInject = STANDARD_FIELDS.filter((sf) => !existingFieldnames.has(sf.fieldname));

  // For child DocTypes, also inject child table fields
  let childToInject: FieldDefinition[] = [];
  if (doctype.is_child) {
    childToInject = CHILD_TABLE_FIELDS.filter((cf) => !existingFieldnames.has(cf.fieldname));
  }

  return {
    ...doctype,
    fields: [...standardToInject, ...childToInject, ...doctype.fields],
  };
}

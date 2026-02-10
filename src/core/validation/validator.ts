/**
 * Nodra Framework - Validation Engine
 *
 * Validates a Document instance against its DocType field definitions.
 * Collects ALL validation errors and throws a single ValidationError
 * with a details array containing every failure.
 */

import type { Document } from '../document/document.js';
import type { DocTypeDefinition, FieldDefinition } from '../doctype/schema.js';
import type { ErrorDetail } from '../errors.js';
import { ValidationError } from '../errors.js';

/**
 * Validate a Document against its DocType definition.
 *
 * This function does NOT fail fast — it collects every validation error
 * and throws a single `ValidationError` with a populated `details` array
 * at the end.
 *
 * @throws {ValidationError} When one or more validation rules are violated.
 */
export function validateDocument(doc: Document, meta: DocTypeDefinition): void {
  const errors: ErrorDetail[] = [];

  for (const field of meta.fields) {
    const value = doc.get(field.fieldname);

    // --- Required (mandatory) check ---
    if (field.reqd) {
      if (isMissing(value, field)) {
        errors.push({
          field: field.fieldname,
          message: `${meta.name}: "${field.fieldname}" is a mandatory field`,
        });
        // Skip further checks for this field if value is missing
        continue;
      }
    }

    // Skip remaining validation if value is null/undefined (optional field)
    if (value === null || value === undefined) {
      continue;
    }

    // --- Type validation ---
    const typeError = validateType(value, field, meta.name);
    if (typeError) {
      errors.push(typeError);
    }

    // --- Max length validation ---
    const lengthError = validateMaxLength(value, field, meta.name);
    if (lengthError) {
      errors.push(lengthError);
    }

    // --- Select options validation ---
    const selectError = validateSelect(value, field, meta.name);
    if (selectError) {
      errors.push(selectError);
    }
  }

  if (errors.length > 0) {
    throw new ValidationError(
      `Validation failed for ${meta.name}: ${errors.length} error(s)`,
      { details: errors },
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if a value should be considered "missing" for a required field.
 * Special handling: 0 is valid for numeric fields, false is valid for Check.
 */
function isMissing(value: unknown, field: FieldDefinition): boolean {
  if (value === null || value === undefined) {
    return true;
  }

  // Empty string is missing for Data/Text-like fields
  if (typeof value === 'string' && value === '') {
    return true;
  }

  // 0 is valid for numeric types, false is valid for Check
  // (they pass through because they're not null/undefined/empty-string)

  return false;
}

/**
 * Validate the runtime type of a value against its field type.
 */
function validateType(
  value: unknown,
  _field: FieldDefinition,
  doctype: string,
): ErrorDetail | null {
  const { fieldname, fieldtype } = _field;

  switch (fieldtype) {
    case 'Int': {
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        return {
          field: fieldname,
          message: `${doctype}.${fieldname}: value must be an integer, got ${typeof value === 'number' ? 'float' : typeof value}`,
        };
      }
      break;
    }

    case 'Float':
    case 'Currency': {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return {
          field: fieldname,
          message: `${doctype}.${fieldname}: value must be a number, got ${typeof value}`,
        };
      }
      break;
    }

    case 'Check': {
      // Accept boolean or 0/1 integers
      if (typeof value === 'boolean') break;
      if (typeof value === 'number' && (value === 0 || value === 1)) break;
      return {
        field: fieldname,
        message: `${doctype}.${fieldname}: value must be a boolean (or 0/1), got ${typeof value}`,
      };
    }

    case 'Date':
    case 'Datetime':
    case 'Time': {
      if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) {
          return {
            field: fieldname,
            message: `${doctype}.${fieldname}: invalid date value`,
          };
        }
        break;
      }
      if (typeof value === 'string') {
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
          return {
            field: fieldname,
            message: `${doctype}.${fieldname}: invalid date string "${value}"`,
          };
        }
        break;
      }
      return {
        field: fieldname,
        message: `${doctype}.${fieldname}: value must be a Date or valid date string, got ${typeof value}`,
      };
    }

    // Data, Text, Select, Link etc. — no strict runtime type check beyond what is handled by max_length/select
    default:
      break;
  }

  return null;
}

/**
 * Validate that a string value does not exceed max_length.
 */
function validateMaxLength(
  value: unknown,
  field: FieldDefinition,
  doctype: string,
): ErrorDetail | null {
  if (field.max_length === undefined || field.max_length <= 0) {
    return null;
  }

  if (typeof value === 'string' && value.length > field.max_length) {
    return {
      field: field.fieldname,
      message: `${doctype}.${field.fieldname}: value exceeds max length of ${field.max_length} (got ${value.length})`,
    };
  }

  return null;
}

/**
 * Validate that a Select field value is one of the allowed options.
 */
function validateSelect(
  value: unknown,
  field: FieldDefinition,
  doctype: string,
): ErrorDetail | null {
  if (field.fieldtype !== 'Select') {
    return null;
  }

  if (!field.options || !Array.isArray(field.options)) {
    return null;
  }

  const strValue = String(value);
  if (!field.options.includes(strValue)) {
    return {
      field: field.fieldname,
      message: `${doctype}.${field.fieldname}: value "${strValue}" is not a valid option. Valid options: ${field.options.join(', ')}`,
    };
  }

  return null;
}

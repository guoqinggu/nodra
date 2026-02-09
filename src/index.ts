/**
 * Nodra Framework
 * A metadata-driven web framework inspired by Frappe
 */

export const VERSION = '0.1.0';

// Application
export { Nodra } from './nodra.js';

// Document
export { Document } from './core/document/document.js';

// Errors
export {
  NodraError,
  ValidationError,
  MandatoryError,
  LinkValidationError,
  AuthenticationError,
  PermissionError,
  NotFoundError,
  DuplicateError,
  InvalidStateError,
  DatabaseError,
  AppError,
} from './core/errors.js';

// Types
export type {
  DocTypeDefinition,
  FieldDefinition,
  PermissionRule,
  NamingRule,
} from './core/doctype/schema.js';

export type { NodraConfig } from './core/config.js';

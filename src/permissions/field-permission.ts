import type { DocTypeDefinition, FieldPermissionRule } from '../core/doctype/schema.js';
import { PermissionError } from '../core/errors.js';
import type { UserContext } from './permission.js';

export type { FieldPermissionRule };

type FieldPermissionAction = 'read' | 'write';

function evaluateCondition(
  condition: string,
  document: Record<string, unknown>,
  user: UserContext,
): boolean {
  try {
    const doc = { doc: document, user };
    const keys = Object.keys(doc);
    const values = Object.values(doc);

    const func = new Function(...keys, `return ${condition}`);
    return func(...values);
  } catch {
    return false;
  }
}

export function hasFieldPermission(
  doctype: DocTypeDefinition,
  fieldname: string,
  action: FieldPermissionAction,
  user: UserContext,
  document?: Record<string, unknown>,
): boolean {
  const field = doctype.fields.find((f) => f.fieldname === fieldname);

  if (!field) return false;

  if (action === 'write' && field.read_only) {
    return false;
  }

  if (user.roles.includes('System Manager') || user.roles.includes('Admin')) {
    return true;
  }

  const rule = doctype.field_permissions?.find((r) => user.roles.includes(r.role));

  if (!rule) return false;

  const allowedFields = action === 'read' ? rule.read : rule.write;

  if (allowedFields.includes('*')) return true;

  const hasAccess = allowedFields.includes(fieldname);

  if (hasAccess && rule.condition && document) {
    return evaluateCondition(rule.condition, document, user);
  }

  return hasAccess;
}

export function getVisibleFields(doctype: DocTypeDefinition, user: UserContext): string[] {
  const rule = doctype.field_permissions?.find((r) => user.roles.includes(r.role));

  if (!rule) return [];

  if (rule.read.includes('*')) {
    return doctype.fields.map((f) => f.fieldname);
  }

  return rule.read;
}

export function getEditableFields(doctype: DocTypeDefinition, user: UserContext): string[] {
  const rule = doctype.field_permissions?.find((r) => user.roles.includes(r.role));

  if (!rule) return [];

  if (rule.write.includes('*')) {
    return doctype.fields.filter((f) => !f.read_only).map((f) => f.fieldname);
  }

  return rule.write;
}

export function filterDocumentByFieldPermissions(
  doctype: DocTypeDefinition,
  document: Record<string, unknown>,
  user: UserContext,
): Record<string, unknown> {
  const visibleFields = getVisibleFields(doctype, user);
  const filtered: Record<string, unknown> = {};

  for (const fieldname of visibleFields) {
    if (fieldname in document) {
      filtered[fieldname] = document[fieldname];
    }
  }

  return filtered;
}

export function assertFieldPermission(
  doctype: DocTypeDefinition,
  fieldname: string,
  action: FieldPermissionAction,
  user: UserContext,
  document?: Record<string, unknown>,
): void {
  const field = doctype.fields.find((f) => f.fieldname === fieldname);
  if (!field) {
    throw new PermissionError(
      doctype.name,
      action,
      `Field "${fieldname}" not found in ${doctype.name}`,
    );
  }

  if (!hasFieldPermission(doctype, fieldname, action, user, document)) {
    throw new PermissionError(
      doctype.name,
      action,
      `You do not have permission to ${action} field "${fieldname}"`,
    );
  }
}

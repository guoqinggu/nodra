import type {
  DocTypeDefinition,
  FieldPermissionRule,
  FieldPermissionLevel,
} from '../core/doctype/schema.js';
import { PermissionError } from '../core/errors.js';
import type { UserContext } from './permission.js';

export type { FieldPermissionRule, FieldPermissionLevel };

type FieldPermissionAction = 'read' | 'write';

function getFieldPermissionRule(
  doctype: DocTypeDefinition,
  role: string,
): FieldPermissionRule | undefined {
  return doctype.field_permissions?.find((p) => p.role === role);
}

function getFieldPermlevel(fieldname: string, fieldLevels: FieldPermissionLevel[]): number {
  const fieldLevel = fieldLevels.find((f) => f.fieldname === fieldname);
  return fieldLevel?.permlevel ?? 999;
}

function isReadOnly(fieldname: string, fieldLevels: FieldPermissionLevel[]): boolean {
  const fieldLevel = fieldLevels.find((f) => f.fieldname === fieldname);
  return fieldLevel?.read_only ?? false;
}

export function hasFieldPermission(
  doctype: DocTypeDefinition,
  fieldname: string,
  action: FieldPermissionAction,
  user: UserContext,
  fieldLevels: FieldPermissionLevel[],
  document?: Record<string, unknown>,
): boolean {
  const field = doctype.fields.find((f) => f.fieldname === fieldname);
  if (!field) {
    return false;
  }

  if (action === 'write' && (field.read_only || isReadOnly(fieldname, fieldLevels))) {
    return false;
  }

  const hasFieldPermissions = doctype.field_permissions && doctype.field_permissions.length > 0;

  if (
    hasFieldPermissions &&
    (user.roles.includes('System Manager') || user.roles.includes('Admin'))
  ) {
    return true;
  }

  const fieldPermlevel = getFieldPermlevel(fieldname, fieldLevels);

  for (const role of user.roles) {
    const rule = getFieldPermissionRule(doctype, role);
    if (!rule) continue;

    if (fieldPermlevel >= rule.permlevel) {
      if (action === 'read' && rule.read) {
        return true;
      }

      if (action === 'write' && rule.write) {
        if (rule.condition && document) {
          if (evaluateCondition(rule.condition, document, user)) {
            return true;
          }
        } else {
          return true;
        }
      }
    }
  }

  return false;
}

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

export function getVisibleFields(
  doctype: DocTypeDefinition,
  user: UserContext,
  fieldLevels: FieldPermissionLevel[],
): string[] {
  return doctype.fields
    .filter((field) => hasFieldPermission(doctype, field.fieldname, 'read', user, fieldLevels))
    .map((field) => field.fieldname);
}

export function getEditableFields(
  doctype: DocTypeDefinition,
  user: UserContext,
  fieldLevels: FieldPermissionLevel[],
): string[] {
  return doctype.fields
    .filter((field) => hasFieldPermission(doctype, field.fieldname, 'write', user, fieldLevels))
    .map((field) => field.fieldname);
}

export function filterDocumentByFieldPermissions(
  doctype: DocTypeDefinition,
  document: Record<string, unknown>,
  user: UserContext,
  fieldLevels: FieldPermissionLevel[],
): Record<string, unknown> {
  const visibleFields = getVisibleFields(doctype, user, fieldLevels);
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
  fieldLevels: FieldPermissionLevel[],
): void {
  const field = doctype.fields.find((f) => f.fieldname === fieldname);
  if (!field) {
    throw new PermissionError(
      doctype.name,
      action,
      `Field "${fieldname}" not found in ${doctype.name}`,
    );
  }

  if (!hasFieldPermission(doctype, fieldname, action, user, fieldLevels)) {
    throw new PermissionError(
      doctype.name,
      action,
      `You do not have permission to ${action} field "${fieldname}"`,
    );
  }
}

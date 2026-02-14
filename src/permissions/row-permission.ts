import type { UserContext } from './permission.js';

export interface UserPermissionRule {
  doctype: string;
  field: string;
  allowed_values: string[];
  applicable_for?: string[];
  apply_to_all_doctypes?: boolean;
  permissions?: {
    read?: boolean;
    write?: boolean;
  };
}

export interface RowPermissionContext {
  doctype: string;
  action?: string;
  user: UserContext;
  document?: Record<string, unknown>;
  userPermissions?: UserPermissionRule[];
  userTerritory?: string;
  condition?: string;
  allowOwnerWrite?: boolean;
  explicitPermissions?: string[];
}

export function hasRowPermission(context: RowPermissionContext): boolean {
  const {
    user,
    document,
    userPermissions = [],
    condition,
    allowOwnerWrite,
    explicitPermissions,
  } = context;

  if (user.roles.includes('System Manager')) {
    return true;
  }

  if (explicitPermissions?.includes(String(document?.['name']))) {
    return true;
  }

  if (document) {
    if (document['owner'] === user.email) {
      if (context.action === 'write' && userPermissions.length > 0 && !allowOwnerWrite) {
        const applicablePerms = userPermissions.filter((perm) => {
          if (perm.doctype !== context.doctype && !perm.apply_to_all_doctypes) {
            return false;
          }
          if (perm.applicable_for && perm.applicable_for.length > 0) {
            const hasRole = perm.applicable_for.some((role) => user.roles.includes(role));
            if (!hasRole) {
              return false;
            }
          }
          return true;
        });

        for (const perm of applicablePerms) {
          if (perm.permissions?.write === false) {
            const docValue = document[perm.field];
            if (docValue !== undefined) {
              if (perm.allowed_values.includes('*')) {
                return false;
              }
              const value = String(docValue);
              if (perm.allowed_values.includes(value)) {
                return false;
              }
            }
          }
        }
      }

      if (allowOwnerWrite && context.action === 'write') {
        return true;
      }
      return true;
    }

    if (document['assigned_to'] === user.email) {
      return true;
    }
  }

  if (userPermissions.length === 0) {
    return false;
  }

  const applicablePerms = userPermissions.filter((perm) => {
    if (perm.doctype !== context.doctype && !perm.apply_to_all_doctypes) {
      return false;
    }
    if (perm.applicable_for && perm.applicable_for.length > 0) {
      const hasRole = perm.applicable_for.some((role) => user.roles.includes(role));
      if (!hasRole) {
        return false;
      }
    }
    return true;
  });

  if (applicablePerms.length === 0) {
    return false;
  }

  if (condition && document) {
    try {
      const result = evaluateCondition(condition, document, user, context.userTerritory);
      if (!result) {
        return false;
      }
    } catch {
      return false;
    }
  }

  for (const perm of applicablePerms) {
    if (perm.apply_to_all_doctypes) {
      const docValue = document?.[perm.field];
      if (docValue === undefined) {
        continue;
      }
    } else {
      const docValue = document?.[perm.field];
      if (docValue === undefined) {
        return false;
      }
    }

    if (perm.allowed_values.includes('*')) {
      continue;
    }

    const value = String(document?.[perm.field]);
    if (!perm.allowed_values.includes(value)) {
      return false;
    }

    if (context.action === 'write' && perm.permissions?.write === false) {
      return false;
    }
  }

  return true;
}

function evaluateCondition(
  condition: string,
  document: Record<string, unknown>,
  user: UserContext,
  userTerritory?: string,
): boolean {
  try {
    const context = {
      doc: document,
      user: { ...user, territory: userTerritory },
    };
    const keys = Object.keys(context);
    const values = Object.values(context);
    const func = new Function(...keys, `return ${condition}`);
    return func(...values);
  } catch {
    return false;
  }
}

export interface GetFilterOptions {
  doctype: string;
  user: UserContext;
  userPermissions?: UserPermissionRule[];
}

export function getRowPermissionFilter(options: GetFilterOptions): Record<string, unknown> {
  const { doctype, user, userPermissions = [] } = options;

  if (user.roles.includes('System Manager')) {
    return {};
  }

  const applicablePerms = userPermissions.filter((perm) => {
    if (perm.doctype !== doctype && !perm.apply_to_all_doctypes) {
      return false;
    }
    if (perm.applicable_for && perm.applicable_for.length > 0) {
      const hasRole = perm.applicable_for.some((role) => user.roles.includes(role));
      if (!hasRole) {
        return false;
      }
    }
    return true;
  });

  if (applicablePerms.length === 0) {
    return { name: ['in', []] };
  }

  if (applicablePerms.length === 1) {
    const perm = applicablePerms[0]!;
    if (perm.allowed_values.includes('*')) {
      return {};
    }
    return { [perm.field]: ['in', perm.allowed_values] };
  }

  const orConditions = applicablePerms.map((perm) => {
    if (perm.allowed_values.includes('*')) {
      return {};
    }
    return { [perm.field]: ['in', perm.allowed_values] };
  });

  return { or: orConditions };
}

export interface ApplyPermissionsOptions {
  documents: Record<string, unknown>[];
  doctype: string;
  user: UserContext;
  userPermissions?: UserPermissionRule[];
}

export function applyRowPermissions(options: ApplyPermissionsOptions): Record<string, unknown>[] {
  const { documents, doctype, user, userPermissions = [] } = options;

  if (user.roles.includes('System Manager')) {
    return documents;
  }

  const filteredDocs = documents.filter((doc) => doc['doctype'] === doctype);

  const filter = getRowPermissionFilter({ doctype, user, userPermissions });

  if (Object.keys(filter).length === 0) {
    return filteredDocs;
  }

  if (filter['name'] !== undefined) {
    const nameFilter = filter['name'] as string[];
    if (nameFilter[1]?.length === 0) {
      return [];
    }
  }

  return filteredDocs.filter((doc) => {
    if (doc['owner'] === user.email) {
      return true;
    }
    return matchesFilter(doc, filter);
  });
}

function matchesFilter(doc: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  if (filter['or']) {
    const conditions = filter['or'] as Record<string, unknown>[];
    return conditions.some((cond) => matchesFilter(doc, cond));
  }

  for (const [field, condition] of Object.entries(filter)) {
    if (field === 'or') continue;

    const docValue = doc[field];
    const [op, values] = condition as [string, unknown[]];

    if (op === 'in') {
      if (!Array.isArray(values) || !values.includes(docValue)) {
        return false;
      }
    }
  }

  return true;
}

export interface CheckPermissionOptions {
  user: UserContext;
  doctype: string;
  field: string;
  value: string;
  userPermissions?: UserPermissionRule[];
}

export function checkUserPermission(options: CheckPermissionOptions): boolean {
  const { user, doctype, field, value, userPermissions = [] } = options;

  if (user.roles.includes('System Manager')) {
    return true;
  }

  const applicablePerms = userPermissions.filter((perm) => {
    if (perm.doctype !== doctype && !perm.apply_to_all_doctypes) {
      return false;
    }
    if (perm.field !== field) {
      return false;
    }
    if (perm.applicable_for && perm.applicable_for.length > 0) {
      const hasRole = perm.applicable_for.some((role) => user.roles.includes(role));
      if (!hasRole) {
        return false;
      }
    }
    return true;
  });

  if (applicablePerms.length === 0) {
    return false;
  }

  for (const perm of applicablePerms) {
    if (perm.allowed_values.includes('*')) {
      return true;
    }
    if (perm.allowed_values.includes(value)) {
      return true;
    }
  }

  return false;
}

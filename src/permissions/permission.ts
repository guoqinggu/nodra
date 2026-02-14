/**
 * Permission System
 * 
 * Implements role-based access control (RBAC) with DocType-level permissions
 */

import type { DocTypeDefinition, PermissionRule } from '../core/doctype/schema.js';
import { PermissionError } from '../core/errors.js';

/**
 * Permission action types
 */
export type PermissionAction = 'read' | 'write' | 'create' | 'delete' | 'submit' | 'cancel' | 'amend';

/**
 * User context for permission checks
 */
export interface UserContext {
  email: string;
  roles: string[];
  isOwner?: boolean;
  department?: string;
}

/**
 * Check if user has permission to perform action on a DocType
 * 
 * @param doctype - DocType definition
 * @param action - Permission action to check
 * @param user - User context
 * @param documentOwner - Owner of the document (for owner-based permissions)
 * @returns True if user has permission
 */
export function hasPermission(
  doctype: DocTypeDefinition,
  action: PermissionAction,
  user: UserContext,
  documentOwner?: string
): boolean {
  // System Manager has all permissions
  if (user.roles.includes('System Manager')) {
    return true;
  }

  // Check if user is owner
  const isOwner = documentOwner ? user.email === documentOwner : false;

  // Find applicable permission rules for user's roles
  const applicablePermissions = doctype.permissions?.filter((perm) => {
    return user.roles.includes(perm.role);
  }) ?? [];

  if (applicablePermissions.length === 0) {
    return false;
  }

  // Check each applicable permission
  for (const perm of applicablePermissions) {
    // If permission requires ownership, check if user is owner
    if (perm.if_owner && !isOwner) {
      continue;
    }

    // Check the specific action
    const hasActionPermission = getPermissionForAction(perm, action);
    if (hasActionPermission) {
      return true;
    }
  }

  return false;
}

/**
 * Assert that user has permission, throw error if not
 * 
 * @param doctype - DocType definition
 * @param action - Permission action to check
 * @param user - User context
 * @param documentOwner - Owner of the document
 * @throws {PermissionError} If user doesn't have permission
 */
export function assertPermission(
  doctype: DocTypeDefinition,
  action: PermissionAction,
  user: UserContext,
  documentOwner?: string
): void {
  if (!hasPermission(doctype, action, user, documentOwner)) {
    throw new PermissionError(
      doctype.name,
      action,
      `You do not have permission to ${action} ${doctype.name}`
    );
  }
}

/**
 * Get permission value for a specific action from permission rule
 */
function getPermissionForAction(perm: PermissionRule, action: PermissionAction): boolean {
  switch (action) {
    case 'read':
      return perm.read ?? false;
    case 'write':
      return perm.write ?? false;
    case 'create':
      return perm.create ?? false;
    case 'delete':
      return perm.delete ?? false;
    case 'submit':
      return perm.submit ?? false;
    case 'cancel':
      return perm.cancel ?? false;
    case 'amend':
      return perm.amend ?? false;
    default:
      return false;
  }
}

/**
 * Get all DocTypes that user has read access to
 * 
 * @param doctypes - Array of DocType definitions
 * @param user - User context
 * @returns Array of DocType names user can read
 */
export function getAccessibleDocTypes(
  doctypes: DocTypeDefinition[],
  user: UserContext
): string[] {
  return doctypes
    .filter((doctype) => hasPermission(doctype, 'read', user))
    .map((doctype) => doctype.name);
}

/**
 * Check if user has any permission on a DocType
 * 
 * @param doctype - DocType definition
 * @param user - User context
 * @returns True if user has any permission
 */
export function hasAnyPermission(doctype: DocTypeDefinition, user: UserContext): boolean {
  const actions: PermissionAction[] = ['read', 'write', 'create', 'delete'];
  return actions.some((action) => hasPermission(doctype, action, user));
}

// ============================================================================
// Role Hierarchy
// ============================================================================

/**
 * Internal cache for role hierarchy
 */
const roleHierarchyCache = new Map<string, string[]>();

/**
 * Get all parent roles recursively
 *
 * @param roles - User's direct roles
 * @param roleHierarchy - Map of role name to parent role
 * @returns Expanded roles including all parent roles
 */
export function getRoleHierarchy(
  roles: string[],
  roleHierarchy?: Map<string, string>
): string[] {
  if (roles.length === 0) {
    return [];
  }

  // Build role hierarchy map if not provided
  const hierarchy = roleHierarchy ?? new Map<string, string>();

  const expanded = new Set<string>(roles);
  const visited = new Set<string>();

  function expandRole(role: string): void {
    if (visited.has(role)) {
      return; // Prevent circular references
    }
    visited.add(role);

    const parent = hierarchy.get(role);
    if (parent && !visited.has(parent)) {
      expanded.add(parent);
      expandRole(parent);
    }
  }

  for (const role of roles) {
    expandRole(role);
  }

  return Array.from(expanded);
}

/**
 * Clear role hierarchy cache
 */
export function clearRoleHierarchyCache(): void {
  roleHierarchyCache.clear();
}

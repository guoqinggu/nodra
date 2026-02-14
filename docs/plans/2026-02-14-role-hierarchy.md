# Role Hierarchy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement role inheritance where child roles automatically inherit permissions from parent roles.

**Architecture:** Add `parent_role` field to Role DocType, create `getRoleHierarchy` function in permission.ts to recursively expand roles, update middleware.ts to use expanded roles.

**Tech Stack:** TypeScript, PostgreSQL, Fastify

---

## Task 1: Update Role DocType JSON

**Files:**

- Modify: `doctypes/core/role/role.json`

**Step 1: Add parent_role field**

Add this field to the fields array:

```json
{
  "fieldname": "parent_role",
  "fieldtype": "Link",
  "label": "Parent Role",
  "options": "Role",
  "description": "Parent role whose permissions will be inherited"
}
```

**Step 2: Run schema sync**

Run: `pnpm build`

Expected: Build succeeds

---

## Task 2: Add getRoleHierarchy Function

**Files:**

- Modify: `src/permissions/permission.ts`

**Step 1: Add role hierarchy types**

Add after UserContext interface:

```typescript
/**
 * Role with parent relationship
 */
export interface RoleHierarchy {
  name: string;
  parent_role?: string;
  disabled?: boolean;
}
```

**Step 2: Add getRoleHierarchy function**

Add at the end of the file:

```typescript
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
export function getRoleHierarchy(roles: string[], roleHierarchy?: Map<string, string>): string[] {
  if (roles.length === 0) {
    return [];
  }

  // Build role hierarchy map if not provided
  const hierarchy = roleHierarchy ?? new Map<string, string>();

  const expanded = new Set<string>(roles);
  const visited = new Set<string>();

  function expandRole(role: string) {
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
```

**Step 3: Run typecheck**

Run: `pnpm typecheck`

Expected: No errors

---

## Task 3: Add Role Hierarchy Tests

**Files:**

- Create: `tests/unit/permissions/role-hierarchy.test.ts`

**Step 1: Write failing tests**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { getRoleHierarchy, clearRoleHierarchyCache } from '../../../src/permissions/permission.js';

describe('Role Hierarchy', () => {
  beforeEach(() => {
    clearRoleHierarchyCache();
  });

  it('should return original roles when no hierarchy', () => {
    const roles = ['Sales Manager', 'Accounts User'];
    const hierarchy = new Map<string, string>();

    const result = getRoleHierarchy(roles, hierarchy);

    expect(result).toContain('Sales Manager');
    expect(result).toContain('Accounts User');
  });

  it('should expand child role with parent role', () => {
    const roles = ['Sales Manager'];
    const hierarchy = new Map<string, string>([['Sales Manager', 'Sales User']]);

    const result = getRoleHierarchy(roles, hierarchy);

    expect(result).toContain('Sales Manager');
    expect(result).toContain('Sales User');
  });

  it('should handle multi-level hierarchy', () => {
    const roles = ['Sales Director'];
    const hierarchy = new Map<string, string>([
      ['Sales Director', 'Sales Manager'],
      ['Sales Manager', 'Sales User'],
    ]);

    const result = getRoleHierarchy(roles, hierarchy);

    expect(result).toContain('Sales Director');
    expect(result).toContain('Sales Manager');
    expect(result).toContain('Sales User');
  });

  it('should prevent circular reference infinite loop', () => {
    const roles = ['Role A'];
    const hierarchy = new Map<string, string>([
      ['Role A', 'Role B'],
      ['Role B', 'Role A'], // Circular
    ]);

    const result = getRoleHierarchy(roles, hierarchy);

    expect(result).toContain('Role A');
    expect(result).toContain('Role B');
    // Should not infinite loop
  });

  it('should handle multiple child roles', () => {
    const roles = ['Sales Manager', 'Accounts Manager'];
    const hierarchy = new Map<string, string>([
      ['Sales Manager', 'Sales User'],
      ['Accounts Manager', 'Accounts User'],
    ]);

    const result = getRoleHierarchy(roles, hierarchy);

    expect(result).toContain('Sales Manager');
    expect(result).toContain('Sales User');
    expect(result).toContain('Accounts Manager');
    expect(result).toContain('Accounts User');
  });
});
```

**Step 2: Run tests**

Run: `pnpm test -- tests/unit/permissions/role-hierarchy.test.ts`

Expected: All tests pass

---

## Task 4: Update Middleware to Use Role Hierarchy

**Files:**

- Modify: `src/api/middleware.ts`

**Step 1: Update getUserRoles function**

Replace the current `getUserRoles` function with:

```typescript
/**
 * User roles cache (in production this would come from database)
 * For now, we'll fetch from User document
 */
async function getUserRoles(orm: ORM, userEmail: string): Promise<string[]> {
  try {
    const user = await orm.getDoc('User', userEmail);

    // Get roles from user document (roles is a Table field)
    const roles = user.get('roles') as Array<{ role: string }> | undefined;

    if (!roles || roles.length === 0) {
      // Default role if no roles assigned
      return ['Guest'];
    }

    const userRoles = roles.map((r) => r.role);

    // Expand roles with hierarchy
    const roleHierarchy = await getRoleHierarchyFromDB(orm);
    return getRoleHierarchy(userRoles, roleHierarchy);
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw new AuthenticationError('User not found');
    }
    throw error;
  }
}

/**
 * Get role hierarchy from database
 */
async function getRoleHierarchyFromDB(orm: ORM): Promise<Map<string, string>> {
  const hierarchy = new Map<string, string>();

  try {
    const roles = await orm.getAllDocs('Role', { filters: { disabled: 0 } });

    for (const role of roles) {
      const parentRole = role.get('parent_role') as string | undefined;
      const roleName = role.get('role_name') as string;

      if (parentRole) {
        hierarchy.set(roleName, parentRole);
      }
    }
  } catch {
    // If Role DocType doesn't exist yet, return empty hierarchy
  }

  return hierarchy;
}
```

**Step 2: Import getRoleHierarchy**

Add import at top of file:

```typescript
import {
  hasPermission,
  type PermissionAction,
  type UserContext,
  getRoleHierarchy,
} from '../permissions/permission.js';
```

**Step 3: Run typecheck**

Run: `pnpm typecheck`

Expected: No errors

---

## Task 5: Run All Permission Tests

**Step 1: Run all permission tests**

Run: `pnpm test -- tests/unit/permissions/`

Expected: All tests pass

---

## Task 6: Commit

**Step 1: Commit changes**

```bash
git add doctypes/core/role/role.json src/permissions/permission.ts src/api/middleware.ts tests/unit/permissions/role-hierarchy.test.ts
git commit -m "feat(permissions): add role hierarchy for permission inheritance"
```

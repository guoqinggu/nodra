# Role Hierarchy System Design

## Overview

Implement role inheritance mechanism where child roles automatically inherit permissions from parent roles.

## Architecture

### 1. Role DocType Modification

Add `parent_role` field to define role hierarchy:

```json
{
  "fieldname": "parent_role",
  "fieldtype": "Link",
  "label": "Parent Role",
  "options": "Role",
  "description": "Parent role whose permissions will be inherited"
}
```

### 2. Permission Logic Update

Update `permission.ts` to expand inherited parent roles when checking permissions:

```
User Role: ["Sales Manager"]
     ↓
Query Role Doc: Sales Manager.parent_role = "Sales User"
     ↓
Expanded Roles: ["Sales Manager", "Sales User"]
     ↓
Permission Check: Check permissions for both roles
```

### 3. API Middleware Update

Update `middleware.ts` to resolve role hierarchy when fetching user roles.

## Key Functions

### New Function: getRoleHierarchy

```typescript
function getRoleHierarchy(roles: string[], cache?: Map<string, string[]>): string[] {
  // Recursively get all parent roles
  // Avoid circular references
  // Cache results for performance
}
```

### Modified: hasPermission

```typescript
// Before: user.roles.includes(perm.role)
// After: expandedRoles.includes(perm.role)
```

### Modified: getUserRoles (in middleware.ts)

```typescript
async function getUserRoles(orm: ORM, userEmail: string): Promise<string[]> {
  // Get user roles
  const userRoles = await fetchUserRoles(orm, userEmail);
  // Expand with hierarchy
  return getRoleHierarchy(userRoles);
}
```

## Implementation Order

1. Update Role DocType JSON (add parent_role field)
2. Add getRoleHierarchy function to permission.ts
3. Add role cache for performance
4. Update middleware.ts to use role hierarchy
5. Add tests for role hierarchy

## Edge Cases

- **Circular reference**: A → B → A (detect and break)
- **Multiple inheritance**: Not supported (single parent only)
- **Disabled parent**: Ignore disabled parent roles
- **Performance**: Cache role hierarchy results

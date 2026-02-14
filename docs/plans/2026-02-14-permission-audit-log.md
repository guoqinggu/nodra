# Permission Audit Log Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement permission audit logging to record all permission checks to database for security auditing.

**Architecture:** Create Permission Audit DocType, add audit logging service, integrate with permission middleware.

**Tech Stack:** TypeScript, PostgreSQL, Fastify

---

## Task 1: Create Permission Audit DocType

**Files:**

- Create: `doctypes/core/permission_audit/permission_audit.json`

**Step 1: Create DocType JSON**

```json
{
  "name": "Permission Audit",
  "module": "Core",
  "naming_rule": "datetime",
  "is_submittable": false,
  "is_child": false,
  "is_single": true,
  "is_virtual": false,
  "title_field": "name",
  "fields": [
    {
      "fieldname": "user_email",
      "fieldtype": "Data",
      "label": "User Email",
      "reqd": true,
      "in_list_view": true
    },
    {
      "fieldname": "action",
      "fieldtype": "Select",
      "label": "Action",
      "options": "read\nwrite\ncreate\ndelete\nsubmit\ncancel\namend",
      "reqd": true,
      "in_list_view": true
    },
    {
      "fieldname": "doctype",
      "fieldtype": "Data",
      "label": "DocType",
      "reqd": true,
      "in_list_view": true
    },
    {
      "fieldname": "document_name",
      "fieldtype": "Data",
      "label": "Document Name",
      "in_list_view": true
    },
    {
      "fieldname": "permission_result",
      "fieldtype": "Select",
      "label": "Result",
      "options": "Allowed\nDenied",
      "reqd": true,
      "in_list_view": true
    },
    {
      "fieldname": "ip_address",
      "fieldtype": "Data",
      "label": "IP Address",
      "in_list_view": true
    }
  ],
  "permissions": [
    {
      "role": "System Manager",
      "read": true
    }
  ]
}
```

**Step 2: Run build**

Run: `pnpm build`

Expected: Build succeeds

---

## Task 2: Create Audit Log Service

**Files:**

- Create: `src/permissions/audit-log.ts`

**Step 1: Create audit log service**

```typescript
import type { PermissionAction } from './permission.js';

export interface AuditLogEntry {
  userEmail: string;
  action: PermissionAction;
  doctype: string;
  documentName?: string;
  result: 'Allowed' | 'Denied';
  ipAddress: string;
}

export async function logPermissionCheck(entry: AuditLogEntry): Promise<void> {
  try {
    const timestamp = new Date();
    console.log(
      `[AUDIT] ${timestamp.toISOString()} | ${entry.userEmail} | ${entry.action} | ${entry.doctype} | ${entry.documentName || '-'} | ${entry.result} | ${entry.ipAddress}`,
    );
  } catch (error) {
    console.error('Failed to log permission audit:', error);
  }
}
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`

Expected: No errors in src/

---

## Task 3: Create Audit Log Tests

**Files:**

- Create: `tests/unit/permissions/audit-log.test.ts`

**Step 1: Write tests**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { logPermissionCheck } from '../../../src/permissions/audit-log.js';

describe('Permission Audit Log', () => {
  it('should log permission check with all fields', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await logPermissionCheck({
      userEmail: 'user@example.com',
      action: 'read',
      doctype: 'Task',
      documentName: 'TASK-001',
      result: 'Allowed',
      ipAddress: '192.168.1.1',
    });

    expect(consoleSpy).toHaveBeenCalled();
    const loggedMessage = consoleSpy.mock.calls[0]![0] as string;
    expect(loggedMessage).toContain('user@example.com');
    expect(loggedMessage).toContain('read');
    expect(loggedMessage).toContain('Allowed');

    consoleSpy.mockRestore();
  });

  it('should log without document name', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await logPermissionCheck({
      userEmail: 'user@example.com',
      action: 'write',
      doctype: 'Task',
      result: 'Denied',
      ipAddress: '192.168.1.1',
    });

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should not throw on logging failure', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {
      throw new Error('Logging failed');
    });

    await expect(
      logPermissionCheck({
        userEmail: 'user@example.com',
        action: 'read',
        doctype: 'Task',
        result: 'Allowed',
        ipAddress: '192.168.1.1',
      }),
    ).resolves.not.toThrow();

    consoleSpy.mockRestore();
  });
});
```

**Step 2: Run tests**

Run: `pnpm test -- tests/unit/permissions/audit-log.test.ts`

Expected: All tests pass

---

## Task 4: Integrate Audit Log with Middleware

**Files:**

- Modify: `src/api/middleware.ts`

**Step 1: Import audit log**

Add import at top of file:

```typescript
import { logPermissionCheck } from '../permissions/audit-log.js';
```

**Step 2: Add audit logging to permission check**

In `createPermissionMiddleware`, after `hasPermission` check:

```typescript
// Check permission
const hasPermission = hasPermission(doctype, action, userContext, documentOwner);

// Log permission check
await logPermissionCheck({
  userEmail: user.email,
  action,
  doctype: doctypeName,
  documentName: docName,
  result: hasPermission ? 'Allowed' : 'Denied',
  ipAddress: request.ip || 'unknown',
});

if (!hasPermission) {
  throw new PermissionError(/* ... */);
}
```

**Step 3: Run build**

Run: `pnpm build`

Expected: Build succeeds

---

## Task 5: Run All Permission Tests

**Step 1: Run permission tests**

Run: `pnpm test -- tests/unit/permissions/permission.test.ts tests/unit/permissions/audit-log.test.ts tests/unit/permissions/role-hierarchy.test.ts`

Expected: All tests pass

---

## Task 6: Commit

**Step 1: Commit changes**

```bash
git add doctypes/core/permission_audit/ src/permissions/audit-log.ts src/api/middleware.ts tests/unit/permissions/audit-log.test.ts
git commit -m "feat(permissions): add permission audit logging"
```

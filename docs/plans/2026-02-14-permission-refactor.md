# 权限系统重构 - 方案A 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将字段权限从 permlevel 数值模型改为直接关联模型，使权限配置更直观

**Architecture:**

- 新的 `FieldPermissionRule` 接口使用 `read: string[]` 和 `write: string[]` 直接列出可访问字段
- 移除 `FieldPermissionLevel` 类型（不再需要）
- 重构 `field-permission.ts` 使用数组包含检查替代数值比较

**Tech Stack:** TypeScript, Vitest

---

## Task 1: 更新类型定义

**Files:**

- Modify: `src/core/doctype/schema.ts:56-93`

**Step 1: 更新 FieldPermissionRule 接口**

将当前的：

```typescript
export interface FieldPermissionRule {
  role: string;
  permlevel: number;
  read: boolean;
  write: boolean;
  condition?: string;
}
```

改为：

```typescript
export interface FieldPermissionRule {
  role: string;
  read: string[]; // 可读字段列表，['*'] 表示所有字段
  write: string[]; // 可写字段列表，['*'] 表示所有字段
  condition?: string;
}
```

**Step 2: 删除 FieldPermissionLevel 接口**

删除：

```typescript
export interface FieldPermissionLevel {
  fieldname: string;
  permlevel: number;
  read_only?: boolean;
}
```

**Step 3: 更新 DocTypeDefinition**

将 `field_permissions` 的类型从 `FieldPermissionRule[]` 保持不变（因为接口名没变，但结构变了）

**Step 4: 运行类型检查**

Run: `pnpm typecheck 2>&1 | grep -E "schema.ts|error"`

---

## Task 2: 更新 schema 解析逻辑

**Files:**

- Modify: `src/core/doctype/schema.ts` (需要找到解析 field_permissions 的代码)

**Step 1: 找到解析代码**

Search for: `parseFieldPermissions` or `field_permissions`

**Step 2: 更新解析逻辑**

旧的解析逻辑（需要找到具体代码后确认）可能类似：

```typescript
const rawFieldPermissions = raw['field_permissions'];
if (Array.isArray(rawFieldPermissions)) {
  // 解析旧格式：{ role, permlevel, read: boolean, write: boolean }
}
```

新的解析逻辑：

```typescript
if (Array.isArray(rawFieldPermissions)) {
  const fieldPermissions = rawFieldPermissions.map((p, i) => {
    if (!isPlainObject(p)) {
      throw new ValidationError(`field_permissions[${i}] must be an object`);
    }
    const { role, read, write, condition } = p;
    if (typeof role !== 'string') {
      throw new ValidationError(`field_permissions[${i}].role must be a string`);
    }
    if (!Array.isArray(read)) {
      throw new ValidationError(`field_permissions[${i}].read must be an array`);
    }
    if (!Array.isArray(write)) {
      throw new ValidationError(`field_permissions[${i}].write must be an array`);
    }
    return { role, read, write, condition };
  });
  // ...
}
```

**Step 3: 运行测试**

Run: `pnpm vitest run tests/unit/core/doctype/schema.test.ts`

---

## Task 3: 重构 field-permission.ts

**Files:**

- Modify: `src/permissions/field-permission.ts`

**Step 1: 简化 hasFieldPermission 函数**

旧的复杂逻辑（移除）：

```typescript
const fieldPermlevel = getFieldPermlevel(fieldname, fieldLevels);

for (const role of user.roles) {
  const rule = getFieldPermissionRule(doctype, role);
  if (!rule) continue;

  if (fieldPermlevel >= rule.permlevel) {
    // 复杂判断...
  }
}
```

新的简单逻辑：

```typescript
export function hasFieldPermission(
  doctype: DocTypeDefinition,
  fieldname: string,
  action: 'read' | 'write',
  user: UserContext,
  document?: Record<string, unknown>,
): boolean {
  // 1. System Manager 和 Admin 有所有权限
  if (user.roles.includes('System Manager') || user.roles.includes('Admin')) {
    return true;
  }

  // 2. 查找用户角色的字段权限规则
  const rule = doctype.field_permissions?.find((r) => user.roles.includes(r.role));

  if (!rule) return false;

  // 3. 检查字段是否在允许列表中
  const allowedFields = action === 'read' ? rule.read : rule.write;

  if (allowedFields.includes('*')) return true;

  const hasAccess = allowedFields.includes(fieldname);

  // 4. 如果有条件，检查条件
  if (hasAccess && rule.condition && document) {
    return evaluateCondition(rule.condition, document, user);
  }

  return hasAccess;
}
```

**Step 2: 简化 getVisibleFields 函数**

```typescript
export function getVisibleFields(doctype: DocTypeDefinition, user: UserContext): string[] {
  const rule = doctype.field_permissions?.find((r) => user.roles.includes(r.role));

  if (!rule) return [];

  if (rule.read.includes('*')) {
    return doctype.fields.map((f) => f.fieldname);
  }

  return rule.read;
}
```

**Step 3: 简化 getEditableFields 函数**

类似 getVisibleFields，使用 rule.write

**Step 4: 简化 filterDocumentByFieldPermissions**

使用简化后的 getVisibleFields

**Step 5: 删除不再需要的辅助函数**

- `getFieldPermissionRule` - 改为直接在主函数中查找
- `getFieldPermlevel` - 不再需要
- `isReadOnly` - 移除 permlevel 相关的 read_only 逻辑

**Step 6: 运行测试**

Run: `pnpm vitest run tests/unit/permissions/field-permission.test.ts`

---

## Task 4: 更新导出类型

**Files:**

- Modify: `src/index.ts` (检查 FieldPermissionLevel 导出)

**Step 1: 检查并移除 FieldPermissionLevel 导出**

如果 `src/index.ts` 导出了 `FieldPermissionLevel`，需要移除

---

## Task 5: 编写新的测试

**Files:**

- Modify: `tests/unit/permissions/field-permission.test.ts`

**Step 1: 更新测试数据**

旧的测试数据：

```typescript
const fieldPermissionRules: FieldPermissionRule[] = [
  { role: 'Admin', permlevel: 0, read: true, write: true },
  { role: 'HR', permlevel: 1, read: true, write: false },
  { role: 'Manager', permlevel: 2, read: true, write: true },
  { role: 'Employee', permlevel: 2, read: true, write: false },
];

const fieldLevels: FieldPermissionLevel[] = [
  { fieldname: 'name', permlevel: 2 },
  { fieldname: 'salary', permlevel: 1 },
  { fieldname: 'ssn', permlevel: 0 },
];
```

新的测试数据：

```typescript
const fieldPermissionRules: FieldPermissionRule[] = [
  { role: 'Admin', read: ['*'], write: ['*'] },
  { role: 'HR', read: ['*'], write: ['name', 'email', 'phone', 'department', 'salary'] },
  {
    role: 'Manager',
    read: ['name', 'email', 'phone', 'department', 'notes'],
    write: ['name', 'email', 'notes'],
  },
  { role: 'Employee', read: ['name', 'email'], write: ['name'] },
];
```

**Step 2: 更新测试用例**

- 移除 `fieldLevels` 变量的使用
- 更新 `hasFieldPermission` 调用（移除 fieldLevels 参数）
- 更新 `getVisibleFields` 调用（移除 fieldLevels 参数）
- 更新 `getEditableFields` 调用（移除 fieldLevels 参数）
- 更新 `filterDocumentByFieldPermissions` 调用（移除 fieldLevels 参数）
- 更新 `assertFieldPermission` 调用（移除 fieldLevels 参数）

**Step 3: 运行测试**

Run: `pnpm vitest run tests/unit/permissions/field-permission.test.ts`

**Step 4: 验证所有测试通过**

Run: `pnpm test 2>&1 | grep -E "Test Files|Tests"`

---

## Task 6: 运行完整验证

**Step 1: 类型检查**

Run: `pnpm typecheck 2>&1 | grep -E "field-permission|error" | head -20`

**Step 2: 测试**

Run: `pnpm test 2>&1 | tail -10`

**Step 3: 构建**

Run: `pnpm build 2>&1 | tail -10`

---

## Task 7: 更新文档

**Files:**

- Modify: `docs/zh/ARCHITECTURE.md` (权限部分)
- Modify: `docs/en/ARCHITECTURE.md` (权限部分)

**Step 1: 更新权限系统文档**

添加新的字段权限配置示例：

````markdown
### 字段权限

字段权限使用直接关联模型，配置直观：

```json
{
  "field_permissions": [
    { "role": "Admin", "read": ["*"], "write": ["*"] },
    { "role": "HR", "read": ["*"], "write": ["name", "email", "department", "salary"] },
    { "role": "Employee", "read": ["name", "email"], "write": [] }
  ]
}
```
````

- `read`: 可读取的字段列表，`["*"]` 表示所有字段
- `write`: 可写入的字段列表，`["*"]` 表示所有字段
- `condition`: 可选的访问条件表达式

```

---

## 执行方式

**"Plan complete and saved to `docs/plans/2026-02-14-permission-refactor.md`.**

**Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
```

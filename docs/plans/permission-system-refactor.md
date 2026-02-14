# 权限系统重构计划

> 目标：将字段权限和角色权限分离，使权限管理更加清晰直观

---

## 当前问题分析

### 1. permlevel 混淆

当前实现使用 `permlevel` 数值来关联角色权限和字段权限：

```typescript
// 当前设计（混淆）
fieldPermissionRules: [
  { role: 'Admin', permlevel: 0, read: true, write: true },
  { role: 'HR', permlevel: 1, read: true, write: false },
];

fieldLevels: [
  { fieldname: 'salary', permlevel: 1 },
  { fieldname: 'ssn', permlevel: 0 },
];
```

**问题**：

- 开发者需要记住 permlevel 的数值含义（数字越小权限越高）
- 角色 permlevel 和字段 permlevel 必须匹配，容易配置错误
- "字段权限"和"角色权限"混为一谈

### 2. 三层权限概念混淆

| 层级         | 当前名称            | 问题                                      |
| ------------ | ------------------- | ----------------------------------------- |
| DocType 级别 | `permissions`       | 角色对文档的 CRUD 权限                    |
| 字段级别     | `field_permissions` | 角色对字段的读写权限（用 permlevel 关联） |
| 行级别       | `UserPermission`    | 基于条件的记录过滤                        |

三者概念重叠，容易混淆。

### 3. 权限检查逻辑复杂

当前 `hasFieldPermission` 需要：

1. 检查用户角色
2. 查找角色的 field_permission 规则
3. 比较 permlevel 数值
4. 评估条件表达式

---

## 重构方案

### 核心理念：分离关注点

```
┌─────────────────────────────────────────────────────────────┐
│                    权限检查流程                              │
├─────────────────────────────────────────────────────────────┤
│  1. 角色权限检查 (permissions)                              │
│     → 用户能否对文档进行 CRUD 操作？                         │
│                                                              │
│  2. 字段权限检查 (field_permissions)                        │
│     → 用户能否查看/编辑特定字段？                            │
│                                                              │
│  3. 行权限检查 (user_permissions)                           │
│     → 用户能访问哪些记录？                                   │
└─────────────────────────────────────────────────────────────┘
```

### 方案 A：直接关联模型（推荐）

**特点**：字段权限直接绑定角色，不需要 permlevel 数值

```typescript
// DocType 定义
{
  name: 'Employee',
  permissions: [
    { role: 'Admin', read: 1, write: 1, create: 1, delete: 1 },
    { role: 'HR', read: 1, write: 0, create: 0, delete: 0 },
    { role: 'Employee', read: 1, write: 0, create: 0, delete: 0, if_owner: 1 },
  ],
  field_permissions: [
    // 格式：role + read + write 数组（直接列出可访问的字段）
    { role: 'Admin', read: ['*'], write: ['*'] },
    { role: 'HR', read: ['name', 'email', 'phone', 'department', 'salary'], write: ['name', 'email', 'department'] },
    { role: 'Employee', read: ['name', 'email'], write: [] },
  ],
}
```

**优点**：

- 配置直观，不需要理解 permlevel
- 字段权限和角色权限独立定义
- 易于理解和维护

**缺点**：

- 字段多时配置较长
- 可以用通配符 `*` 简化

---

### 方案 B：权限级别模型（当前设计优化）

**特点**：保留 permlevel 概念，但明确定义其含义

```typescript
// 明确定义：permlevel 是访问级别，数字越小权限越高
// permlevel 0 = 最高权限（如财务数据）
// permlevel 1 = 中等权限（如部门数据）
// permlevel 2 = 普通权限（如公开数据）

{
  field_permissions: [
    { role: 'Admin', permlevel: 0, read: 1, write: 1 },      // 可访问所有级别
    { role: 'HR', permlevel: 1, read: 1, write: 1 },         // 可访问 permlevel >= 1
    { role: 'Employee', permlevel: 2, read: 1, write: 0 },    // 只能访问 permlevel >= 2
  ],
  fields: [
    { fieldname: 'ssn', fieldtype: 'Data', permlevel: 0 },   // 最高敏感度
    { fieldname: 'salary', fieldtype: 'Currency', permlevel: 1 },
    { fieldname: 'name', fieldtype: 'Data', permlevel: 2 },
  ]
}
```

**优点**：

- 配置简洁，适合字段敏感度分级的场景
- 与 Frappe/ERPNext 类似

**缺点**：

- 仍需要理解 permlevel 语义
- 灵活性略低

---

## 实施计划

### Phase 1：接口重构

**任务**：

- [ ] 定义新的 `FieldPermissionRule` 接口（方案 A 或 B）
- [ ] 更新 `DocTypeDefinition` 类型
- [ ] 更新 schema 解析逻辑

**交付物**：

- `src/core/doctype/schema.ts` 更新
- 类型定义文档

### Phase 2：权限检查逻辑重构

**任务**：

- [ ] 重写 `hasFieldPermission` 函数
- [ ] 移除 permlevel 比较逻辑
- [ ] 实现新的字段可见性检查

**交付物**：

- `src/permissions/field-permission.ts` 重构

### Phase 3：测试更新

**任务**：

- [ ] 更新 field-permission 测试
- [ ] 添加新场景测试
- [ ] 确保向后兼容（如果需要）

**交付物**：

- `tests/unit/permissions/field-permission.test.ts`

### Phase 4：集成和文档

**任务**：

- [ ] 更新 API 层权限检查
- [ ] 更新文档
- [ ] 迁移现有 DocType 数据（如需要）

**交付物**：

- 完整文档

---

## 向后兼容性策略

如果现有系统已有使用 permlevel 的 DocType：

1. **自动迁移**：提供迁移脚本，将旧配置转换为新格式
2. **兼容模式**：支持新旧两种配置格式，逐步废弃旧格式

---

## 预期收益

| 指标       | 当前                     | 重构后             |
| ---------- | ------------------------ | ------------------ |
| 配置可读性 | 中（需要理解 permlevel） | 高（直接列出字段） |
| 学习曲线   | 较高                     | 低                 |
| 维护成本   | 中                       | 低                 |
| 灵活性     | 高                       | 中                 |

---

## 风险与缓解

| 风险                  | 缓解措施                 |
| --------------------- | ------------------------ |
| 现有 DocType 需要迁移 | 提供自动化迁移工具       |
| API 兼容性破坏        | 渐进式变更，保持向后兼容 |
| 测试覆盖不完整        | 完整测试用例 + 集成测试  |

---

## 下一步

1. **确认方案**：选择方案 A（直接关联）或方案 B（权限级别）
2. **优先级**：确认是否立即执行或延后
3. **资源评估**：评估工作量

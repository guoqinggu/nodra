# Nodra API Reference

本文档提供 Nodra REST API 的详细参考，包括所有端点、请求格式、响应示例和错误处理。

## 目录

- [认证](#认证)
- [资源端点](#资源端点)
- [方法端点](#方法端点)
- [认证端点](#认证端点)
- [错误处理](#错误处理)
- [查询参数](#查询参数)
- [响应格式](#响应格式)

---

## 认证

Nodra API 使用基于 JWT 的认证。在大多数端点中，您需要在请求头中包含有效的会话令牌。

### 认证头

```http
Authorization: Bearer <jwt_token>
```

### 获取令牌

使用登录端点获取令牌：

```bash
curl -X POST http://localhost:3000/api/method/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your-password"
  }'
```

响应：

```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "email": "admin@example.com",
      "full_name": "Administrator",
      "user_type": "System User"
    }
  },
  "message": "Login successful"
}
```

---

## 资源端点

资源端点提供对 DocType 的标准 CRUD 操作。

### 1. 获取文档列表

```http
GET /api/resource/:doctype
```

#### 示例请求

```bash
curl -X GET "http://localhost:3000/api/resource/Todo?fields=name,title,status&filters=[[\"status\",\"=\",\"Open\"]]&order_by=creation desc&limit_page_length=20&limit_start=0" \
  -H "Authorization: Bearer <token>"
```

#### 查询参数

| 参数                | 类型   | 必需 | 描述                  | 示例                      |
| ------------------- | ------ | ---- | --------------------- | ------------------------- |
| `fields`            | string | 否   | 逗号分隔的字段列表    | `name,title,status`       |
| `filters`           | string | 否   | JSON 编码的过滤器     | `[["status","=","Open"]]` |
| `order_by`          | string | 否   | 排序表达式            | `creation desc`           |
| `limit_page_length` | number | 否   | 每页记录数 (最大 100) | `20`                      |
| `limit_start`       | number | 否   | 分页偏移量            | `0`                       |

#### 响应示例

```json
{
  "data": [
    {
      "name": "TODO-001",
      "title": "Complete project documentation",
      "status": "Open",
      "creation": "2026-02-11T10:30:00.000Z",
      "owner": "admin@example.com"
    },
    {
      "name": "TODO-002",
      "title": "Review pull requests",
      "status": "Open",
      "creation": "2026-02-11T09:15:00.000Z",
      "owner": "admin@example.com"
    }
  ],
  "message": "Successfully retrieved documents"
}
```

### 2. 获取单个文档

```http
GET /api/resource/:doctype/:name
```

#### 示例请求

```bash
curl -X GET "http://localhost:3000/api/resource/Todo/TODO-001" \
  -H "Authorization: Bearer <token>"
```

#### 响应示例

```json
{
  "data": {
    "name": "TODO-001",
    "title": "Complete project documentation",
    "status": "Open",
    "description": "Write comprehensive API documentation for Nodra framework",
    "assigned_to": "user@example.com",
    "due_date": "2026-02-15",
    "creation": "2026-02-11T10:30:00.000Z",
    "modified": "2026-02-11T10:30:00.000Z",
    "owner": "admin@example.com",
    "modified_by": "admin@example.com",
    "docstatus": 0
  },
  "message": "Document retrieved successfully"
}
```

### 3. 创建文档

```http
POST /api/resource/:doctype
```

#### 示例请求

```bash
curl -X POST "http://localhost:3000/api/resource/Todo" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "New task",
    "status": "Open",
    "description": "Complete the API documentation",
    "assigned_to": "user@example.com",
    "due_date": "2026-02-20"
  }'
```

#### 响应示例

```json
{
  "data": {
    "name": "TODO-003",
    "title": "New task",
    "status": "Open",
    "description": "Complete the API documentation",
    "assigned_to": "user@example.com",
    "due_date": "2026-02-20",
    "creation": "2026-02-11T11:45:00.000Z",
    "owner": "admin@example.com"
  },
  "message": "Document created successfully"
}
```

### 4. 更新文档

```http
PUT /api/resource/:doctype/:name
```

#### 示例请求

```bash
curl -X PUT "http://localhost:3000/api/resource/Todo/TODO-001" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated task title",
    "status": "Closed",
    "description": "API documentation completed successfully"
  }'
```

#### 响应示例

```json
{
  "data": {
    "name": "TODO-001",
    "title": "Updated task title",
    "status": "Closed",
    "description": "API documentation completed successfully",
    "modified": "2026-02-11T12:00:00.000Z",
    "modified_by": "admin@example.com"
  },
  "message": "Document updated successfully"
}
```

### 5. 删除文档

```http
DELETE /api/resource/:doctype/:name
```

#### 示例请求

```bash
curl -X DELETE "http://localhost:3000/api/resource/Todo/TODO-001" \
  -H "Authorization: Bearer <token>"
```

#### 响应示例

```json
{
  "data": null,
  "message": "Document deleted successfully"
}
```

### 6. 获取文档计数

```http
GET /api/resource/:doctype/count
```

#### 示例请求

```bash
curl -X GET "http://localhost:3000/api/resource/Todo/count?filters=[[\"status\",\"=\",\"Open\"]]" \
  -H "Authorization: Bearer <token>"
```

#### 响应示例

```json
{
  "data": 15,
  "message": "Count retrieved successfully"
}
```

### 7. 调用文档方法

```http
POST /api/resource/:doctype/:name/method/:method_name
```

#### 示例请求

```bash
curl -X POST "http://localhost:3000/api/resource/Todo/TODO-001/method/close" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

#### 响应示例

```json
{
  "data": {
    "name": "TODO-001",
    "status": "Closed",
    "modified": "2026-02-11T12:30:00.000Z"
  },
  "message": "Method executed successfully"
}
```

---

## 方法端点

方法端点允许调用白名单中的自定义方法。

```http
POST /api/method/:dotted_path
```

### 示例请求

```bash
curl -X POST "http://localhost:3000/api/method/my_app.utils.get_server_info" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"format": "detailed"}'
```

### 响应示例

```json
{
  "data": {
    "version": "1.0.0",
    "uptime": 86400,
    "active_users": 5,
    "database_size": "125.4 MB"
  },
  "message": "Method executed successfully"
}
```

---

## 认证端点

### 1. 用户登录

```http
POST /api/method/login
```

#### 请求体

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

#### 响应示例

```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "email": "user@example.com",
      "full_name": "John Doe",
      "user_type": "System User"
    }
  },
  "message": "Login successful"
}
```

### 2. 用户登出

```http
POST /api/method/logout
```

#### 请求体

```json
{}
```

#### 响应示例

```json
{
  "data": null,
  "message": "Logged out successfully"
}
```

### 3. 获取当前用户

```http
GET /api/method/get_logged_user
```

#### 响应示例

```json
{
  "data": {
    "email": "user@example.com",
    "full_name": "John Doe",
    "user_type": "System User",
    "roles": ["System Manager", "User"],
    "permissions": {
      "Todo": {
        "read": true,
        "write": true,
        "create": true,
        "delete": true
      }
    }
  },
  "message": "User retrieved successfully"
}
```

---

## 错误处理

所有错误都遵循统一的响应格式：

### 错误响应格式

```json
{
  "error": {
    "type": "ErrorType",
    "message": "Human readable error message",
    "details": [
      {
        "field": "field_name",
        "message": "Specific field error message"
      }
    ],
    "code": "ERROR_CODE",
    "timestamp": "2026-02-11T12:00:00.000Z"
  }
}
```

### 常见错误类型

| HTTP 状态码 | 错误类型            | 描述               |
| ----------- | ------------------- | ------------------ |
| 400         | ValidationError     | 字段验证失败       |
| 400         | MandatoryError      | 必填字段缺失       |
| 401         | AuthenticationError | 认证失败或令牌无效 |
| 403         | PermissionError     | 权限不足           |
| 404         | NotFoundError       | 资源不存在         |
| 409         | DuplicateError      | 唯一性约束冲突     |
| 409         | InvalidStateError   | 无效的状态转换     |
| 500         | DatabaseError       | 数据库操作失败     |

### 错误示例

#### 验证错误

```json
{
  "error": {
    "type": "ValidationError",
    "message": "Validation failed",
    "details": [
      {
        "field": "title",
        "message": "Title is required and must be less than 255 characters"
      },
      {
        "field": "due_date",
        "message": "Due date must be in the future"
      }
    ]
  }
}
```

#### 权限错误

```json
{
  "error": {
    "type": "PermissionError",
    "message": "You do not have permission to delete Todo",
    "doctype": "Todo",
    "action": "delete"
  }
}
```

#### 未找到错误

```json
{
  "error": {
    "type": "NotFoundError",
    "message": "Todo \"TODO-999\" not found",
    "doctype": "Todo",
    "docname": "TODO-999"
  }
}
```

---

## 查询参数详细说明

### 过滤器语法

过滤器使用 JSON 数组格式，每个过滤器是一个三元组：

```json
[["field_name", "operator", "value"]]
```

#### 支持的操作符

| 操作符   | 描述     | 示例                                            |
| -------- | -------- | ----------------------------------------------- |
| `=`      | 等于     | `["status", "=", "Open"]`                       |
| `!=`     | 不等于   | `["status", "!=", "Closed"]`                    |
| `>`      | 大于     | `["priority", ">", "5"]`                        |
| `>=`     | 大于等于 | `["priority", ">=", "5"]`                       |
| `<`      | 小于     | `["priority", "<", "5"]`                        |
| `<=`     | 小于等于 | `["priority", "<=", "5"]`                       |
| `like`   | 模糊匹配 | `["title", "like", "%document%"]`               |
| `in`     | 包含于   | `["status", "in", ["Open", "In Progress"]]`     |
| `not in` | 不包含于 | `["status", "not in", ["Closed", "Cancelled"]]` |

#### 复杂过滤器示例

```bash
# 多条件 AND 过滤
filters=[["status","=","Open"],["assigned_to","=","user@example.com"],["priority",">=","5"]]

# IN 操作符
filters=[["status","in",["Open","In Progress","Pending"]]

# LIKE 操作符
filters=[["title","like","%API%"]]
```

### 排序语法

```bash
order_by="field_name asc"
order_by="creation desc"
order_by="priority desc, creation asc"
```

---

## 响应格式详细说明

### 成功响应

```json
{
  "data": {
    // 响应数据，根据端点类型可以是对象、数组或基本类型
  },
  "message": "操作成功的描述信息",
  "timestamp": "2026-02-11T12:00:00.000Z"
}
```

### 分页响应

对于列表端点，响应包含额外的分页信息：

```json
{
  "data": [
    // 数据数组
  ],
  "message": "Successfully retrieved documents",
  "pagination": {
    "total": 150,
    "page_length": 20,
    "current_page": 1,
    "total_pages": 8,
    "has_next": true,
    "has_prev": false
  }
}
```

---

## 速率限制

API 实施了速率限制以防止滥用：

| 端点类型 | 限制   | 时间窗口 |
| -------- | ------ | -------- |
| 认证端点 | 10 次  | 1 分钟   |
| 资源端点 | 100 次 | 1 分钟   |
| 方法端点 | 50 次  | 1 分钟   |

### 速率限制响应头

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1641888000
```

### 速率限制错误

```json
{
  "error": {
    "type": "RateLimitError",
    "message": "Rate limit exceeded. Please try again later.",
    "retry_after": 60
  }
}
```

---

## SDK 使用示例

### JavaScript/TypeScript

```typescript
// 使用 Nodra JavaScript SDK (如果可用)
import { NodraClient } from '@nodra/sdk';

const client = new NodraClient({
  baseURL: 'http://localhost:3000',
  token: 'your-jwt-token',
});

// 获取文档列表
const todos = await client.getList('Todo', {
  filters: { status: 'Open' },
  fields: ['name', 'title', 'status'],
  limit: 20,
});

// 创建文档
const newTodo = await client.create('Todo', {
  title: 'New task',
  status: 'Open',
});
```

### Python

```python
# 使用 requests 库
import requests

headers = {
  'Authorization': 'Bearer your-token',
  'Content-Type': 'application/json'
}

# 获取文档列表
response = requests.get(
  'http://localhost:3000/api/resource/Todo',
  headers=headers
)
todos = response.json()['data']

# 创建文档
new_todo = {
  'title': 'New task',
  'status': 'Open'
}
response = requests.post(
  'http://localhost:3000/api/resource/Todo',
  headers=headers,
  json=new_todo
)
```

---

## 最佳实践

### 1. 错误处理

```javascript
try {
  const response = await fetch('/api/resource/Todo', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();

  if (response.ok) {
    console.log('Success:', data.data);
  } else {
    console.error('Error:', data.error);
  }
} catch (error) {
  console.error('Network error:', error);
}
```

### 2. 分页处理

```javascript
async function getAllTodos() {
  let allTodos = [];
  let page = 0;
  const pageSize = 50;

  while (true) {
    const response = await fetch(
      `/api/resource/Todo?limit_page_length=${pageSize}&limit_start=${page * pageSize}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = await response.json();

    allTodos = allTodos.concat(data.data);

    if (data.pagination.has_next) {
      page++;
    } else {
      break;
    }
  }

  return allTodos;
}
```

### 3. 过滤器构建

```javascript
function buildFilters(filters) {
  return Object.entries(filters).map(([field, value]) => {
    if (Array.isArray(value)) {
      return JSON.stringify([field, 'in', value]);
    }
    return JSON.stringify([field, '=', value]);
  });
}

const filterString = JSON.stringify(
  buildFilters({
    status: ['Open', 'In Progress'],
    priority: 5,
  }),
);
```

---

## 版本控制

API 版本通过 URL 路径指定：

```http
/api/v1/resource/:doctype
/api/v2/resource/:doctype
```

当前版本：v1

向后兼容性：旧版本至少维护 6 个月。

---

## 联系信息

如有 API 相关问题，请：

1. 查看 [故障排除指南](./TROUBLESHOOTING.md)
2. 搜索 [GitHub Issues](https://github.com/your-org/nodra/issues)
3. 联系开发团队：api-support@nodra.dev

---

_最后更新：2026-02-11_

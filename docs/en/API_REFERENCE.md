# Nodra API Reference

This document provides a detailed reference for the Nodra REST API, including all endpoints, request formats, response examples, and error handling.

## Table of Contents

- [Authentication](#authentication)
- [Resource Endpoints](#resource-endpoints)
- [Method Endpoints](#method-endpoints)
- [Auth Endpoints](#auth-endpoints)
- [Error Handling](#error-handling)
- [Query Parameters](#query-parameters)
- [Response Format](#response-format)

---

## Authentication

The Nodra API uses JWT-based authentication. You need to include a valid session token in the request headers for most endpoints.

### Authorization Header

```http
Authorization: Bearer <jwt_token>
```

### Getting a Token

Use the login endpoint to obtain a token:

```bash
curl -X POST http://localhost:3000/api/method/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your-password"
  }'
```

Response:

```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "email": "admin@example.com",
      "full_name": "Administrator",
      "user_type": "System User"
    }
  }
}
```

---

## Resource Endpoints

Resource endpoints provide CRUD operations for DocType instances.

### List Resources

```bash
GET /api/resource/{DocType}[?filters][&fields][&limit][&offset][&order_by]
```

#### Parameters

| Parameter  | Type    | Description                                      |
| ---------- | ------- | ------------------------------------------------ |
| `filters`  | string  | JSON-encoded filter conditions                   |
| `fields`   | string  | Comma-separated field names to return            |
| `limit`    | integer | Maximum number of results (default: 20)          |
| `offset`   | integer | Number of results to skip (default: 0)           |
| `order_by` | string  | Field name to sort by (prefix with `-` for DESC) |

#### Example

```bash
# Get all Todo items
GET /api/resource/Todo

# Get filtered Todo items
GET /api/resource/Todo?filters=[["status","=","Open"]]

# Get specific fields with pagination
GET /api/resource/Todo?fields=name,status&limit=10&offset=20
```

### Get Resource

```bash
GET /api/resource/{DocType}/{name}
```

#### Example

```bash
GET /api/resource/Todo/TODO-0001
```

### Create Resource

```bash
POST /api/resource/{DocType}
```

#### Example

```bash
curl -X POST http://localhost:3000/api/resource/Todo \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "description": "Complete API documentation",
    "status": "Open",
    "priority": "High"
  }'
```

### Update Resource

```bash
PUT /api/resource/{DocType}/{name}
```

#### Example

```bash
curl -X PUT http://localhost:3000/api/resource/Todo/TODO-0001 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "status": "Completed"
  }'
```

### Delete Resource

```bash
DELETE /api/resource/{DocType}/{name}
```

#### Example

```bash
curl -X DELETE http://localhost:3000/api/resource/Todo/TODO-0001 \
  -H "Authorization: Bearer <token>"
```

---

## Method Endpoints

Method endpoints call whitelisted controller methods.

### Call Method

```bash
POST /api/method/{method_path}
```

#### Example

```bash
curl -X POST http://localhost:3000/api/method/frappe.desk.doctype.todo.todo.get_todo_list \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "status": "Open",
    "limit": 20
  }'
```

---

## Auth Endpoints

### Login

```bash
POST /api/method/login
```

#### Request Body

```json
{
  "email": "user@example.com",
  "password": "password"
}
```

### Logout

```bash
POST /api/method/logout
```

#### Headers

```http
Authorization: Bearer <token>
```

### Get User Info

```bash
GET /api/method/frappe.auth.get_user_info
```

---

## Error Handling

API errors return structured error responses:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Field 'email' is required",
    "details": {
      "field": "email",
      "doctype": "User"
    }
  }
}
```

### Common Error Codes

| Code                | HTTP Status | Description                  |
| ------------------- | ----------- | ---------------------------- |
| `VALIDATION_ERROR`  | 400         | Request validation failed    |
| `PERMISSION_DENIED` | 403         | User doesn't have permission |
| `NOT_FOUND`         | 404         | Resource not found           |
| `SERVER_ERROR`      | 500         | Internal server error        |

---

## Query Parameters

### Filters

Filters use JSON array format: `[[field, operator, value]]`

#### Supported Operators

| Operator | Description                 |
| -------- | --------------------------- |
| `=`      | Equals                      |
| `!=`     | Not equals                  |
| `>`      | Greater than                |
| `>=`     | Greater than or equal       |
| `<`      | Less than                   |
| `<=`     | Less than or equal          |
| `like`   | Contains (case-insensitive) |
| `in`     | In list                     |
| `not in` | Not in list                 |

#### Examples

```bash
# Single condition
filters=[["status","=","Open"]]

# Multiple conditions
filters=[["status","=","Open"],["priority",">=","High"]]

# List values
filters=[["status","in",["Open","In Progress"]]]
```

### Fields

Specify which fields to return:

```bash
fields=name,status,description
```

### Sorting

```bash
# Ascending
order_by=creation

# Descending
order_by=-creation
```

---

## Response Format

### Success Response

```json
{
  "data": {
    // Response data varies by endpoint
  }
}
```

### List Response

```json
{
  "data": [
    {
      "name": "TODO-0001",
      "description": "Item 1",
      "status": "Open"
    },
    {
      "name": "TODO-0002",
      "description": "Item 2",
      "status": "Completed"
    }
  ]
}
```

### Error Response

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {}
  }
}
```

---

## Rate Limiting

API requests are rate-limited per user:

- **Default**: 1000 requests per hour
- **Burst**: 100 requests per minute

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1641024000
```

---

## Pagination

For list endpoints, use `limit` and `offset` parameters:

```bash
GET /api/resource/Todo?limit=20&offset=40
```

Response includes pagination info:

```json
{
  "data": [...],
  "pagination": {
    "total": 150,
    "limit": 20,
    "offset": 40,
    "has_more": true
  }
}
```

---

## Webhook Support

Configure webhooks to receive real-time notifications:

### Webhook Events

| Event        | Trigger            | Data              |
| ------------ | ------------------ | ----------------- |
| `doc_create` | Document created   | Document data     |
| `doc_update` | Document updated   | Before/after data |
| `doc_delete` | Document deleted   | Document data     |
| `doc_submit` | Document submitted | Document data     |
| `doc_cancel` | Document cancelled | Document data     |

### Webhook Configuration

Set webhooks via DocType configuration or API:

```json
{
  "webhooks": [
    {
      "url": "https://your-app.com/webhook",
      "events": ["doc_create", "doc_update"],
      "enabled": true
    }
  ]
}
```

---

## SDK Examples

### JavaScript/Node.js

```javascript
const NodraClient = require('@nodra/client');

const client = new NodraClient({
  baseUrl: 'http://localhost:3000',
  token: 'your-jwt-token',
});

// Get documents
const todos = await client.getResource('Todo', {
  filters: [['status', '=', 'Open']],
});

// Create document
const todo = await client.createResource('Todo', {
  description: 'New task',
  status: 'Open',
});
```

### Python

```python
import requests

class NodraClient:
    def __init__(self, base_url, token=None):
        self.base_url = base_url
        self.token = token

    def get_resource(self, doctype, **params):
        headers = {}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        response = requests.get(
            f'{self.base_url}/api/resource/{doctype}',
            params=params,
            headers=headers
        )
        return response.json()

# Usage
client = NodraClient('http://localhost:3000', token='your-token')
todos = client.get_resource('Todo', filters=[['status', '=', 'Open']])
```

---

## API Versioning

The API is versioned using URL paths:

- Current version: `/api/v1/`
- Previous versions: `/api/v1/` (no breaking changes yet)

Version information is included in response headers:

```http
API-Version: 1.0
```

---

## Testing API Endpoints

Use the built-in API documentation endpoint to test:

```bash
GET /api/docs
```

This provides an interactive API documentation interface (Swagger/OpenAPI compatible).

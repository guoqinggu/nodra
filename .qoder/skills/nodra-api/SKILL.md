# nodra-api Skill

Use this skill when working on the Nodra framework's API layer: Fastify server setup, auto-generated resource routes, whitelisted method routes, middleware, serialization, and OpenAPI generation.

## Context

Nodra uses Fastify as its HTTP framework. REST API endpoints are auto-generated from DocType definitions. Read `docs/ARCHITECTURE.md` Section 4.5 for API design and `AGENTS.md` for conventions.

## When to Use

- Setting up or modifying the Fastify server
- Implementing auto-generated CRUD resource routes
- Working on whitelisted method routes
- Implementing API middleware (auth, permissions, rate limiting)
- Working on request validation or response serialization
- Generating OpenAPI/Swagger specs
- Handling CORS, error responses, or request logging

## Key Architecture Decisions

### Fastify Server (`src/api/server.ts`)

- Fastify 5.x with TypeScript
- Plugin-based architecture
- Automatic JSON Schema validation from DocType definitions
- Request-scoped logging with correlation ID (via `request.id`)
- Graceful shutdown handling

```typescript
// Server initialization pattern
const server = Fastify({
  logger: pinoLogger,
  ajv: { customOptions: { allErrors: true } },
});

// Register plugins in order
await server.register(corsPlugin);
await server.register(authPlugin);
await server.register(resourceRoutes);
await server.register(methodRoutes);
await server.register(openapiPlugin);
```

### Resource Routes (`src/api/resource.ts`)

Auto-generated for every DocType:

```
GET    /api/resource/:doctype                  → list documents
GET    /api/resource/:doctype/:name            → get single document
POST   /api/resource/:doctype                  → create document
PUT    /api/resource/:doctype/:name            → update document
DELETE /api/resource/:doctype/:name            → delete document
GET    /api/resource/:doctype/count            → get count
```

These are NOT hardcoded per DocType. A single set of route handlers resolves the DocType from the URL parameter and delegates to the ORM.

#### List Endpoint Query Parameters

```
fields       = "name,title,status"              → column selection
filters      = [["status","=","Open"]]           → JSON filter array
or_filters   = [["status","=","Open"]]           → OR conditions
order_by     = "creation desc"                   → sort
limit_start  = 0                                 → offset
limit_page_length = 20                           → limit (max 100)
```

#### Filter Operators

```
=, !=, >, <, >=, <=, like, not like, in, not in, between, is, is not
```

Filter format: `[fieldname, operator, value]` or `{fieldname: value}` (shorthand for =)

### Method Routes (`src/api/method.ts`)

```
POST /api/method/:dotted_path     → call whitelisted function
```

Functions are registered with a `@whitelist` decorator or equivalent:

```typescript
// src/api/method.ts
export function whitelist(fn: Function) {
  methodRegistry.register(fn);
}

// Usage in app code
export const ping = whitelist(async (args: { message: string }) => {
  return { pong: args.message };
});
// Callable as: POST /api/method/my_app.api.ping
```

### Response Format

Success response:
```json
{
  "data": { ... }
}
```

List response:
```json
{
  "data": [ ... ],
  "meta": {
    "total_count": 42,
    "limit": 20,
    "offset": 0
  }
}
```

Error response:
```json
{
  "error": {
    "type": "ValidationError",
    "message": "Title is required",
    "details": [
      { "field": "title", "message": "This field is required" }
    ]
  }
}
```

### Error Handler

Fastify error handler maps NodraError subclasses to HTTP status codes:

| Error Type          | HTTP Status |
|--------------------|-------------|
| ValidationError    | 400         |
| MandatoryError     | 400         |
| AuthenticationError| 401         |
| PermissionError    | 403         |
| NotFoundError      | 404         |
| DuplicateError     | 409         |
| InvalidStateError  | 409         |
| DatabaseError      | 500         |
| Unknown Error      | 500         |

### Middleware Stack

Request processing order:
1. **CORS** - Cross-origin handling
2. **Request Logging** - Log request start with correlation ID
3. **Auth** - Authenticate user (JWT/API key/session)
4. **Rate Limiting** - Per-user/per-endpoint limits
5. **Permission** - Check DocType-level permissions
6. **Validation** - Validate request body against DocType schema
7. **Handler** - Execute the route handler
8. **Serialization** - Format response
9. **Response Logging** - Log response with timing

### Serialization (`src/api/serializer.ts`)

- Remove internal fields from response (e.g., `_previousValues`)
- Respect field-level read permissions (hide fields user can't see)
- Format dates to ISO 8601
- Convert Password fields to `***` (never expose)
- Handle child table serialization (nested arrays)

### OpenAPI Generation (`src/api/openapi.ts`)

- Auto-generate OpenAPI 3.0 spec from all registered DocTypes
- Each DocType generates request/response schemas
- Available at `/api/docs` (Swagger UI) and `/api/openapi.json`

## Implementation Guidelines

1. **Route handlers should be thin**: Extract logic to ORM/Document layer
2. **Validate at the boundary**: Use Fastify's JSON Schema validation
3. **Consistent error format**: Always return structured error objects
4. **Pagination defaults**: limit_page_length defaults to 20, max 100
5. **Content-Type**: Always `application/json`
6. **HTTP methods**: Follow REST conventions strictly
7. **Idempotency**: PUT should be idempotent, POST creates new

## Security

- All inputs validated before reaching business logic
- Rate limiting per user and per endpoint
- CORS restricted by configuration
- Request body size limit (default 1MB)
- No stack traces in production error responses
- Helmet-equivalent headers via Fastify plugin

## Testing

```bash
# Unit tests (mock ORM layer)
pnpm vitest run tests/unit/api/

# Integration tests (real server + DB)
pnpm vitest run tests/integration/api/
```

### Testing Pattern

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';

describe('Resource API - Todo', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp(); // Sets up Fastify with test DB
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should create a Todo via POST', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/resource/Todo',
      payload: { title: 'Test', status: 'Open' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data.title).toBe('Test');
  });

  it('should list Todos with filters', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/resource/Todo?filters=[["status","=","Open"]]&limit_page_length=10',
    });

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.json().data)).toBe(true);
  });
});
```

## File Locations

- Source: `src/api/`
- Middleware: `src/api/middleware/`
- Tests: `tests/unit/api/`, `tests/integration/api/`

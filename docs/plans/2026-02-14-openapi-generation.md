# OpenAPI Generation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Generate OpenAPI 3.0 schema from DocType definitions and provide Swagger UI for API documentation.

**Architecture:** Use @fastify/swagger + @fastify/swagger-ui, create DocType-to-Schema mapper, register routes in nodra.ts.

**Tech Stack:** TypeScript, Fastify, @fastify/swagger, @fastify/swagger-ui

---

## Task 1: Install Dependencies

**Files:**

- Modify: `package.json`

**Step 1: Add dependencies**

Run: `pnpm add @fastify/swagger @fastify/swagger-ui`

Expected: Dependencies installed

---

## Task 2: Create OpenAPI Generator

**Files:**

- Create: `src/api/openapi-generator.ts`

**Step 1: Create DocType to OpenAPI schema mapper**

```typescript
import type { DocTypeDefinition, FieldDefinition } from '../core/doctype/schema.js';

interface OpenAPISchema {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
}

interface OpenAPIParameter {
  name: string;
  in: string;
  required: boolean;
  schema: OpenAPISchema;
  description?: string;
}

export function convertFieldToSchema(field: FieldDefinition): OpenAPISchema {
  const schema: OpenAPISchema = { type: 'string' };

  switch (field.fieldtype) {
    case 'Data':
      schema.type = 'string';
      break;
    case 'Number':
    case 'Currency':
      schema.type = 'number';
      break;
    case 'Check':
      schema.type = 'boolean';
      break;
    case 'Date':
    case 'Datetime':
      schema.type = 'string';
      schema.format = field.fieldtype === 'Datetime' ? 'date-time' : 'date';
      break;
    case 'Text':
    case 'Small Text':
    case 'Long Text':
      schema.type = 'string';
      break;
    case 'Select':
      schema.type = 'string';
      if (field.options) {
        schema.enum = field.options.split('\n').map((opt) => opt.trim());
      }
      break;
    case 'Link':
      schema.type = 'string';
      break;
    case 'Table':
      schema.type = 'array';
      break;
    default:
      schema.type = 'string';
  }

  if (field.reqd) {
    schema.type = schema.type + (schema.type === 'object' ? '' : '');
  }

  return schema;
}

export function generateDocTypeSchema(doctype: DocTypeDefinition): OpenAPISchema {
  const properties: Record<string, OpenAPISchema> = {};
  const required: string[] = [];

  for (const field of doctype.fields ?? []) {
    properties[field.fieldname] = convertFieldToSchema(field);
    if (field.reqd) {
      required.push(field.fieldname);
    }
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 && { required }),
  };
}

export function generateCRUDRoutes(doctype: DocTypeDefinition): Record<string, unknown> {
  const basePath = `/api/resource/${doctype.name}`;
  const schema = generateDocTypeSchema(doctype);

  return {
    [`${basePath}`]: {
      get: {
        summary: `List ${doctype.name}`,
        tags: [doctype.name],
        responses: {
          '200': {
            description: `List of ${doctype.name}`,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: { $ref: `#/components/schemas/${doctype.name}` },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: `Create ${doctype.name}`,
        tags: [doctype.name],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: `#/components/schemas/${doctype.name}` },
            },
          },
        },
        responses: {
          '201': {
            description: `Created ${doctype.name}`,
          },
        },
      },
    },
    [`${basePath}/{name}`]: {
      get: {
        summary: `Get ${doctype.name} by name`,
        tags: [doctype.name],
        parameters: [
          {
            name: 'name',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: `${doctype.name} details`,
          },
        },
      },
      put: {
        summary: `Update ${doctype.name}`,
        tags: [doctype.name],
        parameters: [
          {
            name: 'name',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: `#/components/schemas/${doctype.name}` },
            },
          },
        },
        responses: {
          '200': {
            description: `Updated ${doctype.name}`,
          },
        },
      },
      delete: {
        summary: `Delete ${doctype.name}`,
        tags: [doctype.name],
        parameters: [
          {
            name: 'name',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '204': {
            description: `Deleted ${doctype.name}`,
          },
        },
      },
    },
  };
}
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`

Expected: No errors in src/

---

## Task 3: Create OpenAPI Tests

**Files:**

- Create: `tests/unit/api/openapi-generator.test.ts`

**Step 1: Write tests**

```typescript
import { describe, it, expect } from 'vitest';
import { convertFieldToSchema, generateDocTypeSchema } from '../../../src/api/openapi-generator.js';
import type { DocTypeDefinition } from '../../../src/core/doctype/schema.js';

describe('OpenAPI Generator', () => {
  describe('convertFieldToSchema', () => {
    it('should convert Data field to string schema', () => {
      const field = { fieldname: 'name', fieldtype: 'Data', label: 'Name' };
      const schema = convertFieldToSchema(field as any);
      expect(schema.type).toBe('string');
    });

    it('should convert Number field to number schema', () => {
      const field = { fieldname: 'amount', fieldtype: 'Number', label: 'Amount' };
      const schema = convertFieldToSchema(field as any);
      expect(schema.type).toBe('number');
    });

    it('should convert Check field to boolean schema', () => {
      const field = { fieldname: 'enabled', fieldtype: 'Check', label: 'Enabled' };
      const schema = convertFieldToSchema(field as any);
      expect(schema.type).toBe('boolean');
    });

    it('should convert Select field to enum schema', () => {
      const field = {
        fieldname: 'status',
        fieldtype: 'Select',
        label: 'Status',
        options: 'Open\nClosed\nPending',
      };
      const schema = convertFieldToSchema(field as any);
      expect(schema.type).toBe('string');
      expect(schema.enum).toEqual(['Open', 'Closed', 'Pending']);
    });

    it('should convert Datetime field to date-time format', () => {
      const field = { fieldname: 'created_at', fieldtype: 'Datetime', label: 'Created At' };
      const schema = convertFieldToSchema(field as any);
      expect(schema.format).toBe('date-time');
    });
  });

  describe('generateDocTypeSchema', () => {
    it('should generate schema from DocType definition', () => {
      const doctype: DocTypeDefinition = {
        name: 'Task',
        fields: [
          { fieldname: 'title', fieldtype: 'Data', label: 'Title', reqd: true },
          { fieldname: 'status', fieldtype: 'Select', label: 'Status', options: 'Open\nClosed' },
        ],
      } as any;

      const schema = generateDocTypeSchema(doctype);

      expect(schema.type).toBe('object');
      expect(schema.properties).toHaveProperty('title');
      expect(schema.properties).toHaveProperty('status');
      expect(schema.required).toContain('title');
    });
  });
});
```

**Step 2: Run tests**

Run: `pnpm test -- tests/unit/api/openapi-generator.test.ts`

Expected: All tests pass

---

## Task 4: Register Swagger in nodra.ts

**Files:**

- Modify: `src/nodra.ts`

**Step 1: Add imports**

```typescript
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
```

**Step 2: Register swagger plugin**

In `async init()` method, after `await this.initDatabase()`:

```typescript
await this.server.register(swagger, {
  openapi: {
    info: {
      title: 'Nodra API',
      description: 'Metadata-driven web framework API',
      version: '1.0.0',
    },
    servers: [{ url: `http://localhost:${this.port}` }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
});

await this.server.register(swaggerUi, {
  routePrefix: '/api/docs/ui',
});
```

**Step 3: Run build**

Run: `pnpm build`

Expected: Build succeeds

---

## Task 5: Run Tests

**Step 1: Run tests**

Run: `pnpm test -- tests/unit/api/openapi-generator.test.ts`

Expected: All tests pass

---

## Task 6: Commit

**Step 1: Commit changes**

```bash
git add package.json src/api/openapi-generator.ts src/nodra.ts tests/unit/api/openapi-generator.test.ts
git commit -m "feat(api): add OpenAPI generation and Swagger UI"
```

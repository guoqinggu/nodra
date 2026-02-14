# Advanced Query Implementation Plan (Phase 15.4)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement advanced query features: full-text search, aggregation, joins, and data export.

**Architecture:** Extend existing resource routes with search, aggregate, and export endpoints. Use PostgreSQL capabilities.

**Tech Stack:** TypeScript, PostgreSQL, Fastify

---

## Task 1: Install Dependencies

**Files:**

- Modify: `package.json`

**Step 1: Install CSV/Excel export libraries**

Run: `pnpm add json2csv xlsx`

Expected: Dependencies installed

---

## Task 2: Create Advanced Query Service

**Files:**

- Create: `src/api/advanced-query.ts`

**Step 1: Create advanced query functions**

```typescript
import type { Database } from '../database/connection.js';
import { toTableName } from '../core/doctype/naming.js';

export interface SearchOptions {
  doctype: string;
  searchText: string;
  fields?: string[];
  limit?: number;
  offset?: number;
}

export interface AggregateOptions {
  doctype: string;
  field: string;
  operation: 'count' | 'sum' | 'avg' | 'min' | 'max';
  groupBy?: string;
}

export interface ExportOptions {
  doctype: string;
  format: 'json' | 'csv' | 'xlsx';
  fields?: string[];
  filters?: Record<string, unknown>;
}

export async function fullTextSearch(db: Database, options: SearchOptions) {
  const { doctype, searchText, fields, limit = 20, offset = 0 } = options;
  const tableName = toTableName(doctype);

  const searchFields = fields || ['name'];
  const conditions = searchFields.map((f) => `${f} ILIKE $1`).join(' OR ');
  const param = `%${searchText}%`;

  const sql = `
    SELECT * FROM ${tableName}
    WHERE (${conditions})
    LIMIT $2 OFFSET $3
  `;

  const rows = await db.query(sql, [param, limit, offset]);
  return rows;
}

export async function aggregateQuery(db: Database, options: AggregateOptions) {
  const { doctype, field, operation, groupBy } = options;
  const tableName = toTableName(doctype);

  const validOps = ['count', 'sum', 'avg', 'min', 'max'];
  const op = validOps.includes(operation) ? operation : 'count';
  const aggField = op === 'count' ? '*' : field;

  let sql: string;
  if (groupBy) {
    sql = `SELECT ${groupBy}, ${op}(${aggField}) as value FROM ${tableName} GROUP BY ${groupBy}`;
  } else {
    sql = `SELECT ${op}(${aggField}) as value FROM ${tableName}`;
  }

  const rows = await db.query(sql);
  return rows;
}

export async function exportData(db: Database, options: ExportOptions) {
  const { doctype, format, fields, filters } = options;
  const tableName = toTableName(doctype);

  let sql = 'SELECT ';
  sql += fields ? fields.join(', ') : '*';
  sql += ` FROM ${tableName}`;

  const params: unknown[] = [];
  if (filters && Object.keys(filters).length > 0) {
    const conditions = Object.keys(filters).map((key, i) => {
      params.push(filters[key]);
      return `${key} = $${i + 1}`;
    });
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  const rows = await db.query(sql, params);

  switch (format) {
    case 'json':
      return JSON.stringify(rows, null, 2);
    case 'csv':
      return convertToCSV(rows);
    case 'xlsx':
      return convertToExcel(rows);
    default:
      return rows;
  }
}

function convertToCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]!);
  const rows = data.map((row) =>
    headers
      .map((h) => {
        const val = row[h];
        const str = String(val ?? '');
        return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      })
      .join(','),
  );
  return [headers.join(','), ...rows].join('\n');
}

function convertToExcel(data: Record<string, unknown>[]): Buffer {
  const XLSX = require('xlsx');
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`

Expected: No errors in src/

---

## Task 3: Add Advanced Query Tests

**Files:**

- Create: `tests/unit/api/advanced-query.test.ts`

**Step 1: Write tests**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { convertToCSV } from '../../../src/api/advanced-query.js';

describe('Advanced Query', () => {
  describe('convertToCSV', () => {
    it('should convert array to CSV string', () => {
      const data = [
        { name: 'Task 1', status: 'Open' },
        { name: 'Task 2', status: 'Closed' },
      ];
      const csv = convertToCSV(data);
      expect(csv).toContain('name,status');
      expect(csv).toContain('Task 1,Open');
      expect(csv).toContain('Task 2,Closed');
    });

    it('should handle empty array', () => {
      const csv = convertToCSV([]);
      expect(csv).toBe('');
    });

    it('should escape commas in values', () => {
      const data = [{ name: 'Task, 1', status: 'Open' }];
      const csv = convertToCSV(data);
      expect(csv).toContain('"Task, 1"');
    });

    it('should escape quotes in values', () => {
      const data = [{ name: 'Task "1"', status: 'Open' }];
      const csv = convertToCSV(data);
      expect(csv).toContain('"Task ""1"""');
    });
  });
});
```

**Step 2: Run tests**

Run: `pnpm test -- tests/unit/api/advanced-query.test.ts`

Expected: All tests pass

---

## Task 4: Register Advanced Query Routes

**Files:**

- Modify: `src/api/resource.ts`

**Step 1: Add advanced query routes**

Add after existing GET route:

```typescript
// Full-text search
server.get('/resource/:doctype/search', async (request, reply) => {
  const { doctype } = request.params as { doctype: string };
  const query = request.query as {
    search?: string;
    fields?: string;
    limit?: string;
    offset?: string;
  };

  if (!query.search) {
    return reply.status(400).send({ error: 'search parameter required' });
  }

  const fields = query.fields?.split(',').map((f) => f.trim());
  const limit = parseInt(query.limit || '20', 10);
  const offset = parseInt(query.offset || '0', 10);

  const results = await fullTextSearch(db, {
    doctype,
    searchText: query.search,
    fields,
    limit,
    offset,
  });

  return { data: results };
});

// Aggregate query
server.get('/resource/:doctype/aggregate', async (request, reply) => {
  const { doctype } = request.params as { doctype: string };
  const query = request.query as {
    field: string;
    operation: 'count' | 'sum' | 'avg' | 'min' | 'max';
    group_by?: string;
  };

  if (!query.field || !query.operation) {
    return reply.status(400).send({ error: 'field and operation required' });
  }

  const results = await aggregateQuery(db, {
    doctype,
    field: query.field,
    operation: query.operation,
    groupBy: query.group_by,
  });

  return { data: results };
});

// Export data
server.get('/resource/:doctype/export', async (request, reply) => {
  const { doctype } = request.params as { doctype: string };
  const query = request.query as {
    format: 'json' | 'csv' | 'xlsx';
    fields?: string;
    filters?: string;
  };

  if (!query.format) {
    return reply.status(400).send({ error: 'format required (json/csv/xlsx)' });
  }

  const fields = query.fields?.split(',').map((f) => f.trim());
  const filters = query.filters ? JSON.parse(query.filters) : undefined;

  const data = await exportData(db, {
    doctype,
    format: query.format,
    fields,
    filters,
  });

  const contentType = {
    json: 'application/json',
    csv: 'text/csv',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };

  reply.header('Content-Type', contentType[query.format]);
  reply.header('Content-Disposition', `attachment; filename="${doctype}.${query.format}"`);

  return data;
});
```

**Step 2: Run build**

Run: `pnpm build`

Expected: Build succeeds

---

## Task 5: Run Tests

**Step 1: Run tests**

Run: `pnpm test -- tests/unit/api/advanced-query.test.ts`

Expected: All tests pass

---

## Task 6: Commit

**Step 1: Commit changes**

```bash
git add package.json pnpm-lock.yaml src/api/advanced-query.ts src/api/resource.ts tests/unit/api/advanced-query.test.ts
git commit -m "feat(api): add advanced query features (search, aggregate, export)"
```

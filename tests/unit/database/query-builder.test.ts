import { describe, it, expect } from 'vitest';
import { QueryBuilder } from '../../../src/database/query-builder.js';
import { DatabaseError } from '../../../src/core/errors.js';

// ---------------------------------------------------------------------------
// SELECT queries
// ---------------------------------------------------------------------------

describe('QueryBuilder - SELECT', () => {
  it('should select all columns by default', () => {
    const qb = new QueryBuilder('tab_todo');
    const { sql, params } = qb.select().build();

    expect(sql).toBe('SELECT * FROM tab_todo');
    expect(params).toEqual([]);
  });

  it('should select specific columns', () => {
    const qb = new QueryBuilder('tab_todo');
    const { sql, params } = qb.select('name', 'title', 'status').build();

    expect(sql).toBe('SELECT name, title, status FROM tab_todo');
    expect(params).toEqual([]);
  });

  it('should default to SELECT * when no columns given to select()', () => {
    const qb = new QueryBuilder('tab_todo');
    const { sql } = qb.select().build();

    expect(sql).toBe('SELECT * FROM tab_todo');
  });

  // --- WHERE with = operator ---

  it('should add WHERE clause with = operator', () => {
    const qb = new QueryBuilder('tab_todo');
    const { sql, params } = qb
      .select('name', 'title')
      .where('status', '=', 'Open')
      .build();

    expect(sql).toBe('SELECT name, title FROM tab_todo WHERE status = $1');
    expect(params).toEqual(['Open']);
  });

  // --- WHERE with different operators ---

  it('should add WHERE clause with != operator', () => {
    const qb = new QueryBuilder('tab_todo');
    const { sql, params } = qb
      .select()
      .where('status', '!=', 'Closed')
      .build();

    expect(sql).toBe('SELECT * FROM tab_todo WHERE status != $1');
    expect(params).toEqual(['Closed']);
  });

  it('should add WHERE clause with > operator', () => {
    const qb = new QueryBuilder('tab_todo');
    const { sql, params } = qb
      .select()
      .where('idx', '>', 5)
      .build();

    expect(sql).toBe('SELECT * FROM tab_todo WHERE idx > $1');
    expect(params).toEqual([5]);
  });

  it('should add WHERE clause with < operator', () => {
    const qb = new QueryBuilder('tab_todo');
    const { sql, params } = qb
      .select()
      .where('idx', '<', 10)
      .build();

    expect(sql).toBe('SELECT * FROM tab_todo WHERE idx < $1');
    expect(params).toEqual([10]);
  });

  it('should add WHERE clause with >= operator', () => {
    const qb = new QueryBuilder('tab_todo');
    const { sql, params } = qb
      .select()
      .where('idx', '>=', 3)
      .build();

    expect(sql).toBe('SELECT * FROM tab_todo WHERE idx >= $1');
    expect(params).toEqual([3]);
  });

  it('should add WHERE clause with <= operator', () => {
    const qb = new QueryBuilder('tab_todo');
    const { sql, params } = qb
      .select()
      .where('idx', '<=', 7)
      .build();

    expect(sql).toBe('SELECT * FROM tab_todo WHERE idx <= $1');
    expect(params).toEqual([7]);
  });

  it('should add WHERE clause with LIKE operator', () => {
    const qb = new QueryBuilder('tab_todo');
    const { sql, params } = qb
      .select()
      .where('title', 'LIKE', '%task%')
      .build();

    expect(sql).toBe('SELECT * FROM tab_todo WHERE title LIKE $1');
    expect(params).toEqual(['%task%']);
  });

  it('should add WHERE clause with ILIKE operator', () => {
    const qb = new QueryBuilder('tab_todo');
    const { sql, params } = qb
      .select()
      .where('title', 'ILIKE', '%Task%')
      .build();

    expect(sql).toBe('SELECT * FROM tab_todo WHERE title ILIKE $1');
    expect(params).toEqual(['%Task%']);
  });

  it('should add WHERE clause with NOT LIKE operator', () => {
    const qb = new QueryBuilder('tab_todo');
    const { sql, params } = qb
      .select()
      .where('title', 'NOT LIKE', '%draft%')
      .build();

    expect(sql).toBe('SELECT * FROM tab_todo WHERE title NOT LIKE $1');
    expect(params).toEqual(['%draft%']);
  });

  // --- Multiple WHERE (AND) ---

  it('should combine multiple where clauses with AND', () => {
    const qb = new QueryBuilder('tab_todo');
    const { sql, params } = qb
      .select()
      .where('status', '=', 'Open')
      .where('assigned_to', '=', 'user@example.com')
      .build();

    expect(sql).toBe(
      'SELECT * FROM tab_todo WHERE status = $1 AND assigned_to = $2',
    );
    expect(params).toEqual(['Open', 'user@example.com']);
  });

  // --- orWhere (OR) ---

  it('should add OR condition with orWhere', () => {
    const qb = new QueryBuilder('tab_todo');
    const { sql, params } = qb
      .select()
      .where('status', '=', 'Open')
      .orWhere('status', '=', 'Pending')
      .build();

    expect(sql).toBe(
      'SELECT * FROM tab_todo WHERE status = $1 OR status = $2',
    );
    expect(params).toEqual(['Open', 'Pending']);
  });

  it('should handle mixed AND and OR conditions', () => {
    const qb = new QueryBuilder('tab_todo');
    const { sql, params } = qb
      .select()
      .where('assigned_to', '=', 'user@example.com')
      .where('status', '=', 'Open')
      .orWhere('status', '=', 'Pending')
      .build();

    expect(sql).toBe(
      'SELECT * FROM tab_todo WHERE assigned_to = $1 AND status = $2 OR status = $3',
    );
    expect(params).toEqual(['user@example.com', 'Open', 'Pending']);
  });

  // --- whereIn ---

  it('should add WHERE IN clause', () => {
    const qb = new QueryBuilder('tab_todo');
    const { sql, params } = qb
      .select()
      .whereIn('status', ['Open', 'Pending', 'In Progress'])
      .build();

    expect(sql).toBe('SELECT * FROM tab_todo WHERE status IN ($1, $2, $3)');
    expect(params).toEqual(['Open', 'Pending', 'In Progress']);
  });

  // --- whereNotIn ---

  it('should add WHERE NOT IN clause', () => {
    const qb = new QueryBuilder('tab_todo');
    const { sql, params } = qb
      .select()
      .whereNotIn('status', ['Closed', 'Cancelled'])
      .build();

    expect(sql).toBe('SELECT * FROM tab_todo WHERE status NOT IN ($1, $2)');
    expect(params).toEqual(['Closed', 'Cancelled']);
  });

  // --- whereNull ---

  it('should add WHERE IS NULL clause', () => {
    const qb = new QueryBuilder('tab_todo');
    const { sql, params } = qb
      .select()
      .whereNull('assigned_to')
      .build();

    expect(sql).toBe('SELECT * FROM tab_todo WHERE assigned_to IS NULL');
    expect(params).toEqual([]);
  });

  // --- whereNotNull ---

  it('should add WHERE IS NOT NULL clause', () => {
    const qb = new QueryBuilder('tab_todo');
    const { sql, params } = qb
      .select()
      .whereNotNull('assigned_to')
      .build();

    expect(sql).toBe('SELECT * FROM tab_todo WHERE assigned_to IS NOT NULL');
    expect(params).toEqual([]);
  });

  // --- whereBetween ---

  it('should add WHERE BETWEEN clause', () => {
    const qb = new QueryBuilder('tab_todo');
    const { sql, params } = qb
      .select()
      .whereBetween('idx', 1, 10)
      .build();

    expect(sql).toBe('SELECT * FROM tab_todo WHERE idx BETWEEN $1 AND $2');
    expect(params).toEqual([1, 10]);
  });

  it('should add WHERE BETWEEN with date values', () => {
    const from = '2025-01-01';
    const to = '2025-12-31';
    const qb = new QueryBuilder('tab_todo');
    const { sql, params } = qb
      .select()
      .whereBetween('due_date', from, to)
      .build();

    expect(sql).toBe('SELECT * FROM tab_todo WHERE due_date BETWEEN $1 AND $2');
    expect(params).toEqual([from, to]);
  });

  // --- orderBy ---

  it('should add ORDER BY ascending by default', () => {
    const qb = new QueryBuilder('tab_todo');
    const { sql, params } = qb
      .select()
      .orderBy('creation')
      .build();

    expect(sql).toBe('SELECT * FROM tab_todo ORDER BY creation ASC');
    expect(params).toEqual([]);
  });

  it('should add ORDER BY with explicit direction', () => {
    const qb = new QueryBuilder('tab_todo');
    const { sql, params } = qb
      .select()
      .orderBy('creation', 'desc')
      .build();

    expect(sql).toBe('SELECT * FROM tab_todo ORDER BY creation DESC');
    expect(params).toEqual([]);
  });

  it('should support multiple orderBy clauses', () => {
    const qb = new QueryBuilder('tab_todo');
    const { sql, params } = qb
      .select()
      .orderBy('status', 'asc')
      .orderBy('creation', 'desc')
      .build();

    expect(sql).toBe(
      'SELECT * FROM tab_todo ORDER BY status ASC, creation DESC',
    );
    expect(params).toEqual([]);
  });

  // --- limit ---

  it('should add LIMIT clause', () => {
    const qb = new QueryBuilder('tab_todo');
    const { sql, params } = qb.select().limit(20).build();

    expect(sql).toBe('SELECT * FROM tab_todo LIMIT 20');
    expect(params).toEqual([]);
  });

  // --- offset ---

  it('should add OFFSET clause', () => {
    const qb = new QueryBuilder('tab_todo');
    const { sql, params } = qb.select().offset(40).build();

    expect(sql).toBe('SELECT * FROM tab_todo OFFSET 40');
    expect(params).toEqual([]);
  });

  // --- combined select query ---

  it('should build a combined query with select + where + orderBy + limit + offset', () => {
    const qb = new QueryBuilder('tab_todo');
    const { sql, params } = qb
      .select('name', 'title', 'status')
      .where('status', '=', 'Open')
      .where('assigned_to', '=', 'admin@example.com')
      .orderBy('creation', 'desc')
      .limit(20)
      .offset(0)
      .build();

    expect(sql).toBe(
      'SELECT name, title, status FROM tab_todo WHERE status = $1 AND assigned_to = $2 ORDER BY creation DESC LIMIT 20 OFFSET 0',
    );
    expect(params).toEqual(['Open', 'admin@example.com']);
  });

  // --- params numbered correctly ---

  it('should number params correctly across different clause types', () => {
    const qb = new QueryBuilder('tab_todo');
    const { sql, params } = qb
      .select()
      .where('status', '=', 'Open')
      .whereIn('assigned_to', ['alice', 'bob'])
      .whereBetween('idx', 1, 10)
      .build();

    expect(sql).toBe(
      'SELECT * FROM tab_todo WHERE status = $1 AND assigned_to IN ($2, $3) AND idx BETWEEN $4 AND $5',
    );
    expect(params).toEqual(['Open', 'alice', 'bob', 1, 10]);
  });
});

// ---------------------------------------------------------------------------
// INSERT queries
// ---------------------------------------------------------------------------

describe('QueryBuilder - INSERT', () => {
  it('should build INSERT query with RETURNING *', () => {
    const qb = new QueryBuilder('tab_todo');
    const { sql, params } = qb
      .insert({ title: 'My Task', status: 'Open', idx: 0 })
      .build();

    expect(sql).toBe(
      'INSERT INTO tab_todo (title, status, idx) VALUES ($1, $2, $3) RETURNING *',
    );
    expect(params).toEqual(['My Task', 'Open', 0]);
  });

  it('should maintain correct param order matching column order', () => {
    const qb = new QueryBuilder('tab_todo');
    const { sql, params } = qb
      .insert({ name: 'TODO-001', owner: 'admin', title: 'First Task' })
      .build();

    expect(sql).toBe(
      'INSERT INTO tab_todo (name, owner, title) VALUES ($1, $2, $3) RETURNING *',
    );
    expect(params).toEqual(['TODO-001', 'admin', 'First Task']);
  });

  it('should handle null and undefined values in insert', () => {
    const qb = new QueryBuilder('tab_todo');
    const { sql, params } = qb
      .insert({ title: 'Test', assigned_to: null, description: undefined })
      .build();

    expect(sql).toBe(
      'INSERT INTO tab_todo (title, assigned_to, description) VALUES ($1, $2, $3) RETURNING *',
    );
    expect(params).toEqual(['Test', null, undefined]);
  });
});

// ---------------------------------------------------------------------------
// UPDATE queries
// ---------------------------------------------------------------------------

describe('QueryBuilder - UPDATE', () => {
  it('should build UPDATE query with WHERE clause', () => {
    const qb = new QueryBuilder('tab_todo');
    const { sql, params } = qb
      .update({ status: 'Closed', modified_by: 'admin' })
      .where('name', '=', 'TODO-001')
      .build();

    expect(sql).toBe(
      'UPDATE tab_todo SET status = $1, modified_by = $2 WHERE name = $3',
    );
    expect(params).toEqual(['Closed', 'admin', 'TODO-001']);
  });

  it('should throw DatabaseError if update is called without a where clause', () => {
    const qb = new QueryBuilder('tab_todo');

    expect(() => {
      qb.update({ status: 'Closed' }).build();
    }).toThrow(DatabaseError);
  });

  it('should throw with a meaningful message for update without where', () => {
    const qb = new QueryBuilder('tab_todo');

    expect(() => {
      qb.update({ status: 'Closed' }).build();
    }).toThrow(/UPDATE without a WHERE clause/);
  });

  it('should handle update with multiple where conditions', () => {
    const qb = new QueryBuilder('tab_todo');
    const { sql, params } = qb
      .update({ status: 'Closed' })
      .where('owner', '=', 'admin')
      .where('status', '=', 'Open')
      .build();

    expect(sql).toBe(
      'UPDATE tab_todo SET status = $1 WHERE owner = $2 AND status = $3',
    );
    expect(params).toEqual(['Closed', 'admin', 'Open']);
  });
});

// ---------------------------------------------------------------------------
// DELETE queries
// ---------------------------------------------------------------------------

describe('QueryBuilder - DELETE', () => {
  it('should build DELETE query with WHERE clause', () => {
    const qb = new QueryBuilder('tab_todo');
    const { sql, params } = qb
      .delete()
      .where('name', '=', 'TODO-001')
      .build();

    expect(sql).toBe('DELETE FROM tab_todo WHERE name = $1');
    expect(params).toEqual(['TODO-001']);
  });

  it('should throw DatabaseError if delete is called without a where clause', () => {
    const qb = new QueryBuilder('tab_todo');

    expect(() => {
      qb.delete().build();
    }).toThrow(DatabaseError);
  });

  it('should throw with a meaningful message for delete without where', () => {
    const qb = new QueryBuilder('tab_todo');

    expect(() => {
      qb.delete().build();
    }).toThrow(/DELETE without a WHERE clause/);
  });

  it('should handle delete with multiple where conditions', () => {
    const qb = new QueryBuilder('tab_todo');
    const { sql, params } = qb
      .delete()
      .where('owner', '=', 'admin')
      .where('docstatus', '=', 2)
      .build();

    expect(sql).toBe(
      'DELETE FROM tab_todo WHERE owner = $1 AND docstatus = $2',
    );
    expect(params).toEqual(['admin', 2]);
  });
});

// ---------------------------------------------------------------------------
// COUNT queries
// ---------------------------------------------------------------------------

describe('QueryBuilder - COUNT', () => {
  it('should build COUNT(*) query', () => {
    const qb = new QueryBuilder('tab_todo');
    const { sql, params } = qb.count().build();

    expect(sql).toBe('SELECT COUNT(*) AS count FROM tab_todo');
    expect(params).toEqual([]);
  });

  it('should build COUNT with specific column', () => {
    const qb = new QueryBuilder('tab_todo');
    const { sql, params } = qb.count('assigned_to').build();

    expect(sql).toBe('SELECT COUNT(assigned_to) AS count FROM tab_todo');
    expect(params).toEqual([]);
  });

  it('should build COUNT with WHERE clause', () => {
    const qb = new QueryBuilder('tab_todo');
    const { sql, params } = qb
      .count()
      .where('status', '=', 'Open')
      .build();

    expect(sql).toBe(
      'SELECT COUNT(*) AS count FROM tab_todo WHERE status = $1',
    );
    expect(params).toEqual(['Open']);
  });

  it('should build COUNT with column and WHERE clause', () => {
    const qb = new QueryBuilder('tab_todo');
    const { sql, params } = qb
      .count('assigned_to')
      .where('status', '=', 'Open')
      .where('docstatus', '=', 0)
      .build();

    expect(sql).toBe(
      'SELECT COUNT(assigned_to) AS count FROM tab_todo WHERE status = $1 AND docstatus = $2',
    );
    expect(params).toEqual(['Open', 0]);
  });
});

// ---------------------------------------------------------------------------
// Edge cases and method chaining
// ---------------------------------------------------------------------------

describe('QueryBuilder - Method Chaining', () => {
  it('should return the same instance for method chaining', () => {
    const qb = new QueryBuilder('tab_todo');
    const result = qb.select('name');

    expect(result).toBe(qb);
  });

  it('should return the same instance for where()', () => {
    const qb = new QueryBuilder('tab_todo');
    const result = qb.where('status', '=', 'Open');

    expect(result).toBe(qb);
  });

  it('should return the same instance for all chainable methods', () => {
    const qb = new QueryBuilder('tab_todo');

    expect(qb.select('name')).toBe(qb);
    expect(qb.where('x', '=', 1)).toBe(qb);
    expect(qb.orWhere('y', '=', 2)).toBe(qb);
    expect(qb.whereIn('z', [1])).toBe(qb);
    expect(qb.whereNotIn('z', [2])).toBe(qb);
    expect(qb.whereNull('a')).toBe(qb);
    expect(qb.whereNotNull('b')).toBe(qb);
    expect(qb.whereBetween('c', 1, 10)).toBe(qb);
    expect(qb.orderBy('d')).toBe(qb);
    expect(qb.limit(10)).toBe(qb);
    expect(qb.offset(5)).toBe(qb);
  });
});

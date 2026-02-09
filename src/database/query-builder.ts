/**
 * Nodra Framework - Query Builder
 *
 * A fluent, type-safe, parameterized SQL query builder.
 * All user-supplied values are passed through parameterized queries ($1, $2, ...)
 * to prevent SQL injection. Column and table names are identifiers and are NOT
 * parameterized.
 */

import { DatabaseError } from '../core/errors.js';

/**
 * Supported comparison operators for WHERE clauses.
 */
export type WhereOperator =
  | '='
  | '!='
  | '>'
  | '<'
  | '>='
  | '<='
  | 'LIKE'
  | 'ILIKE'
  | 'NOT LIKE';

/** The type of SQL operation the builder will produce. */
type QueryType = 'select' | 'insert' | 'update' | 'delete' | 'count';

/** A single WHERE condition. */
interface WhereClause {
  column: string;
  operator: WhereOperator;
  value: unknown;
  connector: 'AND' | 'OR';
}

/** A WHERE IN / NOT IN condition. */
interface WhereInClause {
  column: string;
  values: unknown[];
  negated: boolean;
  connector: 'AND';
}

/** A WHERE IS NULL / IS NOT NULL condition. */
interface WhereNullClause {
  column: string;
  negated: boolean;
  connector: 'AND';
}

/** A WHERE BETWEEN condition. */
interface WhereBetweenClause {
  column: string;
  from: unknown;
  to: unknown;
  connector: 'AND';
}

type Condition = WhereClause | WhereInClause | WhereNullClause | WhereBetweenClause;

/** An ORDER BY directive. */
interface OrderByClause {
  column: string;
  direction: 'ASC' | 'DESC';
}

/** The result of build(): a parameterized SQL string and its values. */
export interface BuildResult {
  sql: string;
  params: unknown[];
}

/**
 * Fluent, chainable SQL query builder that produces parameterized PostgreSQL queries.
 *
 * @example
 * ```ts
 * const { sql, params } = new QueryBuilder('tab_todo')
 *   .select('name', 'title')
 *   .where('status', '=', 'Open')
 *   .orderBy('creation', 'desc')
 *   .limit(20)
 *   .build();
 * ```
 */
export class QueryBuilder {
  private readonly table: string;
  private queryType: QueryType = 'select';
  private columns: string[] = [];
  private conditions: Condition[] = [];
  private orders: OrderByClause[] = [];
  private limitValue: number | undefined;
  private offsetValue: number | undefined;
  private insertData: Record<string, unknown> | undefined;
  private updateData: Record<string, unknown> | undefined;
  private countColumn: string | undefined;

  constructor(table: string) {
    this.table = table;
  }

  // ---------------------------------------------------------------------------
  // SELECT
  // ---------------------------------------------------------------------------

  /**
   * Set the query type to SELECT and specify columns.
   * Defaults to `*` if no columns are provided.
   */
  select(...columns: string[]): this {
    this.queryType = 'select';
    this.columns = columns;
    return this;
  }

  // ---------------------------------------------------------------------------
  // WHERE clauses
  // ---------------------------------------------------------------------------

  /**
   * Add a WHERE condition joined with AND.
   */
  where(column: string, operator: WhereOperator, value: unknown): this {
    this.conditions.push({ column, operator, value, connector: 'AND' });
    return this;
  }

  /**
   * Add a WHERE condition joined with OR.
   */
  orWhere(column: string, operator: WhereOperator, value: unknown): this {
    this.conditions.push({ column, operator, value, connector: 'OR' });
    return this;
  }

  /**
   * Add a WHERE column IN (values) condition.
   */
  whereIn(column: string, values: unknown[]): this {
    this.conditions.push({ column, values, negated: false, connector: 'AND' });
    return this;
  }

  /**
   * Add a WHERE column NOT IN (values) condition.
   */
  whereNotIn(column: string, values: unknown[]): this {
    this.conditions.push({ column, values, negated: true, connector: 'AND' });
    return this;
  }

  /**
   * Add a WHERE column IS NULL condition.
   */
  whereNull(column: string): this {
    this.conditions.push({ column, negated: false, connector: 'AND' });
    return this;
  }

  /**
   * Add a WHERE column IS NOT NULL condition.
   */
  whereNotNull(column: string): this {
    this.conditions.push({ column, negated: true, connector: 'AND' });
    return this;
  }

  /**
   * Add a WHERE column BETWEEN from AND to condition.
   */
  whereBetween(column: string, from: unknown, to: unknown): this {
    this.conditions.push({ column, from, to, connector: 'AND' });
    return this;
  }

  // ---------------------------------------------------------------------------
  // ORDER BY
  // ---------------------------------------------------------------------------

  /**
   * Add an ORDER BY clause. Defaults to ASC.
   */
  orderBy(column: string, direction: 'asc' | 'desc' = 'asc'): this {
    this.orders.push({ column, direction: direction.toUpperCase() as 'ASC' | 'DESC' });
    return this;
  }

  // ---------------------------------------------------------------------------
  // LIMIT / OFFSET
  // ---------------------------------------------------------------------------

  /**
   * Set LIMIT on the result set.
   */
  limit(count: number): this {
    this.limitValue = count;
    return this;
  }

  /**
   * Set OFFSET on the result set.
   */
  offset(count: number): this {
    this.offsetValue = count;
    return this;
  }

  // ---------------------------------------------------------------------------
  // INSERT
  // ---------------------------------------------------------------------------

  /**
   * Set the query type to INSERT with the given data.
   * Generates `INSERT INTO table (cols) VALUES ($1, $2, ...) RETURNING *`.
   */
  insert(data: Record<string, unknown>): this {
    this.queryType = 'insert';
    this.insertData = data;
    return this;
  }

  // ---------------------------------------------------------------------------
  // UPDATE
  // ---------------------------------------------------------------------------

  /**
   * Set the query type to UPDATE with the given data.
   * Requires at least one WHERE clause for safety.
   */
  update(data: Record<string, unknown>): this {
    this.queryType = 'update';
    this.updateData = data;
    return this;
  }

  // ---------------------------------------------------------------------------
  // DELETE
  // ---------------------------------------------------------------------------

  /**
   * Set the query type to DELETE.
   * Requires at least one WHERE clause for safety.
   */
  delete(): this {
    this.queryType = 'delete';
    return this;
  }

  // ---------------------------------------------------------------------------
  // COUNT
  // ---------------------------------------------------------------------------

  /**
   * Set the query type to COUNT.
   * Generates `SELECT COUNT(*) AS count FROM table` or
   * `SELECT COUNT(column) AS count FROM table`.
   */
  count(column?: string): this {
    this.queryType = 'count';
    this.countColumn = column;
    return this;
  }

  // ---------------------------------------------------------------------------
  // BUILD
  // ---------------------------------------------------------------------------

  /**
   * Build the final parameterized SQL query.
   *
   * @returns An object with `sql` (the SQL string) and `params` (the parameter values).
   * @throws {DatabaseError} If UPDATE or DELETE is attempted without a WHERE clause.
   */
  build(): BuildResult {
    switch (this.queryType) {
      case 'select':
        return this.buildSelect();
      case 'insert':
        return this.buildInsert();
      case 'update':
        return this.buildUpdate();
      case 'delete':
        return this.buildDelete();
      case 'count':
        return this.buildCount();
    }
  }

  // ---------------------------------------------------------------------------
  // Private build methods
  // ---------------------------------------------------------------------------

  private buildSelect(): BuildResult {
    const params: unknown[] = [];
    const cols = this.columns.length > 0 ? this.columns.join(', ') : '*';
    let sql = `SELECT ${cols} FROM ${this.table}`;

    sql += this.buildWhereClause(params);
    sql += this.buildOrderByClause();
    sql += this.buildLimitOffset();

    return { sql, params };
  }

  private buildInsert(): BuildResult {
    if (!this.insertData) {
      throw new DatabaseError('INSERT called without data');
    }

    const keys = Object.keys(this.insertData);
    const values = Object.values(this.insertData);
    const placeholders = keys.map((_, i) => `$${i + 1}`);

    const sql = `INSERT INTO ${this.table} (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;

    return { sql, params: values };
  }

  private buildUpdate(): BuildResult {
    if (this.conditions.length === 0) {
      throw new DatabaseError('UPDATE without a WHERE clause is not allowed for safety');
    }

    if (!this.updateData) {
      throw new DatabaseError('UPDATE called without data');
    }

    const params: unknown[] = [];
    const keys = Object.keys(this.updateData);
    const setClauses = keys.map((key) => {
      params.push(this.updateData![key]);
      return `${key} = $${params.length}`;
    });

    let sql = `UPDATE ${this.table} SET ${setClauses.join(', ')}`;
    sql += this.buildWhereClause(params);

    return { sql, params };
  }

  private buildDelete(): BuildResult {
    if (this.conditions.length === 0) {
      throw new DatabaseError('DELETE without a WHERE clause is not allowed for safety');
    }

    const params: unknown[] = [];
    let sql = `DELETE FROM ${this.table}`;
    sql += this.buildWhereClause(params);

    return { sql, params };
  }

  private buildCount(): BuildResult {
    const params: unknown[] = [];
    const countExpr = this.countColumn ? this.countColumn : '*';
    let sql = `SELECT COUNT(${countExpr}) AS count FROM ${this.table}`;

    sql += this.buildWhereClause(params);

    return { sql, params };
  }

  // ---------------------------------------------------------------------------
  // Shared clause builders
  // ---------------------------------------------------------------------------

  private buildWhereClause(params: unknown[]): string {
    if (this.conditions.length === 0) {
      return '';
    }

    const parts: string[] = [];

    for (let i = 0; i < this.conditions.length; i++) {
      const condition = this.conditions[i]!;
      let fragment: string;

      if (this.isWhereClause(condition)) {
        params.push(condition.value);
        fragment = `${condition.column} ${condition.operator} $${params.length}`;
      } else if (this.isWhereInClause(condition)) {
        const placeholders = condition.values.map((v) => {
          params.push(v);
          return `$${params.length}`;
        });
        const keyword = condition.negated ? 'NOT IN' : 'IN';
        fragment = `${condition.column} ${keyword} (${placeholders.join(', ')})`;
      } else if (this.isWhereNullClause(condition)) {
        const keyword = condition.negated ? 'IS NOT NULL' : 'IS NULL';
        fragment = `${condition.column} ${keyword}`;
      } else {
        // WhereBetweenClause
        const betweenCondition = condition as WhereBetweenClause;
        params.push(betweenCondition.from);
        const fromIdx = params.length;
        params.push(betweenCondition.to);
        const toIdx = params.length;
        fragment = `${betweenCondition.column} BETWEEN $${fromIdx} AND $${toIdx}`;
      }

      if (i === 0) {
        parts.push(fragment);
      } else {
        parts.push(`${condition.connector} ${fragment}`);
      }
    }

    return ` WHERE ${parts.join(' ')}`;
  }

  private buildOrderByClause(): string {
    if (this.orders.length === 0) {
      return '';
    }

    const clauses = this.orders.map((o) => `${o.column} ${o.direction}`);
    return ` ORDER BY ${clauses.join(', ')}`;
  }

  private buildLimitOffset(): string {
    let sql = '';
    if (this.limitValue !== undefined) {
      sql += ` LIMIT ${this.limitValue}`;
    }
    if (this.offsetValue !== undefined) {
      sql += ` OFFSET ${this.offsetValue}`;
    }
    return sql;
  }

  // ---------------------------------------------------------------------------
  // Type guards
  // ---------------------------------------------------------------------------

  private isWhereClause(c: Condition): c is WhereClause {
    return 'operator' in c && 'value' in c;
  }

  private isWhereInClause(c: Condition): c is WhereInClause {
    return 'values' in c && Array.isArray((c as WhereInClause).values);
  }

  private isWhereNullClause(c: Condition): c is WhereNullClause {
    return !('operator' in c) && !('values' in c) && !('from' in c) && 'negated' in c;
  }
}

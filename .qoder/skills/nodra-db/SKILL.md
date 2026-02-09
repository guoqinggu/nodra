# nodra-db Skill

Use this skill when working on the Nodra framework's database layer: connection management, query builder, schema synchronization, transactions, and migrations.

## Context

Nodra uses PostgreSQL as its database with the `pg` (node-postgres) driver directly. The ORM is custom-built on top of `pg` to deeply integrate with the DocType metadata system. Read `docs/ARCHITECTURE.md` Section 4.3 for database design and `AGENTS.md` for conventions.

## When to Use

- Implementing or modifying the database connection pool
- Working on the query builder
- Implementing schema sync (DocType definitions → PostgreSQL DDL)
- Working on the transaction system
- Implementing the migration system
- Optimizing database queries
- Adding new SQL generation logic

## Key Architecture Decisions

### Connection Management (`src/database/connection.ts`)

- Uses `pg.Pool` for connection pooling
- Configurable pool: min/max connections, idle timeout, connection timeout
- Health check via `SELECT 1`
- Graceful shutdown: drain pool, wait for active queries
- Single pool per Nodra application instance

```typescript
interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  pool: {
    min: number;           // Default: 2
    max: number;           // Default: 10
    idleTimeoutMillis: number;  // Default: 30000
  };
}
```

### Query Builder (`src/database/query-builder.ts`)

Fluent API that generates parameterized SQL:

```typescript
// All user values go through $1, $2, etc. parameterization
// NEVER concatenate user input into SQL strings

const qb = new QueryBuilder('tab_todo')
  .select('name', 'title', 'status')
  .where('status', '=', 'Open')           // $1
  .where('owner', '=', currentUser)        // $2
  .orderBy('creation', 'desc')
  .limit(20)                               // $3
  .offset(0);                              // $4

const { sql, params } = qb.build();
// sql:    SELECT name, title, status FROM tab_todo WHERE status = $1 AND owner = $2 ORDER BY creation DESC LIMIT $3 OFFSET $4
// params: ['Open', currentUser, 20, 0]
```

Supported operations:
- SELECT with column selection
- WHERE with operators: =, !=, >, <, >=, <=, LIKE, ILIKE, IN, NOT IN, BETWEEN, IS NULL, IS NOT NULL
- AND / OR grouping
- ORDER BY (multiple columns)
- LIMIT / OFFSET
- INSERT with RETURNING
- UPDATE with WHERE
- DELETE with WHERE
- COUNT, SUM, AVG aggregates

### Table Naming

- DocType name to table: `tab_` + snake_case(name)
- `Todo` → `tab_todo`
- `Sales Invoice` → `tab_sales_invoice`
- `Sales Invoice Item` → `tab_sales_invoice_item`

### Schema Sync (`src/database/schema-sync.ts`)

Compares DocType definitions with actual database schema and generates DDL:

1. **Introspect**: Query `information_schema` to get current table structure
2. **Compare**: Diff DocType fields vs database columns
3. **Generate**: Produce CREATE TABLE or ALTER TABLE statements
4. **Execute**: Run DDL within a transaction

Rules:
- New DocType → CREATE TABLE with all fields + standard columns + indexes
- New field → ALTER TABLE ADD COLUMN
- Field type change → ALTER TABLE ALTER COLUMN TYPE (with USING cast)
- Field removed → DO NOT drop column (safety, log warning instead)
- New index → CREATE INDEX IF NOT EXISTS
- Removed index → DROP INDEX IF EXISTS

### Standard Columns (auto-added to every table)

```sql
name        VARCHAR(255) PRIMARY KEY,
owner       VARCHAR(255) NOT NULL,
creation    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
modified    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
modified_by VARCHAR(255) NOT NULL,
docstatus   SMALLINT NOT NULL DEFAULT 0,
idx         INTEGER NOT NULL DEFAULT 0
```

### Child Table Extra Columns

```sql
parent      VARCHAR(255) NOT NULL,
parenttype  VARCHAR(255) NOT NULL,
parentfield VARCHAR(255) NOT NULL
```

### Field Type → PostgreSQL Type Mapping

```typescript
const PG_TYPE_MAP: Record<FieldType, string> = {
  'Data':        'VARCHAR(255)',    // or custom max_length
  'Int':         'INTEGER',
  'Float':       'DOUBLE PRECISION',
  'Currency':    'NUMERIC(18,6)',
  'Date':        'DATE',
  'Datetime':    'TIMESTAMPTZ',
  'Time':        'TIME',
  'Text':        'TEXT',
  'LongText':    'TEXT',
  'SmallText':   'TEXT',
  'Check':       'BOOLEAN',
  'Select':      'VARCHAR(255)',
  'Link':        'VARCHAR(255)',
  'DynamicLink': 'VARCHAR(255)',
  'Attach':      'TEXT',
  'AttachImage': 'TEXT',
  'Color':       'VARCHAR(7)',
  'JSON':        'JSONB',
  'Password':    'TEXT',
  'HTML':        'TEXT',
};
```

### Transaction Support (`src/database/transaction.ts`)

```typescript
// Wrapper around pg client checkout + BEGIN/COMMIT/ROLLBACK
await db.transaction(async (trx) => {
  await trx.query('INSERT INTO tab_todo (name, title) VALUES ($1, $2)', ['T1', 'Task']);
  await trx.query('UPDATE tab_counter SET value = value + 1 WHERE name = $1', ['todo']);
  // auto-rollback if any query throws
});
```

### Migration System (`src/migration/`)

- Migrations stored in `migrations/` directory as TypeScript files
- Migration state tracked in `tab__migration` table
- Each migration has `up()` and `down()` methods
- Schema diff can auto-generate migration files
- Data migrations are separate from schema migrations

## Security Rules

- **ALWAYS use parameterized queries** ($1, $2, etc.)
- **NEVER concatenate** user input into SQL strings
- **NEVER use** string interpolation for SQL values
- **Validate** identifiers (table names, column names) against a whitelist
- **Use** `pg.escapeLiteral()` and `pg.escapeIdentifier()` only for dynamic identifiers (table/column names), never for values

## Testing

```bash
# Unit tests (mock pg)
pnpm vitest run tests/unit/database/

# Integration tests (real PostgreSQL)
pnpm vitest run tests/integration/database/
```

### Integration Test Setup

Integration tests need a running PostgreSQL instance. Use environment variables:

```bash
TEST_DB_HOST=localhost
TEST_DB_PORT=5432
TEST_DB_NAME=nodra_test
TEST_DB_USER=postgres
TEST_DB_PASSWORD=postgres
```

## File Locations

- Source: `src/database/`, `src/migration/`
- Tests: `tests/unit/database/`, `tests/integration/database/`
- Migrations: `migrations/`

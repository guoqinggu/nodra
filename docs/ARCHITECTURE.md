# Nodra Framework - Architecture Design

## 1. Overview

Nodra is a metadata-driven full-stack web framework built on Node.js + TypeScript + PostgreSQL, inspired by [Frappe Framework](https://frappeframework.com/). Its core philosophy is: **everything is a DocType**, and the framework auto-generates database schemas, REST APIs, validation rules, and permission checks from metadata definitions.

### Core Principles

- **Metadata-Driven**: DocType JSON definitions are the single source of truth
- **Convention over Configuration**: sensible defaults, minimal boilerplate
- **Auto-Generation**: database tables, REST APIs, validation from DocType definitions
- **Lifecycle Hooks**: extensible document lifecycle via hooks and events
- **Multi-App Architecture**: applications built as installable apps on top of the framework
- **Type Safety**: full TypeScript with strict mode

### Tech Stack

| Component       | Choice                     | Rationale                                      |
|----------------|----------------------------|-------------------------------------------------|
| Runtime        | Node.js 20+ (ESM)         | LTS, native ESM support                        |
| Language       | TypeScript 5.x (strict)   | Type safety, developer experience              |
| HTTP Framework | Fastify 5.x               | High performance, plugin architecture, JSON Schema |
| Database       | PostgreSQL 15+             | JSONB, advanced indexing, reliability           |
| DB Driver      | pg (node-postgres)         | Mature, low-level control for custom ORM       |
| Testing        | Vitest                     | Fast, ESM-native, TypeScript-first             |
| Package Mgr    | pnpm                       | Efficient, workspace support                   |
| Build          | tsup                       | Fast TypeScript bundling, ESM output           |

---

## 2. Core Concepts

### 2.1 DocType

DocType is the central abstraction in Nodra, equivalent to a "model" in traditional ORMs but richer. A DocType definition includes:

- **Schema**: field definitions with types, constraints, and options
- **Behavior**: naming rules, workflow states, permissions
- **Presentation hints**: field ordering, sections, visibility

```jsonc
// doctypes/core/todo/todo.json
{
  "name": "Todo",
  "module": "Core",
  "naming_rule": "autoincrement",
  "is_submittable": false,
  "is_child": false,
  "fields": [
    {
      "fieldname": "title",
      "fieldtype": "Data",
      "label": "Title",
      "reqd": true,
      "max_length": 255
    },
    {
      "fieldname": "status",
      "fieldtype": "Select",
      "label": "Status",
      "options": ["Open", "Closed"],
      "default": "Open"
    },
    {
      "fieldname": "assigned_to",
      "fieldtype": "Link",
      "label": "Assigned To",
      "options": "User"
    },
    {
      "fieldname": "description",
      "fieldtype": "Text",
      "label": "Description"
    },
    {
      "fieldname": "due_date",
      "fieldtype": "Date",
      "label": "Due Date"
    }
  ],
  "permissions": [
    { "role": "System Manager", "read": true, "write": true, "create": true, "delete": true },
    { "role": "All", "read": true, "write": true, "create": true }
  ]
}
```

### 2.2 Document

A Document is a runtime instance of a DocType (one row in the database). The Document class provides:

- Lifecycle hooks: `beforeValidate`, `validate`, `beforeSave`, `afterSave`, `beforeInsert`, `afterInsert`, `beforeSubmit`, `afterSubmit`, `beforeCancel`, `afterCancel`, `beforeDelete`, `afterDelete`, `onChange`
- Dirty tracking: detect changed fields
- Child document management: table fields
- Controller pattern: custom logic via TypeScript classes

```typescript
// doctypes/core/todo/todo.ts (optional controller)
import { Document } from 'nodra';

export class Todo extends Document {
  async validate() {
    if (this.status === 'Closed' && !this.title) {
      throw new ValidationError('Title is required to close a Todo');
    }
  }

  async afterSave() {
    if (this.hasChanged('status') && this.status === 'Closed') {
      await this.notify('assigned_to', 'Todo Closed', `${this.title} has been closed`);
    }
  }
}
```

### 2.3 Field Types

| FieldType    | PostgreSQL Type        | Description                           |
|-------------|------------------------|---------------------------------------|
| Data        | VARCHAR(n)             | Short text, configurable max_length   |
| Int         | INTEGER                | Integer number                        |
| Float       | DOUBLE PRECISION       | Floating point number                 |
| Currency    | NUMERIC(18,6)          | Precise decimal for money             |
| Date        | DATE                   | Date without time                     |
| Datetime    | TIMESTAMPTZ            | Date with time and timezone           |
| Time        | TIME                   | Time only                             |
| Text        | TEXT                   | Multi-line text                       |
| LongText    | TEXT                   | Long multi-line text                  |
| SmallText   | TEXT                   | Small text area                       |
| Check       | BOOLEAN                | Checkbox (true/false)                 |
| Select      | VARCHAR(255)           | Dropdown selection                    |
| Link        | VARCHAR(255)           | Foreign key reference to another DocType |
| DynamicLink | VARCHAR(255)           | Dynamic foreign key (doctype in another field) |
| Table       | (child table)          | One-to-many child documents           |
| Attach      | TEXT                   | File attachment URL                   |
| AttachImage | TEXT                   | Image attachment URL                  |
| Color       | VARCHAR(7)             | Color hex code                        |
| JSON        | JSONB                  | Arbitrary JSON data                   |
| Password    | TEXT                   | Hashed password field                 |
| ReadOnly    | (computed)             | Read-only computed field              |
| HTML        | TEXT                   | HTML content                          |

### 2.4 Naming Rules

Documents support multiple naming strategies:

- **autoincrement**: PostgreSQL SERIAL/BIGSERIAL
- **hash**: Random hash (e.g., `a1b2c3d4e5`)
- **field**: Based on a field value (e.g., use `title` as name)
- **format**: Format string (e.g., `TODO-{####}` => `TODO-0001`)
- **prompt**: User provides the name
- **expression**: Custom TypeScript expression

---

## 3. Module Architecture

### 3.1 Directory Structure

```
nodra/
├── src/
│   ├── core/                    # Core framework internals
│   │   ├── doctype/             # DocType metadata system
│   │   │   ├── doctype.ts       # DocType class & registry
│   │   │   ├── field.ts         # Field definitions & types
│   │   │   ├── loader.ts        # DocType JSON loader
│   │   │   ├── schema.ts        # Schema parsing & validation
│   │   │   └── naming.ts        # Naming rule implementations
│   │   ├── document/            # Document runtime
│   │   │   ├── document.ts      # Base Document class
│   │   │   ├── lifecycle.ts     # Lifecycle hook manager
│   │   │   ├── dirty.ts         # Change tracking
│   │   │   └── children.ts      # Child document handling
│   │   ├── validation/          # Validation engine
│   │   │   ├── validator.ts     # Core validator
│   │   │   ├── rules.ts         # Built-in validation rules
│   │   │   └── link.ts          # Link field validation
│   │   └── errors.ts            # Framework error types
│   ├── database/                # Database layer
│   │   ├── connection.ts        # Connection pool management
│   │   ├── query-builder.ts     # Type-safe query builder
│   │   ├── schema-sync.ts       # Auto-sync DB schema from DocTypes
│   │   ├── migration.ts         # Migration runner
│   │   ├── transaction.ts       # Transaction wrapper
│   │   └── types.ts             # Database type definitions
│   ├── orm/                     # ORM operations
│   │   ├── crud.ts              # insert, get, getList, setValue, delete
│   │   ├── filters.ts           # Filter parsing & SQL generation
│   │   ├── pagination.ts        # Offset/cursor pagination
│   │   └── aggregate.ts         # count, sum, exists, getValue
│   ├── api/                     # REST API layer
│   │   ├── resource.ts          # Auto-generated resource routes
│   │   ├── method.ts            # Whitelisted method routes
│   │   ├── serializer.ts        # Response serialization
│   │   ├── middleware/           # API middleware
│   │   │   ├── auth.ts          # Authentication middleware
│   │   │   ├── permission.ts    # Permission check middleware
│   │   │   └── rate-limit.ts    # Rate limiting
│   │   └── openapi.ts           # OpenAPI spec generation
│   ├── auth/                    # Authentication
│   │   ├── user.ts              # User management
│   │   ├── session.ts           # Session handling (JWT)
│   │   ├── password.ts          # Password hashing (argon2)
│   │   └── api-key.ts           # API key authentication
│   ├── permissions/             # Permission system
│   │   ├── role.ts              # Role definitions
│   │   ├── docperm.ts           # DocType-level permissions
│   │   ├── userperm.ts          # User-level permissions
│   │   ├── fieldperm.ts         # Field-level permissions
│   │   └── query.ts             # Permission query builder
│   ├── workflow/                # Workflow engine
│   │   ├── workflow.ts          # Workflow definition & runner
│   │   ├── state.ts             # State machine
│   │   └── transition.ts        # Transition rules
│   ├── hooks/                   # Hook system
│   │   ├── registry.ts          # Hook registry
│   │   ├── app-hooks.ts         # App-level hooks
│   │   └── doc-hooks.ts         # Document event hooks
│   ├── events/                  # Event system
│   │   ├── emitter.ts           # Event emitter
│   │   └── types.ts             # Event type definitions
│   ├── jobs/                    # Background jobs
│   │   ├── queue.ts             # Job queue (pg-based)
│   │   ├── scheduler.ts         # Cron-like scheduler
│   │   └── worker.ts            # Job worker
│   ├── realtime/                # Real-time communications
│   │   ├── socket.ts            # WebSocket server
│   │   ├── publish.ts           # Publish events
│   │   └── subscribe.ts         # Subscription management
│   ├── files/                   # File management
│   │   ├── upload.ts            # Upload handling
│   │   ├── storage.ts           # Storage backends
│   │   └── optimize.ts          # Image optimization
│   ├── report/                  # Reporting
│   │   ├── query-report.ts      # SQL-based reports
│   │   └── script-report.ts     # Script-based reports
│   ├── cli/                     # CLI commands
│   │   ├── index.ts             # CLI entry point
│   │   ├── new-site.ts          # Create new site
│   │   ├── new-app.ts           # Scaffold new app
│   │   ├── migrate.ts           # Run migrations
│   │   ├── console.ts           # Interactive REPL
│   │   └── start.ts             # Start dev server
│   ├── app/                     # App system
│   │   ├── app.ts               # App loader & lifecycle
│   │   ├── installer.ts         # App install/uninstall
│   │   └── registry.ts          # App registry
│   ├── migration/               # Migration system
│   │   ├── differ.ts            # Schema diff engine
│   │   ├── generator.ts         # Migration SQL generation
│   │   └── runner.ts            # Migration execution
│   ├── utils/                   # Shared utilities
│   │   ├── logger.ts            # Structured logging
│   │   ├── cache.ts             # In-memory / Redis cache
│   │   ├── string.ts            # String utilities
│   │   └── date.ts              # Date utilities
│   ├── nodra.ts                 # Main Nodra class (application singleton)
│   └── index.ts                 # Public API exports
├── doctypes/                    # Built-in core DocTypes
│   └── core/
│       ├── doctype/
│       │   └── doctype.json     # Meta-DocType (DocType for DocTypes)
│       ├── docfield/
│       │   └── docfield.json    # DocField child DocType
│       ├── docperm/
│       │   └── docperm.json     # DocPerm child DocType
│       ├── user/
│       │   ├── user.json
│       │   └── user.ts
│       ├── role/
│       │   └── role.json
│       ├── user_role/
│       │   └── user_role.json
│       ├── module/
│       │   └── module.json
│       ├── file/
│       │   ├── file.json
│       │   └── file.ts
│       ├── workflow/
│       │   └── workflow.json
│       ├── workflow_state/
│       │   └── workflow_state.json
│       └── workflow_transition/
│           └── workflow_transition.json
├── tests/
│   ├── unit/                    # Unit tests (no DB)
│   ├── integration/             # Integration tests (with DB)
│   ├── fixtures/                # Test DocTypes and data
│   └── helpers/                 # Test utilities
├── docs/
│   ├── ARCHITECTURE.md          # This file
│   └── ROADMAP.md               # Development roadmap
├── AGENTS.md                    # Multi-agent development guide
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── .gitignore
```

### 3.2 Module Dependency Graph

```
CLI ──> App System ──> Hooks ──> Events
                         │
API (Fastify) ──> Permissions ──> Auth
      │                 │
      ▼                 ▼
  Serializer      Permission Query
      │                 │
      ▼                 ▼
    ORM ──────────> Document ──> Validation
      │                 │
      ▼                 ▼
  Query Builder    DocType (Metadata)
      │                 │
      ▼                 ▼
   Database       DocType Loader
      │
      ▼
  pg (node-postgres)
      │
      ▼
   PostgreSQL

Workflow ──> Document (lifecycle hooks)
Jobs ──> ORM + Events
Realtime ──> Events + WebSocket
Files ──> ORM + Storage
Reports ──> Query Builder + ORM
Migration ──> Schema Sync + DocType
```

---

## 4. Detailed Module Design

### 4.1 DocType System (`src/core/doctype/`)

The DocType system is the foundation of Nodra. DocTypes are defined as JSON files and loaded at boot time into an in-memory registry.

**DocType Registry**: A singleton that holds all loaded DocType definitions, provides lookup by name, and handles DocType inheritance.

**Key interfaces**:

```typescript
interface DocTypeDefinition {
  name: string;                    // Unique identifier (PascalCase)
  module: string;                  // Module grouping
  naming_rule: NamingRule;         // How documents are named
  is_submittable: boolean;         // Supports Submit/Cancel workflow
  is_child: boolean;               // Is this a child table DocType
  is_single: boolean;              // Single-record DocType (like Settings)
  is_tree: boolean;                // Tree structure (parent-child)
  is_virtual: boolean;             // No database table (computed)
  fields: FieldDefinition[];       // Field list
  permissions: PermissionRule[];   // Permission rules
  hooks?: DocTypeHooks;            // Lifecycle hooks config
  search_fields?: string[];        // Fields used in link search
  title_field?: string;            // Field used as display title
  sort_field?: string;             // Default sort field
  sort_order?: 'asc' | 'desc';    // Default sort order
}

interface FieldDefinition {
  fieldname: string;               // Column name (snake_case)
  fieldtype: FieldType;            // One of the supported field types
  label: string;                   // Display label
  reqd?: boolean;                  // Required
  unique?: boolean;                // Unique constraint
  default?: unknown;               // Default value
  max_length?: number;             // Max string length
  options?: string | string[];     // Select options or Link target
  hidden?: boolean;                // Hidden from UI
  read_only?: boolean;             // Cannot be edited
  in_list_view?: boolean;          // Show in list view
  in_standard_filter?: boolean;    // Show as filter
  search_index?: boolean;          // Create database index
  description?: string;            // Help text
  depends_on?: string;             // Conditional visibility expression
  precision?: number;              // Decimal precision for numeric fields
}

type NamingRule = 'autoincrement' | 'hash' | 'field' | 'format' | 'prompt' | 'expression';

type FieldType =
  | 'Data' | 'Int' | 'Float' | 'Currency'
  | 'Date' | 'Datetime' | 'Time'
  | 'Text' | 'LongText' | 'SmallText'
  | 'Check' | 'Select'
  | 'Link' | 'DynamicLink' | 'Table'
  | 'Attach' | 'AttachImage'
  | 'Color' | 'JSON' | 'Password'
  | 'ReadOnly' | 'HTML';
```

### 4.2 Document System (`src/core/document/`)

The Document class is the runtime representation of a database record. It provides:

**Base Document**:
```typescript
abstract class Document {
  doctype: string;
  name: string;                       // Primary key
  owner: string;                      // Creator
  creation: Date;                     // Created timestamp
  modified: Date;                     // Last modified timestamp
  modified_by: string;                // Last modifier
  docstatus: DocStatus;               // 0=Draft, 1=Submitted, 2=Cancelled

  // Lifecycle hooks (override in controllers)
  async beforeValidate(): Promise<void>;
  async validate(): Promise<void>;
  async beforeSave(): Promise<void>;
  async afterSave(): Promise<void>;
  async beforeInsert(): Promise<void>;
  async afterInsert(): Promise<void>;
  async beforeSubmit(): Promise<void>;
  async afterSubmit(): Promise<void>;
  async beforeCancel(): Promise<void>;
  async afterCancel(): Promise<void>;
  async beforeDelete(): Promise<void>;
  async afterDelete(): Promise<void>;
  onChange(): Promise<void>;

  // Utility methods
  hasChanged(fieldname: string): boolean;
  getPrevious(fieldname: string): unknown;
  set(fieldname: string, value: unknown): void;
  get(fieldname: string): unknown;
  append(fieldname: string, child: Partial<Document>): Document;
  isNew(): boolean;

  // Database operations
  async save(): Promise<this>;
  async insert(): Promise<this>;
  async delete(): Promise<void>;
  async submit(): Promise<this>;
  async cancel(): Promise<this>;
  async reload(): Promise<this>;
}
```

**Standard fields** (auto-added to every DocType table):

| Field      | Type         | Description           |
|------------|--------------|------------------------|
| name       | VARCHAR(255) | Primary key            |
| owner      | VARCHAR(255) | Creator user           |
| creation   | TIMESTAMPTZ  | Created at             |
| modified   | TIMESTAMPTZ  | Last modified at       |
| modified_by| VARCHAR(255) | Last modified by       |
| docstatus  | SMALLINT     | 0=Draft,1=Submitted,2=Cancelled |
| idx        | INTEGER      | Sort index (for children)|

### 4.3 Database Layer (`src/database/`)

**Connection Management**:
- Uses pg Pool for connection pooling
- Configurable pool size, idle timeout, connection timeout
- Health check queries
- Graceful shutdown

**Query Builder**:
```typescript
// Fluent, type-safe query construction
const results = await db.query('Todo')
  .select('name', 'title', 'status')
  .where('status', '=', 'Open')
  .where('assigned_to', '=', 'user@example.com')
  .orderBy('creation', 'desc')
  .limit(20)
  .offset(0)
  .execute();

// Joins for Link fields
const results = await db.query('Todo')
  .select('name', 'title', 'assigned_to.full_name as assignee_name')
  .where('status', '=', 'Open')
  .execute();
```

**Schema Sync**:
- Compare DocType definitions with actual database schema
- Generate and execute ALTER TABLE statements
- Handle column additions, type changes, index changes
- Never drop columns automatically (safety)

**Transaction Support**:
```typescript
await db.transaction(async (trx) => {
  await trx.insert('Todo', { title: 'Task 1', status: 'Open' });
  await trx.insert('Todo', { title: 'Task 2', status: 'Open' });
  // Auto-rollback on error
});
```

### 4.4 ORM Layer (`src/orm/`)

The ORM provides a high-level API inspired by Frappe's `frappe.get_doc`, `frappe.get_list`, etc.

```typescript
// Nodra global API
const nodra = getNodra(); // Application singleton

// Create and insert
const todo = await nodra.getDoc({
  doctype: 'Todo',
  title: 'My Task',
  status: 'Open'
});
await todo.insert();

// Get single document
const doc = await nodra.getDoc('Todo', 'TODO-0001');

// Get list with filters
const todos = await nodra.getList('Todo', {
  filters: { status: 'Open', assigned_to: 'user@example.com' },
  fields: ['name', 'title', 'status', 'due_date'],
  orderBy: 'creation desc',
  limit: 20,
  offset: 0
});

// Get count
const count = await nodra.getCount('Todo', { status: 'Open' });

// Get single value
const title = await nodra.getValue('Todo', 'TODO-0001', 'title');

// Set single value
await nodra.setValue('Todo', 'TODO-0001', 'status', 'Closed');

// Delete
await nodra.deleteDoc('Todo', 'TODO-0001');

// Check existence
const exists = await nodra.exists('Todo', 'TODO-0001');
```

### 4.5 REST API (`src/api/`)

Auto-generated endpoints for every DocType:

```
GET    /api/resource/:doctype                  # List documents
GET    /api/resource/:doctype/:name            # Get single document
POST   /api/resource/:doctype                  # Create document
PUT    /api/resource/:doctype/:name            # Update document
DELETE /api/resource/:doctype/:name            # Delete document

POST   /api/method/:dotted_path                # Call whitelisted method

GET    /api/resource/:doctype/count            # Get count
GET    /api/resource/:doctype/:name/method/:m  # Call document method
```

**Query parameters for list endpoint**:
- `fields`: comma-separated field names
- `filters`: JSON array of filter tuples `[["status","=","Open"]]`
- `order_by`: sort expression `creation desc`
- `limit_start`: offset
- `limit_page_length`: limit (default 20, max 100)

**Response format**:
```json
{
  "data": { ... },
  "message": "optional message"
}
```

**Error format**:
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

### 4.6 Permission System (`src/permissions/`)

Four levels of permission control:

1. **DocType Permission** (docperm): Role-based CRUD on a DocType
2. **User Permission** (userperm): Restrict access to specific Link values
3. **Field Permission** (fieldperm): Role-based field read/write
4. **Document-level**: Owner-based rules

```typescript
interface PermissionRule {
  role: string;
  read: boolean;
  write: boolean;
  create: boolean;
  delete: boolean;
  submit: boolean;
  cancel: boolean;
  amend: boolean;
  if_owner: boolean;         // Only apply if user is document owner
}
```

Permission is enforced at:
- API level: middleware checks before handler
- ORM level: automatic query filtering (`getList` adds permission conditions)
- Document level: `save()` checks write permission

### 4.7 Workflow Engine (`src/workflow/`)

State-machine based workflow for submittable documents:

```jsonc
{
  "name": "Todo Workflow",
  "document_type": "Todo",
  "is_active": true,
  "states": [
    { "state": "Draft", "doc_status": 0, "allow_edit": "All" },
    { "state": "Pending Approval", "doc_status": 0, "allow_edit": "Approver" },
    { "state": "Approved", "doc_status": 1, "allow_edit": "System Manager" },
    { "state": "Rejected", "doc_status": 0, "allow_edit": "All" }
  ],
  "transitions": [
    { "state": "Draft", "action": "Submit for Approval", "next_state": "Pending Approval", "allowed": "All" },
    { "state": "Pending Approval", "action": "Approve", "next_state": "Approved", "allowed": "Approver" },
    { "state": "Pending Approval", "action": "Reject", "next_state": "Rejected", "allowed": "Approver" },
    { "state": "Rejected", "action": "Resubmit", "next_state": "Pending Approval", "allowed": "All" }
  ]
}
```

### 4.8 Hook System (`src/hooks/`)

Apps can register hooks to extend framework behavior:

```typescript
// app hooks configuration
export default {
  doc_events: {
    'Todo': {
      afterSave: 'my_app.handlers.todo.after_save',
      validate: 'my_app.handlers.todo.validate'
    },
    '*': {
      beforeSave: 'my_app.handlers.common.track_changes'
    }
  },
  scheduler_events: {
    daily: ['my_app.tasks.daily_cleanup'],
    hourly: ['my_app.tasks.sync_data'],
    cron: {
      '0 */6 * * *': ['my_app.tasks.periodic_task']
    }
  },
  app_include_js: ['/assets/my_app/js/custom.js'],
  boot_session: 'my_app.boot.get_boot_data',
  override_whitelisted_methods: {
    'nodra.api.some_method': 'my_app.override.custom_method'
  }
};
```

### 4.9 Background Jobs (`src/jobs/`)

PostgreSQL-based job queue (no Redis dependency):

- Uses PostgreSQL SKIP LOCKED for reliable job dequeue
- Job types: immediate, delayed, recurring (cron)
- Dead letter queue for failed jobs
- Job status tracking and retry logic
- Configurable concurrency

### 4.10 Real-time (`src/realtime/`)

WebSocket-based real-time updates:

- Document change notifications
- User presence tracking
- Custom event channels
- Room-based subscriptions (per-doctype, per-document)
- Authentication via session token

### 4.11 App System (`src/app/`)

Multi-app architecture allows building applications on top of Nodra:

```
my-project/
├── sites/
│   └── mysite.localhost/
│       └── site_config.json
├── apps/
│   ├── nodra/              # Core framework (always installed)
│   ├── my_app/             # Custom application
│   │   ├── doctypes/
│   │   │   └── my_module/
│   │   │       └── invoice/
│   │   │           ├── invoice.json
│   │   │           └── invoice.ts
│   │   ├── api/
│   │   ├── hooks.ts
│   │   └── package.json
│   └── another_app/
└── nodra.config.ts
```

### 4.12 CLI (`src/cli/`)

```bash
nodra new-site mysite --db-name mysite_db   # Create new site
nodra new-app my_app                         # Scaffold new app
nodra install-app my_app                     # Install app to site
nodra migrate                                # Sync DocTypes to database
nodra build                                  # Build frontend assets
nodra start                                  # Start dev server
nodra console                                # Interactive REPL
nodra run-tests                              # Run tests
```

---

## 5. Database Design

### 5.1 Table Naming Convention

- DocType `Todo` → table `tab_todo`
- DocType `Sales Invoice` → table `tab_sales_invoice`
- Prefix `tab_` to avoid conflicts with PostgreSQL reserved words

### 5.2 Standard Columns

Every table includes:

```sql
CREATE TABLE tab_todo (
  name        VARCHAR(255) PRIMARY KEY,
  owner       VARCHAR(255) NOT NULL,
  creation    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modified    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modified_by VARCHAR(255) NOT NULL,
  docstatus   SMALLINT NOT NULL DEFAULT 0,
  idx         INTEGER NOT NULL DEFAULT 0,
  -- ... custom fields from DocType definition
);
```

### 5.3 Indexes

Auto-created indexes:
- Primary key on `name`
- Index on `modified` (for sorting)
- Index on `owner` (for permission queries)
- Index on fields with `search_index: true`
- Index on all Link fields (foreign key lookups)
- Composite indexes as defined in DocType

### 5.4 Child Tables

Child DocType tables include:
- `parent` VARCHAR(255): parent document name
- `parenttype` VARCHAR(255): parent DocType name
- `parentfield` VARCHAR(255): field name in parent
- `idx` INTEGER: sort order within parent

---

## 6. Error Handling Strategy

### 6.1 Error Hierarchy

```
NodraError (base)
├── ValidationError        # Field validation failures
├── PermissionError        # Access denied
├── NotFoundError          # Document not found
├── DuplicateError         # Unique constraint violation
├── LinkValidationError    # Invalid Link reference
├── MandatoryError         # Required field missing
├── InvalidStateError      # Invalid workflow state transition
├── DatabaseError          # Database operation failure
├── AuthenticationError    # Auth failure
└── AppError               # Generic application error
```

### 6.2 Error Response Mapping

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

---

## 7. Configuration

### 7.1 Site Configuration

```typescript
// nodra.config.ts
export default {
  site: 'mysite.localhost',
  db: {
    host: 'localhost',
    port: 5432,
    database: 'nodra_mysite',
    user: 'postgres',
    password: 'secret',
    pool: {
      min: 2,
      max: 10,
      idleTimeoutMillis: 30000
    }
  },
  server: {
    host: '0.0.0.0',
    port: 8000
  },
  auth: {
    secret: 'jwt-secret-key',
    tokenExpiry: '24h',
    passwordHashRounds: 12
  },
  jobs: {
    concurrency: 5,
    retryLimit: 3,
    retryDelay: 60000    // 1 minute
  },
  logging: {
    level: 'info',       // debug, info, warn, error
    format: 'json'       // json, pretty
  },
  installed_apps: ['nodra', 'my_app']
};
```

---

## 8. Security Considerations

- **SQL Injection**: All queries use parameterized statements via pg driver
- **XSS**: Output encoding in all API responses
- **CSRF**: Token-based CSRF protection for session auth
- **Authentication**: JWT with refresh tokens, argon2 password hashing
- **Rate Limiting**: Per-endpoint and per-user rate limiting
- **Input Validation**: JSON Schema validation at API boundary
- **Permission**: Defense-in-depth at API, ORM, and Document layers
- **Audit Trail**: All document changes logged with user and timestamp
